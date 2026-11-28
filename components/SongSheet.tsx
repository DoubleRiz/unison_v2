
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Song, NotationMode, SongDisplayMode } from '../types';
import { transpose, convertToDegree, getSectionType } from '../utils/musicLogic';
import { detectSongFormat, parseSongRows, songChordList, toClassicContent, transposeSongContent } from '../utils/chordColumns';
import { Heart, Trash2, AlertTriangle, Pencil, ZoomIn, ZoomOut, Play, Pause, Download, ChevronDown, ChevronUp, Smartphone, X } from 'lucide-react';
import ChordVisualizer from './ChordVisualizer';
import { GUITAR_DATA } from '../constants/chordShapes';
import { KeyBadge } from './ui/Brand';
import CommentsSection from './CommentsSection';
import ChordTooltip from './ChordTooltip';
import { jsPDF } from 'jspdf';
import { registerPdfFonts, normalizePdfText, fallbackPdfText, PDF_FONT } from '../utils/pdfFonts';

interface SongSheetProps {
  song: Song;
  transposeSemitones: number;
  notationMode: NotationMode;
  onToggleFavorite?: (isFav: boolean) => void;
  className?: string;
  session?: any; 
  isAdmin?: boolean;
  onOpenAuth?: () => void;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
  onTransposeChange?: (delta: number) => void;
  onTransposeReset?: () => void;
  onNotationModeChange?: (mode: NotationMode) => void;
  onBack?: () => void;
}

const SongSheet: React.FC<SongSheetProps> = ({ 
  song, 
  transposeSemitones, 
  notationMode, 
  onToggleFavorite, 
  className = '', 
  session,
  isAdmin = false,
  onOpenAuth,
  onEdit,
  onDelete,
  onTransposeChange,
  onTransposeReset,
  onNotationModeChange,
  onBack
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // View Settings
  const [fontSize, setFontSize] = useState(1.25); 
  const [showChords, setShowChords] = useState(true);
  const [isPinching, setIsPinching] = useState(false);

  // Layout: the creator's choice, or the format the song is written in. The reader can switch.
  const sourceFormat = useMemo(() => detectSongFormat(song.content), [song.content]);
  const defaultLayout: SongDisplayMode = song.displayMode ?? sourceFormat;
  const [layoutMode, setLayoutMode] = useState<SongDisplayMode>(defaultLayout);
  useEffect(() => { setLayoutMode(defaultLayout); }, [song.id, defaultLayout]);
  const isColumns = layoutMode === 'columns';

  // Narrow portrait screens keep both columns, in smaller type, and suggest turning the phone.
  const [isNarrowPortrait, setIsNarrowPortrait] = useState(false);
  const [rotateHintDismissed, setRotateHintDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const update = () => setIsNarrowPortrait(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Auto Scroll State & Refs
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3); // Level 1 to 7 (Default 3)
  const scrollingRef = useRef(isScrolling);
  const speedRef = useRef(scrollSpeed);
  const scrollPosRef = useRef(0); // High precision float position
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => { scrollingRef.current = isScrolling; }, [isScrolling]);
  useEffect(() => { speedRef.current = scrollSpeed; }, [scrollSpeed]);

  useEffect(() => {
    setIsFavorite(!!song.is_favorite);
    setIsScrolling(false);
  }, [song]);

  // Unified Auto Scroll Logic
  const animateScroll = (time: number) => {
    if (!scrollingRef.current) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current !== null) {
      const deltaTime = time - lastTimeRef.current;
      const scrollableParent = containerRef.current?.closest('.overflow-y-auto') as HTMLElement;
      
      if (scrollableParent) {
        // High precision math: speed * multiplier
        // Level 1 = 0.15px per frame = ~9px/sec (very slow)
        // Level 7 = 1.05px per frame = ~63px/sec
        const move = (speedRef.current * 0.15) * (deltaTime / 16.7);
        
        // Accumulate in float ref
        scrollPosRef.current += move;
        
        // Apply to integer scroll property
        scrollableParent.scrollTop = scrollPosRef.current;

        // Auto stop at the end
        if (scrollableParent.scrollTop + scrollableParent.clientHeight >= scrollableParent.scrollHeight - 5) {
          setIsScrolling(false);
          scrollingRef.current = false;
          return;
        }
      }
    }
    
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animateScroll);
  };

  // Pinch to Zoom Logic
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let initialDistance = 0;
    let baseFontSize = 1.125;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        setIsPinching(true);
        // Using a functional update later to avoid reading state here
        // But we need the starting font size for the current gesture
        // We can capture it once at the start of the gesture
        setFontSize(curr => {
          baseFontSize = curr;
          return curr;
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        // Prevent default browser zoom to owner the gesture for font-scaling
        if (e.cancelable) e.preventDefault();
        
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance;
        const newFontSize = baseFontSize * scale;
        
        setFontSize(Math.max(0.7, Math.min(newFontSize, 4.0)));
      }
    };

    const handleTouchEnd = () => {
      initialDistance = 0;
      setIsPinching(false);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    const scrollableParent = containerRef.current?.closest('.overflow-y-auto') as HTMLElement;
    
    if (isScrolling) {
      if (scrollableParent) {
        // Sync float ref with actual position before starting
        scrollPosRef.current = scrollableParent.scrollTop;
        scrollableParent.style.scrollBehavior = 'auto';
      }
      lastTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animateScroll);
    } else {
      if (scrollableParent) {
        scrollableParent.style.scrollBehavior = 'smooth';
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isScrolling]);

  const getYoutubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  };

  const toggleFavorite = async () => {
    if (!session || !onToggleFavorite) return;
    const newState = !isFavorite;
    setIsFavorite(newState);
    onToggleFavorite(newState);
  };

  const isOwner = session && session.user.id === song.user_id;
  const canEdit = isOwner || isAdmin;
  
  // Classic renderer input: a column song is rebuilt with its chords above the lyrics.
  const classicContent = useMemo(
    () => toClassicContent(song.content),
    [song.content, sourceFormat]
  );
  const columnRows = useMemo(() => parseSongRows(song.content), [song.content]);

  const parsedLines = useMemo(() => {
    const lines = classicContent.split('\n');
    return lines.map(line => {
      const sectionType = getSectionType(line);
      if (sectionType) {
        return { isSection: true, text: sectionType, segments: [] };
      }
      const parts = line.split(/\[(.*?)\]/g);
      const segments: { chord: string | null; lyrics: string; span: number }[] = [];
      if (parts[0] !== undefined) segments.push({ chord: null, lyrics: parts[0], span: parts[0].length });
      for (let i = 1; i < parts.length; i += 2) {
        const chord = parts[i];
        const lyrics = parts[i + 1] || ''; 
        // Span = length of chord + 2 (for brackets) + length of following lyrics
        segments.push({ chord, lyrics, span: chord.length + 2 + lyrics.length });
      }
      return { isSection: false, text: '', segments };
    });
  }, [classicContent]);

  const isChordLine = (segments: { chord: string | null; lyrics: string; span: number }[]) => {
    if (segments.length === 0) return false;
    const hasChord = segments.some(s => s.chord !== null);
    const hasOnlyWhitespaceLyrics = segments.every(s => s.lyrics.trim() === '');
    return hasChord && hasOnlyWhitespaceLyrics;
  };

  const processChord = (chord: string | null) => {
    if (!chord) return null;
    const transposedChord = transpose(chord, transposeSemitones);
    if (notationMode === NotationMode.DEGREES) {
      return convertToDegree(chord, song.key); 
    }
    return transposedChord;
  };

  const renderChordDisplay = (chordString: string | null, originalChord?: string | null) => {
    if (!chordString) return null;
    let content: React.ReactNode = chordString;
    const isDegree = notationMode === NotationMode.DEGREES;
    
    if (isDegree) {
      const match = chordString.match(/^([b#]?[1-7])(.*)$/);
      if (match) {
        content = (
          <>
            <span className="text-violet-600 dark:text-violet-400">{match[1]}</span>
            <span className="text-cyan-600 dark:text-cyan-400">{match[2]}</span>
          </>
        );
      }
    }

    const shapeChordName = originalChord ? transpose(originalChord, transposeSemitones) : chordString;

    return (
      <span className={`whitespace-pre cursor-default font-bold font-mono ${!isDegree ? 'text-cyan-600 dark:text-cyan-400' : ''}`}>
        {content}
      </span>
    );
  };

  const renderStyledText = (text: string) => {
    const parts = text.split(/(\*.*?\*|\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <i key={i} className="text-slate-600 dark:text-slate-400">{part.slice(1, -1)}</i>;
      }
      if (part.startsWith('(') && part.endsWith(')')) {
        return <span key={i} className="text-slate-500 text-[0.9em]">{part}</span>;
      }
      return part;
    });
  };

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => Math.max(0.7, Math.min(prev + delta, 4.0)));
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const hasFont = await registerPdfFonts(doc);
    const font = hasFont ? PDF_FONT : 'courier';
    const clean = hasFont ? normalizePdfText : fallbackPdfText;
    doc.setLanguage('fr');
    doc.setProperties({ title: song.title, author: song.artist || '', creator: 'Unison' });

    const margin = 15;
    const lineHeight = 6;
    const pageBottom = 280;
    doc.setTextColor(22, 24, 29);
    doc.setFontSize(22);
    doc.setFont(font, 'bold');
    const titleLines: string[] = doc.splitTextToSize(clean(song.title), 210 - margin * 2);
    doc.text(titleLines, margin, 22);
    let cursorY = 22 + (titleLines.length - 1) * 9 + 8;
    doc.setFontSize(12);
    doc.setFont(font, 'normal');
    const keyText = transposeSemitones !== 0 ? `${song.key} → ${transpose(song.key, transposeSemitones)}` : song.key;
    const meta = [song.artist, keyText ? `Tonalité : ${keyText}` : ''].filter(Boolean).join(' · ');
    doc.setTextColor(90, 95, 105);
    doc.text(clean(hasFont ? meta : meta.replace(' · ', ' - ')), margin, cursorY);
    cursorY += 12;
    doc.setFontSize(11);

    const drawSection = (name: string) => {
      cursorY += 4;
      doc.setFont(font, 'bold');
      doc.setTextColor(22, 24, 29);
      doc.text(clean(name.toUpperCase()), margin, cursorY);
      cursorY += lineHeight;
    };

    if (isColumns) {
      // Lyrics on the left, chords of the line in a column on the right.
      const rows = parseSongRows(transposeSongContent(song.content, transposeSemitones));
      doc.setFont(font, 'normal');
      const widest = rows.reduce((max, r) =>
        r.type === 'line' && r.chords.length ? Math.max(max, doc.getTextWidth(clean(r.lyrics))) : max, 0);
      const chordX = margin + Math.min(widest + 8, 125);
      rows.forEach(row => {
        if (cursorY > pageBottom) { doc.addPage(); cursorY = 20; }
        if (row.type === 'section') { drawSection(row.label); return; }
        if (row.type === 'line') {
          const lyricLines: string[] = row.lyrics ? doc.splitTextToSize(clean(row.lyrics), chordX - margin - 4) : [''];
          doc.setFont(font, 'normal');
          doc.setTextColor(22, 24, 29);
          doc.text(lyricLines, margin, cursorY);
          if (row.chords.length) {
            doc.setFont(font, 'bold');
            doc.setTextColor(36, 64, 214);
            doc.text(clean(row.chords.join('  ')), chordX, cursorY);
          }
          cursorY += lineHeight * Math.max(1, lyricLines.length);
          return;
        }
        cursorY += lineHeight;
      });
      const fileName = song.title.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'chanson';
      doc.save(`${fileName}.pdf`);
      return;
    }

    const lines = transposeSongContent(classicContent, transposeSemitones).split(/\r?\n/);
    lines.forEach(line => {
      if (cursorY > pageBottom) { doc.addPage(); cursorY = 20; }

      const sectionName = getSectionType(line);
      if (sectionName) { drawSection(sectionName); return; }

      // Render line with highlighted chords
      const parts = line.split(/\[(.*?)\]/g);
      let currentX = margin;

      parts.forEach((part, i) => {
        const isChord = i % 2 === 1;
        doc.setFont(font, isChord ? 'bold' : 'normal');
        if (isChord) doc.setTextColor(36, 64, 214); // Unison blue
        else doc.setTextColor(22, 24, 29);

        const textToRender = clean(part);
        if (textToRender) {
          doc.text(textToRender, currentX, cursorY);
          currentX += doc.getTextWidth(textToRender);
        }
      });

      cursorY += lineHeight;
    });
    const fileName = song.title.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'chanson';
    doc.save(`${fileName}.pdf`);
  };

  // Unique chords of the song (transposed), for the diagrams aside.
  const songChords = useMemo(() => {
    const found: string[] = [];
    songChordList(song.content).forEach(chord => {
      const c = transpose(chord, transposeSemitones);
      if (c && !found.includes(c)) found.push(c);
    });
    return found;
  }, [song.content, transposeSemitones]);
  const chordsWithShape = songChords.filter(c => GUITAR_DATA[c.split('/')[0]]);

  const isDegrees = notationMode === NotationMode.DEGREES;
  const displayKey = song.key ? (isDegrees ? `I = ${transpose(song.key, transposeSemitones)}` : transpose(song.key, transposeSemitones)) : null;
  const semiLabel = transposeSemitones === 0
    ? (song.key || '0')
    : `${song.key ? song.key + ' → ' + transpose(song.key, transposeSemitones) : (transposeSemitones > 0 ? '+' : '') + transposeSemitones}`;

  // Songs written with chord-only lines above the lyrics need a monospaced face to stay aligned;
  // songs with inline [chords] can use the reading face, chords stacked above each syllable.
  const usesChordLines = parsedLines.some(l => !l.isSection && isChordLine(l.segments));
  const lyricsFont = usesChordLines ? '' : 'font-sans';

  const toolBtn = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold hover:border-slate-500 dark:hover:border-slate-500 transition-colors';
  const segBtn = (on: boolean) => `h-8 px-3 rounded text-sm font-semibold transition-colors ${on ? 'bg-cyan-100 text-cyan-700 shadow-[inset_0_-2px_0_#2440D6] dark:bg-cyan-900 dark:text-cyan-300 dark:shadow-[inset_0_-2px_0_#93A5FF]' : 'text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100'}`;

  return (
    <div ref={containerRef} className={`${className}`}>
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <span className="w-12 h-12 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-400 rounded-xl flex items-center justify-center">
              <AlertTriangle size={22} />
            </span>
            <div>
              <h3 id="delete-title" className="m-0 font-display font-extrabold text-2xl">Supprimer la chanson ?</h3>
              <p className="mt-2 mb-0 text-slate-600 dark:text-slate-400">« {song.title} » sera définitivement supprimée.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-11 rounded-md border border-slate-300 dark:border-slate-700 font-semibold">Annuler</button>
              <button type="button" onClick={() => { if (onDelete) onDelete(song.id); setShowDeleteConfirm(false); }} className="flex-1 h-11 rounded-md bg-red-600 text-white font-semibold">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-scroll speed panel (visible while scrolling) */}
      {isScrolling && (
        <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 bg-stage text-[#ECEDE9] border border-[#2A2E36] rounded-xl p-4 shadow-2xl min-w-[240px] flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase text-[#A8ACB5]" style={{ letterSpacing: '0.08em' }}>Vitesse</span>
            <span className="font-mono font-bold text-[#93A5FF]">{scrollSpeed} / 7</span>
          </div>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={scrollSpeed}
            aria-label="Vitesse de défilement"
            onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
            className="w-full accent-[#FF6B54]"
          />
          <button type="button" onClick={() => setIsScrolling(false)} className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-[#FF6B54] text-stage font-bold">
            <Pause size={16} fill="currentColor" /> Arrêter
          </button>
        </div>
      )}

      {/* Top bar: breadcrumb + actions */}
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-8 py-3 border-b border-slate-200 dark:border-slate-800 text-sm">
        <nav aria-label="Fil d'Ariane" className="flex-1 min-w-0 truncate text-slate-500">
          {onBack ? (
            <button type="button" onClick={onBack} className="text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1">Bibliothèque</button>
          ) : (
            <span>Bibliothèque</span>
          )}
          <span aria-hidden="true"> / </span>
          <span className="text-ink dark:text-slate-100 font-semibold">{song.title}</span>
        </nav>
        <div className="flex items-center gap-1">
          {session && (
            <button
              type="button"
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={isFavorite}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 ${isFavorite ? 'text-ink dark:text-slate-100' : 'text-slate-500'}`}
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          {onEdit && (canEdit || song.shared_with_group_id) && (
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
              <Pencil size={16} /> Modifier
            </button>
          )}
          <button type="button" onClick={handleExportPDF} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
            <Download size={16} /> PDF
          </button>
          {canEdit && onDelete && (
            <button type="button" onClick={() => setShowDeleteConfirm(true)} aria-label="Supprimer la chanson" className="w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-400">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-wrap gap-12 items-start">
        <article className="flex-[999_1_520px] min-w-0 flex flex-col gap-7">
          <header className="flex flex-col gap-3.5">
            <h1 className="m-0 font-display font-extrabold text-[32px] md:text-[36px] leading-[1.02]" style={{ letterSpacing: '-0.03em' }}>{song.title}</h1>
            <p className="m-0 text-lg text-slate-600 dark:text-slate-400">{song.artist}</p>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              {displayKey && <KeyBadge size="md" outlined>{displayKey}</KeyBadge>}
              {song.bpm && <span className="font-mono font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5">{song.bpm} bpm</span>}
              {song.genres && song.genres.length > 0 && <span className="text-slate-600 dark:text-slate-400 px-1 py-0.5">{song.genres.join(' · ')}</span>}
              {song.tags && song.tags.length > 0 && <span className="text-slate-600 dark:text-slate-400 px-1 py-0.5">{song.tags.map(t => `#${t}`).join(' ')}</span>}
              {song.shared_with_group_id && <span className="text-slate-600 dark:text-slate-400 px-1 py-0.5">Partagée avec un groupe</span>}
            </div>
          </header>

          {/* Reading settings toolbar */}
          <div role="toolbar" aria-label="Réglages de lecture" className="flex flex-wrap gap-2 items-center p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            {onTransposeChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>Ton</span>
                <div
                  className={`inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900 ${isDegrees ? 'opacity-45' : ''}`}
                  title={isDegrees ? 'Sans effet en mode Degrés' : undefined}
                  style={isDegrees ? { opacity: 0.45 } : undefined}
                >
                  <button type="button" onClick={() => onTransposeChange(-1)} aria-label="Descendre d'un demi-ton" className="w-9 h-9 text-lg">−</button>
                  <button type="button" onClick={onTransposeReset} aria-label="Revenir au ton d'origine" className="min-w-[72px] h-9 px-2 border-x border-slate-200 dark:border-slate-700 font-mono font-bold text-sm">
                    {semiLabel}
                  </button>
                  <button type="button" onClick={() => onTransposeChange(1)} aria-label="Monter d'un demi-ton" className="w-9 h-9 text-lg">+</button>
                </div>
              </div>
            )}
            {onNotationModeChange && (
              <div role="group" aria-label="Notation des accords" className="inline-flex p-0.5 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900">
                <button type="button" aria-pressed={!isDegrees} onClick={() => onNotationModeChange(NotationMode.LETTERS)} className={segBtn(!isDegrees)}>Accords</button>
                <button type="button" aria-pressed={isDegrees} onClick={() => onNotationModeChange(NotationMode.DEGREES)} className={segBtn(isDegrees)}>Degrés</button>
              </div>
            )}
            <div role="group" aria-label="Disposition des accords" className="inline-flex p-0.5 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900">
              <button type="button" aria-pressed={!isColumns} onClick={() => setLayoutMode('classic')} className={segBtn(!isColumns)} title="Accords au-dessus des paroles">Classique</button>
              <button type="button" aria-pressed={isColumns} onClick={() => setLayoutMode('columns')} className={segBtn(isColumns)} title="Paroles à gauche, accords à droite">Colonnes</button>
            </div>
            <button type="button" onClick={() => setShowChords(!showChords)} aria-pressed={!showChords} className={toolBtn}>
              {showChords ? 'Paroles seules' : 'Afficher les accords'}
            </button>
            <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900">
              <button type="button" onClick={() => adjustFontSize(-0.1)} aria-label="Réduire le texte" className="w-9 h-9 inline-flex items-center justify-center"><ZoomOut size={16} /></button>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400 w-11 text-center border-x border-slate-200 dark:border-slate-700 leading-9">{Math.round(fontSize * 16)}px</span>
              <button type="button" onClick={() => adjustFontSize(0.1)} aria-label="Agrandir le texte" className="w-9 h-9 inline-flex items-center justify-center"><ZoomIn size={16} /></button>
            </div>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setIsScrolling(!isScrolling)}
              aria-pressed={isScrolling}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-md border text-sm font-semibold transition-colors ${
                isScrolling
                  ? 'border-red-500 bg-red-500 text-white dark:border-red-400 dark:bg-red-400 dark:text-stage'
                  : 'border-red-500 bg-slate-50 text-red-600 dark:border-red-400 dark:bg-slate-900 dark:text-red-400'
              }`}
            >
              {isScrolling ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {isScrolling ? `Défilement · ${scrollSpeed}` : 'Défilement'}
            </button>
          </div>

          {/* YouTube Embed */}
          {song.youtubeUrl && getYoutubeEmbedUrl(song.youtubeUrl) && (
            <div>
              <button
                type="button"
                onClick={() => setShowVideo(v => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100 mb-2"
              >
                {showVideo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showVideo ? 'Masquer la vidéo' : 'Afficher la vidéo'}
              </button>
              {showVideo && (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full rounded-xl border border-slate-200 dark:border-slate-800"
                    src={getYoutubeEmbedUrl(song.youtubeUrl)!}
                    title={`${song.title} - ${song.artist}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          )}

          {isColumns && isNarrowPortrait && showChords && !rotateHintDismissed && (
            <div role="status" className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-sm text-slate-600 dark:text-slate-300">
              <Smartphone size={18} className="shrink-0 rotate-90" aria-hidden="true" />
              <span className="flex-1">Tournez l'écran en paysage pour lire les colonnes plus confortablement.</span>
              <button type="button" onClick={() => setRotateHintDismissed(true)} aria-label="Masquer le conseil" className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Sheet, column layout: lyrics on the left, the chords of each line on the right */}
          {isColumns && (
            <div
              className={`select-text grid items-baseline gap-x-6 gap-y-1.5 transition-all ${isPinching ? 'duration-0' : 'duration-200'}`}
              style={{
                fontSize: `${fontSize * (isNarrowPortrait ? 0.82 : 1)}rem`,
                // Chords take up to 45% of the width and wrap beyond, so lyrics keep most of the room.
                gridTemplateColumns: showChords ? 'minmax(0, max-content) fit-content(45%)' : 'minmax(0, 1fr)',
              }}
            >
              {columnRows.map((row, i) => {
                if (row.type === 'section') {
                  return (
                    <div key={i} className="col-span-full flex items-center gap-2.5 mt-7 mb-1.5 first:mt-0 font-sans" style={{ fontSize: 16 }}>
                      <h2 className="m-0 font-sans text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>{row.label}</h2>
                    </div>
                  );
                }
                if (row.type === 'blank') return <div key={i} className="col-span-full h-3" aria-hidden="true" />;
                if (!showChords && !row.lyrics.trim()) return null;
                return (
                  <React.Fragment key={i}>
                    <span className="font-sans text-ink dark:text-slate-100">
                      {row.lyrics.trim() ? renderStyledText(row.lyrics.trim()) : '\u00a0'}
                    </span>
                    {showChords && (
                      <span className="flex flex-wrap gap-x-[0.9em] font-mono">
                        {row.chords.map((chord, j) => {
                          const display = processChord(chord);
                          return display ? (
                            <ChordTooltip key={j} chord={display}>
                              {renderChordDisplay(display, chord)}
                            </ChordTooltip>
                          ) : null;
                        })}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Sheet, classic layout */}
          {!isColumns && (
          <div className={`select-text transition-all ${usesChordLines ? 'font-mono' : 'font-sans'} ${isPinching ? 'duration-0' : 'duration-200'}`} style={{ fontSize: `${fontSize}rem` }}>
            {parsedLines.map((lineObj, lineIdx) => {
              if (lineObj.isSection) {
                return (
                  <div key={lineIdx} className="flex items-center gap-2.5 mt-8 mb-3 first:mt-0 font-sans" style={{ fontSize: 16 }}>
                    <h2 className="m-0 font-sans text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>{lineObj.text}</h2>
                  </div>
                );
              }
              const line = lineObj.segments;
              const isCurrentLineChords = isChordLine(line);
              const lineHasInlineChords = !isCurrentLineChords && line.some(seg => seg.chord !== null);
              if (!showChords && isCurrentLineChords) return null;

              return (
                <div key={lineIdx}
                  className={`flex flex-row items-end ${lineHasInlineChords && showChords ? 'flex-wrap mb-1.5' : `flex-nowrap overflow-x-auto whitespace-nowrap scrollbar-hide ${isCurrentLineChords && showChords ? 'mb-0' : 'mb-2'}`}`}
                  style={{ display: 'flex', flexDirection: 'row', flexWrap: lineHasInlineChords && showChords ? 'wrap' : 'nowrap', alignItems: 'flex-end', minHeight: '1.2em' }}
                >
                  {line.length === 0 || (line.length === 1 && !line[0].chord && !line[0].lyrics) ? (
                    <div className="h-6 w-full"></div>
                  ) : (
                    line.map((segment, segIdx) => {
                      const chordString = processChord(segment.chord);
                      const segmentStyle = { flexShrink: 0, flexBasis: 'auto', minWidth: isCurrentLineChords ? `${segment.span}ch` : 'auto' };

                      if (isCurrentLineChords) {
                        return (
                          <div key={segIdx} className="flex flex-row flex-nowrap flex-shrink-0" style={segmentStyle}>
                            {chordString && showChords && (
                              <ChordTooltip chord={chordString}>
                                {renderChordDisplay(chordString, segment.chord)}
                              </ChordTooltip>
                            )}
                            <span className="whitespace-pre text-slate-500">{segment.lyrics}</span>
                          </div>
                        );
                      }

                      // Inline chords: stack each chord above its syllable, as on the printed sheet.
                      if (lineHasInlineChords && showChords) {
                        if (!segment.chord && !segment.lyrics) return null;
                        return (
                          <span key={segIdx} className="inline-flex flex-col flex-shrink-0">
                            <span className="pr-2.5 leading-tight select-none min-h-[1.25em]" style={{ fontSize: '0.86em' }}>
                              {chordString ? (
                                <ChordTooltip chord={chordString}>
                                  {renderChordDisplay(chordString, segment.chord)}
                                </ChordTooltip>
                              ) : '\u00a0'}
                            </span>
                            <span className={`text-ink dark:text-slate-100 whitespace-pre ${lyricsFont}`}>
                              {renderStyledText(segment.lyrics) }
                            </span>
                          </span>
                        );
                      }

                      return (
                        <div key={segIdx} className="flex flex-row items-baseline flex-shrink-0" style={segmentStyle}>
                          <span className={`text-ink dark:text-slate-100 whitespace-pre ${lyricsFont}`}>
                            {renderStyledText(segment.lyrics)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
          )}

          {song.notes && song.notes.trim() && (
            <section className="flex flex-col gap-2 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950">
              <h2 className="m-0 font-sans text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>Notes</h2>
              <p className="m-0 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{song.notes}</p>
            </section>
          )}
        </article>

        <aside className="flex-[1_1_260px] min-w-0 flex flex-col gap-7">
          {chordsWithShape.length > 0 && notationMode === NotationMode.LETTERS && (
            <section className="flex flex-col gap-3">
              <h2 className="m-0 font-sans text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>Accords · guitare</h2>
              <div className="grid grid-cols-2 gap-3">
                {chordsWithShape.slice(0, 8).map(c => (
                  <figure key={c} className="m-0 p-2.5 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col items-center gap-1">
                    <figcaption className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{c}</figcaption>
                    <ChordVisualizer frets={GUITAR_DATA[c.split('/')[0]]} size={76} />
                  </figure>
                ))}
              </div>
              {songChords.length > 0 && (
                <p className="m-0 text-sm text-slate-500">{songChords.length} accord{songChords.length > 1 ? 's' : ''} dans la chanson</p>
              )}
            </section>
          )}

          <CommentsSection songId={song.id} session={session} onOpenAuth={onOpenAuth || (() => {})} />
        </aside>
      </div>
    </div>
  );
};

export default SongSheet;
