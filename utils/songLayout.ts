import { getSectionType } from './musicLogic';

/**
 * Mise en page d'une chanson en colonnes (police à chasse fixe), reproduisant
 * l'affichage de SongSheet pour l'export PDF :
 * - ligne d'accords seuls (`[Am]   [F]`) : chaque accord occupe la largeur de sa
 *   forme saisie, crochets compris, plus les espaces qui le suivent ;
 * - accords dans les paroles (`[C]Hello [G]world`) : l'accord est placé au-dessus
 *   de sa syllabe, sur une ligne à part ;
 * - les lignes de paroles trop longues passent à la ligne entre deux segments.
 */

export interface ChordPos {
  col: number;
  chord: string;
}

export type SongLayoutLine =
  | { type: 'section'; text: string }
  | { type: 'blank' }
  /** `chords` vide = paroles seules ; `lyrics` null = ligne d'accords seuls. */
  | { type: 'row'; chords: ChordPos[]; lyrics: string | null };

interface Segment {
  chord: string | null;
  lyrics: string;
}

const parseSegments = (line: string): Segment[] => {
  const parts = line.split(/\[(.*?)\]/g);
  const segments: Segment[] = [];
  if (parts[0]) segments.push({ chord: null, lyrics: parts[0] });
  for (let i = 1; i < parts.length; i += 2) {
    segments.push({ chord: parts[i], lyrics: parts[i + 1] || '' });
  }
  return segments;
};

/** Retire les marqueurs `*italique*` (affichés sans astérisques sur le site). */
const stripMarkup = (text: string): string => text.replace(/\*(.*?)\*/g, '$1');

const layoutChordOnlyLine = (segments: Segment[], mapChord: (c: string) => string): SongLayoutLine => {
  const chords: ChordPos[] = [];
  let col = 0;
  for (const seg of segments) {
    if (seg.chord === null) {
      col += seg.lyrics.length;
      continue;
    }
    const shown = mapChord(seg.chord);
    chords.push({ col, chord: shown });
    // Comme `min-width: span ch` sur le site : forme saisie + crochets + espaces suivants.
    const span = seg.chord.length + 2 + seg.lyrics.length;
    col += Math.max(span, shown.length + seg.lyrics.length);
  }
  return { type: 'row', chords, lyrics: null };
};

const layoutLyricsLine = (segments: Segment[], mapChord: (c: string) => string, maxCols: number): SongLayoutLine[] => {
  const rows: SongLayoutLine[] = [];
  let chords: ChordPos[] = [];
  let lyrics = '';

  const flush = () => {
    rows.push({ type: 'row', chords, lyrics: lyrics.replace(/\s+$/, '') });
    chords = [];
    lyrics = '';
  };

  segments.forEach((seg, index) => {
    const shown = seg.chord !== null ? mapChord(seg.chord) : null;
    let text = stripMarkup(seg.lyrics);
    const isLast = index === segments.length - 1;
    // Le segment est aussi large que son accord (+ un espace) ou que sa syllabe.
    const width = Math.max(text.length, shown ? shown.length + (isLast ? 0 : 1) : 0);

    if (lyrics.length > 0 && lyrics.length + width > maxCols) {
      flush();
      text = text.replace(/^\s+/, '');
    }
    if (shown) chords.push({ col: lyrics.length, chord: shown });
    lyrics += text.padEnd(width, ' ');
  });
  flush();
  return rows;
};

/** Coupe une ligne de paroles sans accords aux espaces pour tenir dans `maxCols`. */
const wrapPlainLyrics = (text: string, maxCols: number): string[] => {
  if (text.length <= maxCols) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > maxCols) {
    let cut = rest.lastIndexOf(' ', maxCols);
    if (cut <= 0) cut = maxCols;
    out.push(rest.slice(0, cut).replace(/\s+$/, ''));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest) out.push(rest);
  return out;
};

export const layoutSongContent = (
  content: string,
  mapChord: (chord: string) => string,
  maxCols: number
): SongLayoutLine[] => {
  const out: SongLayoutLine[] = [];
  for (const line of content.split(/\r?\n/)) {
    const section = getSectionType(line);
    if (section) {
      out.push({ type: 'section', text: section });
      continue;
    }
    const segments = parseSegments(line);
    if (segments.length === 0 || segments.every(s => s.chord === null && s.lyrics.trim() === '')) {
      out.push({ type: 'blank' });
      continue;
    }
    const hasChord = segments.some(s => s.chord !== null);
    if (!hasChord) {
      wrapPlainLyrics(stripMarkup(line).replace(/\s+$/, ''), maxCols)
        .forEach(text => out.push({ type: 'row', chords: [], lyrics: text }));
    } else if (segments.every(s => s.lyrics.trim() === '')) {
      out.push(layoutChordOnlyLine(segments, mapChord));
    } else {
      out.push(...layoutLyricsLine(segments, mapChord, maxCols));
    }
  }
  return out;
};

/** Construit la ligne d'accords en texte (pour les tests et le débogage). */
export const chordRowText = (chords: ChordPos[]): string => {
  let row = '';
  for (const { col, chord } of chords) {
    row = row.padEnd(col, ' ');
    if (row.length > col) row += ' ';
    row += chord;
  }
  return row;
};
