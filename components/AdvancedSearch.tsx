
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Song, GENRES } from '../types';
import { Search, Loader2, Heart, X, Music } from 'lucide-react';
import { DiceIcon, KeyBadge } from './ui/Brand';

interface AdvancedSearchProps {
  session?: any;
  isAdmin?: boolean;
  initialQuery?: string;
  onSelectSong: (id: string) => void;
  onAddSong?: () => void;
  favoritesOnly?: boolean;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (songId: string, isFav: boolean) => void;
  onFavoritesOnlyChange?: (value: boolean) => void;
}

const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const firstLetter = (str: string) => {
  const c = normalize(str.trim()).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  session,
  isAdmin = false,
  initialQuery = '',
  onSelectSong,
  onAddSong,
  favoritesOnly = false,
  favoriteIds,
  onToggleFavorite,
  onFavoritesOnlyChange
}) => {
  const [selectedLetter, setSelectedLetter] = useState('');
  const [localFavs, setLocalFavs] = useState<Set<string>>(favoriteIds || new Set());
  useEffect(() => { setLocalFavs(favoriteIds || new Set()); }, [favoriteIds]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTitle, setSearchTitle] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedArtist, setSelectedArtist] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Sync initialQuery if it changes while component is mounted
  useEffect(() => {
    if (initialQuery) setSearchTitle(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    fetchAllSongs();
  }, [session]);

  const fetchAllSongs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('songs')
        .select('*');

      if (isAdmin) {
        // Admin sees all songs — RLS handles it
      } else if (session?.user?.id) {
        query = query.or(`is_public.eq.true,user_id.eq.${session.user.id}`);
      } else {
        query = query.eq('is_public', true);
      }
        
      const { data, error } = await query
        .select('id, user_id, title, artist, bpm, original_key, youtube_url, audio_url, is_public, shared_with_group_id, genres, tags')
        .order('title', { ascending: true });

      if (error) throw error;

      if (data) {
        const mapped: Song[] = data.map((s: any) => ({
            id: s.id,
            user_id: s.user_id,
            title: s.title,
            artist: s.artist,
            bpm: s.bpm,
            key: s.original_key,
            content: s.content,
            youtubeUrl: s.youtube_url,
            audioUrl: s.audio_url,
            is_public: s.is_public,
            shared_with_group_id: s.shared_with_group_id,
            genres: s.genres || [],
            tags: s.tags || []
        }));
        setSongs(mapped);
      }
    } catch (err: any) {
      console.error("Error fetching library:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const uniqueArtists = useMemo(() => {
    const artists = new Set(songs.map(s => s.artist));
    return Array.from(artists).sort();
  }, [songs]);

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    songs.forEach(s => s.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [songs]);

  const filteredSongs = songs.filter(song => {
    const q = normalize(searchTitle);
    const matchesTitle = !q || normalize(song.title).includes(q) || normalize(song.artist || '').includes(q);
    const matchesArtist = selectedArtist ? song.artist === selectedArtist : true;
    const matchesGenre = selectedGenre ? song.genres?.includes(selectedGenre) : true;
    const matchesTag = selectedTag ? song.tags?.includes(selectedTag) : true;
    const matchesLetter = selectedLetter ? firstLetter(song.title) === selectedLetter : true;
    const matchesFav = favoritesOnly ? localFavs.has(song.id) : true;

    return matchesTitle && matchesArtist && matchesGenre && matchesTag && matchesLetter && matchesFav;
  });

  const handleRandomSong = () => {
    if (filteredSongs.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredSongs.length);
    const randomSong = filteredSongs[randomIndex];
    onSelectSong(randomSong.id);
  };

  const clearFilters = () => {
    setSearchTitle('');
    setSelectedArtist('');
    setSelectedGenre('');
    setSelectedTag('');
    setSelectedLetter('');
    if (onFavoritesOnlyChange) onFavoritesOnlyChange(false);
    setPage(1);
  };

  const toggleFav = (songId: string) => {
    if (!onToggleFavorite) return;
    const isFav = !localFavs.has(songId);
    const next = new Set(localFavs);
    if (isFav) next.add(songId); else next.delete(songId);
    setLocalFavs(next);
    onToggleFavorite(songId, isFav);
  };

  const availableLetters = useMemo(() => new Set(songs.map(s => firstLetter(s.title))), [songs]);
  const visibility = (song: Song) => song.is_public ? 'Public' : song.shared_with_group_id ? 'Groupe' : 'Privée';

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchTitle, selectedArtist, selectedGenre, selectedTag, selectedLetter, favoritesOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
  const pageSongs = filteredSongs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters: { label: string; clear: () => void }[] = [
    ...(favoritesOnly ? [{ label: 'Favoris', clear: () => onFavoritesOnlyChange && onFavoritesOnlyChange(false) }] : []),
    ...(selectedArtist ? [{ label: selectedArtist, clear: () => setSelectedArtist('') }] : []),
    ...(selectedGenre ? [{ label: selectedGenre, clear: () => setSelectedGenre('') }] : []),
    ...(selectedTag ? [{ label: `#${selectedTag}`, clear: () => setSelectedTag('') }] : []),
    ...(selectedLetter ? [{ label: `Lettre ${selectedLetter}`, clear: () => setSelectedLetter('') }] : [])
  ];

  const selectCls = (active: boolean) =>
    `appearance-none min-w-[168px] h-11 pl-3 pr-9 rounded-md text-base cursor-pointer bg-slate-50 dark:bg-slate-900 bg-no-repeat ${
      active ? 'border-[1.5px] border-ink dark:border-slate-200 font-bold' : 'border border-slate-400 dark:border-slate-700 font-medium'
    }`;
  const chevron = {
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23686D76' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundPosition: 'right 12px center'
  } as React.CSSProperties;

  return (
    <div className="max-w-[1080px] mx-auto px-4 md:px-10 pt-6 md:pt-8 pb-12 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display font-extrabold text-[28px] md:text-4xl leading-tight" style={{ letterSpacing: '-0.025em' }}>
            {favoritesOnly ? 'Favoris' : 'Bibliothèque'}
          </h1>
          <p className="mt-1.5 mb-0 text-slate-600 dark:text-slate-400">
            {loading ? 'Chargement…' : `${songs.length} chanson${songs.length > 1 ? 's' : ''}${localFavs.size ? `, dont ${localFavs.size} en favoris` : ''}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRandomSong}
            disabled={filteredSongs.length === 0}
            aria-label="Chanson au hasard parmi les résultats"
            title="Chanson au hasard"
            className="w-10 h-10 inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-40"
          >
            <DiceIcon />
          </button>
          {onAddSong && (
            <button
              type="button"
              onClick={onAddSong}
              className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold hover:border-slate-500"
            >
              Nouvelle chanson
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="flex-[1_1_280px] flex items-center gap-2.5 h-11 px-3.5 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-cyan-600 dark:focus-within:border-cyan-400">
          <Search size={18} className="text-slate-500 shrink-0" aria-hidden="true" />
          <input
            type="search"
            aria-label="Chercher un titre ou un artiste"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="Chercher un titre ou un artiste"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none"
          />
        </label>
        <label className="flex-1 sm:flex-none">
          <span className="sr-only">Artiste</span>
          <select value={selectedArtist} onChange={(e) => setSelectedArtist(e.target.value)} className={`${selectCls(!!selectedArtist)} w-full`} style={chevron}>
            <option value="">Tous les artistes</option>
            {uniqueArtists.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex-1 sm:flex-none">
          <span className="sr-only">Genre</span>
          <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className={`${selectCls(!!selectedGenre)} w-full`} style={chevron}>
            <option value="">Tous les genres</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="flex-1 sm:flex-none">
          <span className="sr-only">Tag</span>
          <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className={`${selectCls(!!selectedTag)} w-full`} style={chevron}>
            <option value="">Tous les tags</option>
            {uniqueTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm min-h-[30px]">
        {session && onFavoritesOnlyChange && (
          <button
            type="button"
            aria-pressed={favoritesOnly}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            className={`inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded border font-semibold ${
              favoritesOnly
                ? 'border-cyan-600 bg-cyan-100 text-cyan-700 shadow-[inset_0_-2px_0_#2440D6] dark:border-cyan-400 dark:bg-cyan-900 dark:text-cyan-300'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
            }`}
          >
            <Heart size={14} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favoris
          </button>
        )}
        {activeFilters.length > 0 && <span className="text-slate-500 ml-1">Filtres actifs</span>}
        {activeFilters.map(f => (
          <button
            key={f.label}
            type="button"
            onClick={f.clear}
            aria-label={`Retirer le filtre ${f.label}`}
            className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded border border-ink dark:border-slate-300 bg-[#E6E8E2] dark:bg-slate-800 font-semibold"
          >
            {f.label} <X size={12} aria-hidden="true" />
          </button>
        ))}
        {activeFilters.length > 0 && (
          <button type="button" onClick={clearFilters} className="h-[30px] px-2 font-semibold underline underline-offset-[3px]">Tout effacer</button>
        )}
        <span className="ml-auto text-slate-500">{filteredSongs.length} résultat{filteredSongs.length > 1 ? 's' : ''}</span>
      </div>

      {/* Alphabetical index */}
      <div className="flex flex-wrap gap-0.5" aria-label="Index alphabétique" role="group">
        {LETTERS.map(ch => {
          const has = availableLetters.has(ch);
          const on = selectedLetter === ch;
          return (
            <button
              key={ch}
              type="button"
              disabled={!has}
              aria-pressed={on}
              onClick={() => setSelectedLetter(on ? '' : ch)}
              className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded font-mono text-sm font-bold ${
                on
                  ? 'bg-cyan-100 text-cyan-700 shadow-[inset_0_-2px_0_#2440D6] dark:bg-cyan-900 dark:text-cyan-300 dark:shadow-[inset_0_-2px_0_#93A5FF]'
                  : has
                    ? 'text-ink dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-300 dark:text-slate-700 cursor-default'
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="text-cyan-600 dark:text-cyan-400 animate-spin" />
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center py-14 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
          <Music size={36} className="text-slate-400" />
          <p className="m-0 text-slate-600 dark:text-slate-400">Aucune chanson ne correspond à ces filtres.</p>
          <button type="button" onClick={clearFilters} className="h-10 px-4 rounded-md border border-slate-300 dark:border-slate-700 font-semibold">Effacer les filtres</button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto border-t-[1.5px] border-ink dark:border-slate-300">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>
                  {onToggleFavorite && <th className="px-2 py-3 font-semibold w-9"><span className="sr-only">Favori</span></th>}
                  <th className="px-2 py-3 font-semibold">Titre</th>
                  <th className="px-2 py-3 font-semibold">Artiste</th>
                  <th className="px-2 py-3 font-semibold">Ton</th>
                  <th className="px-2 py-3 font-semibold">Tempo</th>
                  <th className="px-2 py-3 font-semibold">Tags</th>
                  <th className="px-2 py-3 font-semibold">Visibilité</th>
                </tr>
              </thead>
              <tbody>
                {pageSongs.map(song => {
                  const fav = localFavs.has(song.id);
                  return (
                    <tr key={song.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/50">
                      {onToggleFavorite && (
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => toggleFav(song.id)}
                            aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            aria-pressed={fav}
                            className={`w-7 h-7 inline-flex items-center justify-center ${fav ? 'text-ink dark:text-slate-100' : 'text-slate-400'}`}
                          >
                            <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
                          </button>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => onSelectSong(song.id)} className="font-semibold text-left hover:underline underline-offset-[3px]">{song.title}</button>
                      </td>
                      <td className="px-2 py-3 text-slate-600 dark:text-slate-400">{song.artist}</td>
                      <td className="px-2 py-3">{song.key && <KeyBadge>{song.key}</KeyBadge>}</td>
                      <td className="px-2 py-3 font-mono text-sm text-slate-600 dark:text-slate-400">{song.bpm || '—'}</td>
                      <td className="px-2 py-3 text-sm text-slate-600 dark:text-slate-400">{[...(song.genres || []), ...(song.tags || [])].slice(0, 3).join(', ') || '—'}</td>
                      <td className="px-2 py-3 text-sm text-slate-600 dark:text-slate-400">{visibility(song)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden">
            {pageSongs.map(song => (
              <button
                key={song.id}
                type="button"
                onClick={() => onSelectSong(song.id)}
                className="w-full flex items-center gap-3 min-h-[60px] py-2 border-b border-slate-200 dark:border-slate-800 text-left"
              >
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="font-semibold truncate">{song.title}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{song.artist}</span>
                </span>
                {song.key && <KeyBadge>{song.key}</KeyBadge>}
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span>{(page - 1) * PAGE_SIZE + 1} à {Math.min(page * PAGE_SIZE, filteredSongs.length)} sur {filteredSongs.length} résultats</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-ink dark:text-slate-100 disabled:opacity-40"
                >
                  Précédente
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1 self-center">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        aria-current={page === p ? 'page' : undefined}
                        className={`inline-flex items-center justify-center min-w-9 h-9 rounded-md border ${
                          page === p
                            ? 'border-cyan-600 bg-cyan-100 text-cyan-700 font-bold shadow-[inset_0_-2px_0_#2440D6] dark:border-cyan-400 dark:bg-cyan-900 dark:text-cyan-300'
                            : 'border-slate-200 dark:border-slate-700 text-ink dark:text-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-ink dark:text-slate-100 disabled:opacity-40"
                >
                  Suivante
                </button>
              </span>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedSearch;
