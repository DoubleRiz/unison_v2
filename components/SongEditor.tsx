
import React, { useState, useEffect, useRef } from 'react';
import { Song, Group, GENRES, SongDisplayMode } from '../types';
import { Save, X, Globe, Lock, Music2, Users, Tag, Plus, StickyNote, ArrowRightLeft } from 'lucide-react';
import { Segmented } from './ui/Segmented';
import { convertSongContent, detectSongFormat, joinColumns, songChordList, splitColumns, syncPaneLines } from '../utils/chordColumns';

interface SongEditorProps {
  initialSong?: Song | null;
  groups: Group[];
  existingTags: string[]; // List of unique tags from all songs
  /** false quand un membre de groupe modifie la chanson d'un autre : visibilité et groupe verrouillés. */
  canManageVisibility?: boolean;
  onSave: (song: Song) => void;
  onCancel: () => void;
}

type Panes = { lyrics: string[]; chords: string[] };

// Faint lines every text line, so a lyric and its chords read on the same row across the divider.
// The line height is set inline: responsive text-* classes would otherwise impose their own.
const PANE_LINE: React.CSSProperties = { lineHeight: '1.625em' };
const ROW_GUIDES: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent calc(1.625em - 1px), rgba(127,127,127,0.14) calc(1.625em - 1px), rgba(127,127,127,0.14) 1.625em)',
  backgroundPosition: '0 1rem', // the panes' top padding
  backgroundAttachment: 'local',
};

const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

const SongEditor: React.FC<SongEditorProps> = ({ initialSong, groups, existingTags, canManageVisibility = true, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState<string>('');

  // Split Key into Root + Quality
  const [keyRoot, setKeyRoot] = useState('C');
  const [keyQuality, setKeyQuality] = useState('Major'); // 'Major' or 'Minor'

  const [content, setContent] = useState('');
  const [displayMode, setDisplayMode] = useState<SongDisplayMode>('classic');
  const [notes, setNotes] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sharedGroupId, setSharedGroupId] = useState<string>('');

  // Genres & Tags
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (initialSong) {
      setTitle(initialSong.title);
      setArtist(initialSong.artist);
      setBpm(initialSong.bpm ? initialSong.bpm.toString() : '');

      // Parse Key (Simple parsing logic)
      const isMinor = initialSong.key.endsWith('m');
      const root = isMinor ? initialSong.key.slice(0, -1) : initialSong.key;

      setKeyRoot(KEYS.includes(root) ? root : 'C');
      setKeyQuality(isMinor ? 'Minor' : 'Major');

      setContent(initialSong.content);
      setDisplayMode(initialSong.displayMode ?? detectSongFormat(initialSong.content));
      setNotes(initialSong.notes || '');
      setYoutubeUrl(initialSong.youtubeUrl || '');
      setAudioUrl(initialSong.audioUrl || '');
      setIsPublic(initialSong.is_public);
      setSharedGroupId(initialSong.shared_with_group_id || '');
      setSelectedGenres(initialSong.genres || []);
      setTags(initialSong.tags || []);
    } else {
      // Reset for new song
      setTitle('');
      setArtist('');
      setBpm('120');
      setKeyRoot('C');
      setKeyQuality('Major');
      setContent(`[Intro]
[C]     [G]

[Verse 1]
[C]                [G]
This is how you write a song
[Am]             [F]
With sections clearly marked`);
      setDisplayMode('classic');
      setNotes('');
      setYoutubeUrl('');
      setAudioUrl('');
      setIsPublic(true);
      setSharedGroupId('');
      setSelectedGenres([]);
      setTags([]);
    }
  }, [initialSong]);

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Reconstruct full key string
    const fullKey = `${keyRoot}${keyQuality === 'Minor' ? 'm' : ''}`;

    onSave({
      id: initialSong ? initialSong.id : crypto.randomUUID(),
      title,
      artist,
      bpm: bpm === '' ? null : Number(bpm),
      key: fullKey,
      content,
      displayMode,
      notes,
      youtubeUrl,
      audioUrl,
      is_public: isPublic,
      shared_with_group_id: sharedGroupId === '' ? null : sharedGroupId,
      genres: selectedGenres,
      tags: tags
    });
  };

  // The text may be written in the other format than the one chosen: offer to rewrite it.
  // Lyrics alone (no chord yet) suit both formats.
  const writtenFormat = detectSongFormat(content);
  const formatMismatch = content.trim() !== '' && writtenFormat !== displayMode && songChordList(content).length > 0;
  const convertContent = () => setContent(convertSongContent(content, displayMode));
  const isColumns = displayMode === 'columns';

  // Column songs are edited in two panes split by a divider: lyrics on the left, chords on the right.
  // The panes hold the text while editing; `content` is rebuilt from them.
  const showPanes = isColumns && !formatMismatch;
  const [panes, setPanes] = useState<Panes | null>(null);
  const lastJoined = useRef<string | null>(null);
  useEffect(() => {
    if (!showPanes) { lastJoined.current = null; return; }
    if (content !== lastJoined.current) {
      setPanes(splitColumns(content));
      lastJoined.current = content;
    }
  }, [showPanes, content]);

  const editPane = (side: keyof Panes, value: string) => {
    if (!panes) return;
    const other: keyof Panes = side === 'lyrics' ? 'chords' : 'lyrics';
    const after = value.split('\n');
    const next = { [side]: after, [other]: syncPaneLines(panes[side], after, panes[other]) } as Panes;
    const joined = joinColumns(next.lyrics, next.chords);
    lastJoined.current = joined;
    setPanes(next);
    setContent(joined);
  };
  const paneRows = Math.max(16, panes?.lyrics.length ?? 0, panes?.chords.length ?? 0);
  const paneClass = 'block w-full bg-transparent px-3 sm:px-4 py-4 font-mono text-xs sm:text-sm focus:outline-none resize-none overflow-y-hidden whitespace-pre';

  // Calculate Sounding Key
  const currentKey = `${keyRoot}${keyQuality === 'Minor' ? 'm' : ''}`;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-ink dark:text-white">
          {initialSong ? 'Modifier la chanson' : 'Nouvelle chanson'}
        </h2>
        <button type="button" onClick={onCancel} className="text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-white">
          <X size={24} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Titre</label>
          <input
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 text-ink dark:text-white"
            placeholder="Titre de la chanson"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Artiste</label>
          <input
            required
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 text-ink dark:text-white"
            placeholder="Nom de l'artiste"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Key Selector Split */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ton</label>
          <div className="flex gap-1">
            <select
              value={keyRoot}
              onChange={(e) => setKeyRoot(e.target.value)}
              className="w-2/3 bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-l-lg px-2 py-2 text-ink dark:text-white focus:outline-none focus:border-cyan-500 text-sm appearance-none"
            >
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select
              value={keyQuality}
              onChange={(e) => setKeyQuality(e.target.value)}
              className="w-1/3 bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 border-l-0 rounded-r-lg px-1 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500 text-sm appearance-none"
            >
              <option value="Major">Maj</option>
              <option value="Minor">min</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">BPM</label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 text-ink dark:text-white placeholder:text-slate-700"
            placeholder="-"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Lien YouTube</label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 text-ink dark:text-white placeholder:text-slate-700"
            placeholder="https://youtube.com/..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Lien audio (MP3/WAV)</label>
          <div className="relative">
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-cyan-500 text-ink dark:text-white placeholder:text-slate-700"
              placeholder="https://example.com/song.mp3"
            />
            <Music2 className="absolute left-3 top-2.5 text-slate-600" size={14} />
          </div>
        </div>
      </div>

      {/* Genres */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Genres</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map(genre => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedGenres.includes(genre)
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Tags</label>
        <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 flex flex-wrap gap-2 min-h-[46px] items-center">
          {tags.map(tag => (
            <span key={tag} className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2 py-1 rounded text-xs flex items-center gap-1">
              #{tag}
              <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-ink dark:hover:text-white">
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            className="bg-transparent text-sm text-ink dark:text-white focus:outline-none flex-1 min-w-[120px]"
            placeholder="Ajouter un tag puis Entrée…"
            list="tag-suggestions"
          />
          <datalist id="tag-suggestions">
            {existingTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </div>

      {!canManageVisibility ? (
        <div className="p-3 mb-6 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <Lock size={16} className="shrink-0" />
          Seul le propriétaire de la chanson peut changer sa visibilité et son groupe.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Visibility Toggle */}
        <div className="p-3 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors" onClick={() => setIsPublic(!isPublic)}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPublic ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {isPublic ? <Globe size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div className={`text-sm font-medium ${isPublic ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {isPublic ? 'Chanson publique' : 'Chanson privée'}
              </div>
              <div className="text-xs text-slate-500">
                {isPublic ? 'Visible par tous.' : 'Visible par vous et votre groupe.'}
              </div>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full relative transition-colors ${isPublic ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${isPublic ? 'left-7' : 'left-1'}`}></div>
          </div>
        </div>

        {/* Group Permission Toggle */}
        {groups.length > 0 && (
          <div className="p-3 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Users size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                Modifiable par le groupe
              </div>
              <select
                value={sharedGroupId}
                onChange={(e) => setSharedGroupId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded text-xs text-ink dark:text-white py-1 px-2 focus:outline-none"
              >
                <option value="">Aucun groupe (moi seul)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      )}

      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label htmlFor="song-content" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {showPanes
              ? 'Contenu : paroles à gauche, accords de la ligne à droite'
              : isColumns
              ? 'Contenu : paroles à gauche, accords de la ligne à droite (séparés par deux espaces ou une tabulation)'
              : 'Contenu (accords entre crochets [Am], sections [Refrain], [Couplet]…)'}
          </label>
          <Segmented<SongDisplayMode>
            label="Disposition des accords"
            size="sm"
            value={displayMode}
            onChange={setDisplayMode}
            options={[{ value: 'classic', label: 'Classique' }, { value: 'columns', label: 'Colonnes' }]}
          />
        </div>
        {formatMismatch && (
          <div className="flex flex-wrap items-center gap-3 p-3 mb-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-100 dark:bg-slate-950 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex-1 min-w-[200px]">
              Le texte est écrit en {writtenFormat === 'columns' ? 'colonnes' : 'classique'}. La chanson s'affichera en {isColumns ? 'colonnes' : 'classique'} ; vous pouvez aussi réécrire le texte dans ce format.
              {!isColumns && ' Les accords seront répartis régulièrement au-dessus des paroles, à ajuster à la main.'}
            </span>
            <button type="button" onClick={convertContent} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold hover:border-slate-500">
              <ArrowRightLeft size={14} /> Convertir en {isColumns ? 'colonnes' : 'classique'}
            </button>
            <button type="button" onClick={() => setDisplayMode(writtenFormat)} className="h-9 px-2 font-semibold text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1">
              Afficher en {writtenFormat === 'columns' ? 'colonnes' : 'classique'}
            </button>
          </div>
        )}
        {showPanes && panes ? (
          <div className="border border-slate-400 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 focus-within:border-cyan-500 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,35%)] border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div className="px-4 py-1.5">Paroles et sections</div>
              <div className="px-4 py-1.5 border-l-2 border-slate-300 dark:border-slate-700">Accords</div>
            </div>
            <div className="h-96 overflow-y-auto">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,35%)] min-h-full text-xs sm:text-sm" style={ROW_GUIDES}>
                <textarea
                  id="song-content"
                  aria-label="Paroles et sections"
                  wrap="off"
                  rows={paneRows}
                  style={PANE_LINE}
                  value={panes.lyrics.join('\n')}
                  onChange={(e) => editPane('lyrics', e.target.value)}
                  className={`${paneClass} text-slate-700 dark:text-slate-300`}
                  placeholder={`Refrain\nComme un souffle fragile,\nTa parole se donne.`}
                />
                <textarea
                  aria-label="Accords de la ligne"
                  wrap="off"
                  rows={paneRows}
                  style={PANE_LINE}
                  value={panes.chords.join('\n')}
                  onChange={(e) => editPane('chords', e.target.value)}
                  className={`${paneClass} border-l-2 border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 font-semibold`}
                  placeholder={`\nEm  Am\nB7  Em`}
                />
              </div>
            </div>
          </div>
        ) : (
        <div className="relative">
          <textarea
            id="song-content"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-96 bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-4 font-mono text-sm focus:outline-none focus:border-cyan-500 text-slate-700 dark:text-slate-300 leading-relaxed resize-none"
            placeholder={isColumns ? `[Refrain]
Comme un souffle fragile,     Em  Am
Ta parole se donne.           B7  Em` : `[Intro]
[C]      [G]

[Verse 1]
[C]                 [G]
This is how you write a song...`}
          />
          <div className="absolute top-2 right-2 opacity-50 text-[10px] text-slate-500 bg-slate-50/80 dark:bg-slate-900/80 px-2 py-1 rounded pointer-events-none border border-slate-200 dark:border-slate-800">
            {isColumns ? 'Accords sans crochets acceptés' : 'Alignez avec des espaces'}
          </div>
        </div>
        )}
      </div>

      {/* Notes / Verses */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-2">
          <StickyNote size={12} /> Notes de jeu
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-24 bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 text-slate-700 dark:text-slate-300 resize-none placeholder:text-slate-700"
          placeholder="Réglages, effets, consignes de jeu…"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
        >
          <Save size={18} />
          Enregistrer
        </button>
      </div>
    </form>
  );
};

export default SongEditor;
