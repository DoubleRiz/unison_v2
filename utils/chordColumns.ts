import { SECTION_NAMES, getSectionType, transpose, transposeContent } from './musicLogic';
import type { SongDisplayMode } from '../types';

/*
 * Two ways of writing a song:
 * - classic: chords placed above the lyrics ([C] on a chord line, or inline [C]Hello)
 * - columns: lyrics on the left, the chords of that line on the right
 *     Comme un souffle fragile,     Em  Am
 */
export type { SongDisplayMode };

// A chord written without brackets. Strict on purpose: it must not match ordinary words.
const BARE_CHORD = /^[A-G][#b]?(?:maj|min|m|M|dim|aug|sus|°|ø|\+)?\d*(?:(?:sus|add|maj|b|#)\d+|sus)*(?:\/[A-G][#b]?)?$/;
const BRACKET_TOKEN = /^\[([^\]]+)\]$/;

// Section headers written without brackets: "Refrain", "Strophe 1", "• Refrain", "Couplet 2 :".
const BARE_SECTION = new RegExp(`^(?:[•*-]\\s*)?((?:${SECTION_NAMES})(?:\\s*\\d+)?)\\s*:?\\s*$`, 'i');
// A verse number alone on its line: "1", "2."
const NUMBER_SECTION = /^\s*(\d{1,2})\.?\s*$/;

const isBracketChord = (token: string): boolean => {
  const m = token.match(BRACKET_TOKEN);
  return !!m && /^[A-G]/.test(m[1]);
};

export const isBareChord = (token: string): boolean => BARE_CHORD.test(token);

// A stray full stop after a chord ("B7.", "Em.") is a frequent slip in the library: tolerate it.
const stripStop = (token: string): string => token.replace(/\.$/, '');

const isChordToken = (token: string): boolean => isBracketChord(token) || isBareChord(stripStop(token));

const chordName = (token: string): string => stripStop(token.match(BRACKET_TOKEN)?.[1] ?? token);

/** Removes the stray full stop inside bracketed chords too ("[A.]" → "[A]"), whatever the format. */
export const cleanChordTypos = (content: string): string => content.replace(/\[([A-G][^\]\s]*?)\.\]/g, '[$1]');

type LineInfo =
  | { kind: 'section'; label: string }
  | { kind: 'blank' }
  /** lyrics on the left, chords at `start` on the right */
  | { kind: 'column'; lyrics: string; chords: string[]; start: number }
  /** a line holding only chords */
  | { kind: 'chords'; chords: string[]; start: number; bracketed: boolean }
  /** lyrics with [chords] inside them */
  | { kind: 'inline'; lyrics: string; chords: string[] }
  | { kind: 'lyrics'; text: string };

/**
 * Finds the trailing run of chord tokens of a line. Returns the index where the chords start
 * (0 when the line holds only chords), or null. `minGap` is the number of spaces required between
 * the lyrics and the chords; a tab always counts as a gap.
 */
const findTrailingChords = (line: string, minGap: number): { start: number; tokens: string[] } | null => {
  const tokens: { text: string; index: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) tokens.push({ text: m[0], index: m.index });
  if (tokens.length === 0) return null;

  let first = tokens.length;
  while (first > 0 && isChordToken(tokens[first - 1].text)) first--;
  if (first === tokens.length) return null;

  for (let k = first; k < tokens.length; k++) {
    if (k > 0) {
      const prev = tokens[k - 1];
      const gap = line.slice(prev.index + prev.text.length, tokens[k].index);
      if (gap.length < minGap && !gap.includes('\t')) continue;
    }
    return { start: tokens[k].index, tokens: tokens.slice(k).map(t => t.text) };
  }
  return null;
};

const sectionLabel = (line: string): string | null => {
  const bracketed = getSectionType(line);
  if (bracketed) return bracketed;
  const bare = line.trim().match(BARE_SECTION);
  if (bare) return bare[1].replace(/\s+/g, ' ');
  const num = line.match(NUMBER_SECTION);
  if (num) return `Strophe ${num[1]}`;
  return null;
};

const classifyLines = (content: string): LineInfo[] => {
  const lines = content.split(/\r?\n/);

  // First pass, strict (at least two spaces between lyrics and chords): find the column where
  // chords usually start, so that a line whose lyrics run long and leave a single space can still
  // be read as a column line when its chords sit on that same column.
  const strictStarts = new Map<number, number>();
  lines.forEach(line => {
    if (sectionLabel(line)) return;
    const found = findTrailingChords(line, 2);
    if (found && line.slice(0, found.start).trim() !== '') strictStarts.set(found.start, (strictStarts.get(found.start) || 0) + 1);
  });
  let dominant = -1;
  let best = 1; // needs at least two lines on the same column
  strictStarts.forEach((count, start) => { if (count > best) { best = count; dominant = start; } });

  return lines.map((line): LineInfo => {
    if (line.trim() === '') return { kind: 'blank' };
    const label = sectionLabel(line);
    if (label) return { kind: 'section', label };

    let found = findTrailingChords(line, 2);
    if (!found && dominant > 0) {
      const loose = findTrailingChords(line, 1);
      if (loose && Math.abs(loose.start - dominant) <= 1) found = loose;
    }
    if (found) {
      const chords = found.tokens.map(chordName);
      if (found.start === 0 || line.slice(0, found.start).trim() === '') {
        return { kind: 'chords', chords, start: found.start, bracketed: found.tokens.every(t => t.startsWith('[')) };
      }
      return { kind: 'column', lyrics: line.slice(0, found.start).trimEnd(), chords, start: found.start };
    }

    if (/\[[^\]]+\]/.test(line)) {
      const chords: string[] = [];
      const lyrics = line.replace(/\[([^\]]+)\]/g, (whole, inner: string) => {
        if (/^[A-G]/.test(inner)) { chords.push(inner); return ''; }
        return whole;
      });
      if (chords.length > 0) return { kind: 'inline', lyrics: lyrics.trimEnd(), chords };
    }
    return { kind: 'lyrics', text: line.trimEnd() };
  });
};

/** Tells how a song is written, from its content. */
export const detectSongFormat = (content: string): SongDisplayMode => {
  const infos = classifyLines(content);
  let columns = 0;
  let classic = 0;
  infos.forEach((info, i) => {
    if (info.kind === 'column') columns++;
    else if (info.kind === 'inline') classic++;
    else if (info.kind === 'chords' && infos[i + 1]?.kind === 'lyrics') classic++;
  });
  return columns > 0 && columns >= classic ? 'columns' : 'classic';
};

export type ChordRow =
  | { type: 'section'; label: string }
  | { type: 'blank' }
  /** `source` keeps the original classic lines, so a classic song renders back exactly as written. */
  | { type: 'line'; lyrics: string; chords: string[]; source?: string[] };

/** Reads a song (either format) as rows: one lyric line and the chords that go with it. */
export const parseSongRows = (content: string): ChordRow[] => {
  const infos = classifyLines(content);
  const lines = content.split(/\r?\n/);
  const isClassic = detectSongFormat(content) === 'classic';
  const rows: ChordRow[] = [];

  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    const source = isClassic ? [lines[i]] : undefined;
    switch (info.kind) {
      case 'section': rows.push({ type: 'section', label: info.label }); break;
      case 'blank': rows.push({ type: 'blank' }); break;
      case 'column': rows.push({ type: 'line', lyrics: info.lyrics, chords: info.chords }); break;
      case 'inline': rows.push({ type: 'line', lyrics: info.lyrics, chords: info.chords, source }); break;
      case 'lyrics': rows.push({ type: 'line', lyrics: info.text, chords: [], source }); break;
      case 'chords': {
        const next = infos[i + 1];
        if (isClassic && next?.kind === 'lyrics') {
          rows.push({ type: 'line', lyrics: next.text, chords: info.chords, source: [lines[i], lines[i + 1]] });
          i++;
        } else {
          rows.push({ type: 'line', lyrics: '', chords: info.chords, source: isClassic && info.bracketed ? source : undefined });
        }
        break;
      }
    }
  }
  return rows;
};

/** Spreads chords evenly over the length of the lyrics, as a classic chord line. */
export const spreadChords = (lyrics: string, chords: string[]): string => {
  const length = Math.max(lyrics.length, 1);
  let out = '';
  chords.forEach((chord, i) => {
    const target = Math.round((i * length) / chords.length);
    const pos = out.length === 0 ? target : Math.max(target, out.length + 1);
    out = out.padEnd(pos, ' ') + `[${chord}]`;
  });
  return out;
};

export const rowsToClassic = (rows: ChordRow[]): string => rows.flatMap((row): string[] => {
  if (row.type === 'section') return [`[${row.label}]`];
  if (row.type === 'blank') return [''];
  if (row.source) return row.source;
  if (row.chords.length === 0) return [row.lyrics];
  if (row.lyrics.trim() === '') return [row.chords.map(c => `[${c}]`).join('  ')];
  return [spreadChords(row.lyrics, row.chords), row.lyrics];
}).join('\n');

export const rowsToColumns = (rows: ChordRow[]): string => {
  const widest = rows.reduce((max, row) =>
    row.type === 'line' && row.chords.length > 0 ? Math.max(max, row.lyrics.length) : max, 0);
  const column = widest > 0 ? widest + 4 : 0;
  const formatChord = (c: string) => (isBareChord(c) ? c : `[${c}]`);

  return rows.map(row => {
    if (row.type === 'section') return `[${row.label}]`;
    if (row.type === 'blank') return '';
    if (row.chords.length === 0) return row.lyrics;
    return row.lyrics.padEnd(column, ' ') + row.chords.map(formatChord).join('  ');
  }).join('\n');
};

/** Rewrites the song text in the other format. */
export const convertSongContent = (content: string, to: SongDisplayMode): string => {
  const rows = parseSongRows(content);
  if (to === 'columns') return rowsToColumns(rows);
  // Classic → classic keeps the text untouched; columns → classic rebuilds it.
  return detectSongFormat(content) === 'classic' ? content : rowsToClassic(rows);
};

/** The song as classic text, ready for the classic renderers (sheet, PDF). */
export const toClassicContent = (content: string): string => cleanChordTypos(convertSongContent(content, 'classic'));

/**
 * Transposes a song, including chords written without brackets on the right of a column line
 * (transposeContent only knows [bracketed] chords).
 */
export const transposeSongContent = (content: string, semitones: number): string => {
  if (semitones === 0) return cleanChordTypos(content);
  const infos = classifyLines(content);
  const lines = content.split(/\r?\n/).map((line, i) => {
    const info = infos[i];
    if (info.kind !== 'column' && info.kind !== 'chords') return line;
    return line.slice(0, info.start) + line.slice(info.start).replace(/\S+/g, tok =>
      tok.startsWith('[') ? tok : transpose(stripStop(tok), semitones));
  });
  return transposeContent(cleanChordTypos(lines.join('\n')), semitones);
};

/** Unique chords of a song, in order of appearance (either format). */
export const songChordList = (content: string): string[] => {
  const found: string[] = [];
  parseSongRows(content).forEach(row => {
    if (row.type !== 'line') return;
    row.chords.forEach(c => { if (!found.includes(c)) found.push(c); });
  });
  return found;
};

/** Column text split in two aligned lists, for the two-pane editor: lyrics (or section) | chords. */
export const splitColumns = (content: string): { lyrics: string[]; chords: string[] } => {
  const infos = classifyLines(content);
  const lines = content.split(/\r?\n/);
  const lyrics: string[] = [];
  const chords: string[] = [];
  infos.forEach((info, i) => {
    if (info.kind === 'column') { lyrics.push(info.lyrics); chords.push(info.chords.join('  ')); }
    else if (info.kind === 'chords') { lyrics.push(''); chords.push(info.chords.join('  ')); }
    else { lyrics.push(lines[i].trimEnd()); chords.push(''); }
  });
  return { lyrics, chords };
};

/** Joins the two panes back into column text, chords aligned on one column. */
export const joinColumns = (lyrics: string[], chords: string[]): string => {
  const count = Math.max(lyrics.length, chords.length);
  let widest = 0;
  for (let i = 0; i < count; i++) if ((chords[i] ?? '').trim()) widest = Math.max(widest, (lyrics[i] ?? '').trimEnd().length);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const left = (lyrics[i] ?? '').trimEnd();
    const right = (chords[i] ?? '').trim();
    out.push(right ? left.padEnd(widest + 4, ' ') + right : left);
  }
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
};

/**
 * Keeps the other pane aligned when lines are added or removed in one pane: the same number of
 * lines is inserted (empty) or removed at the same place. Removed lines that held text are merged
 * into the line above, so no chord is lost.
 */
export const syncPaneLines = (before: string[], after: string[], other: string[]): string[] => {
  const delta = after.length - before.length;
  if (delta === 0) return other;
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix && suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix++;
  const next = [...other];
  while (next.length < before.length) next.push('');
  if (delta > 0) {
    next.splice(prefix + (before.length - prefix - suffix), 0, ...Array(delta).fill(''));
  } else {
    const at = prefix + (after.length - prefix - suffix);
    const removed = next.splice(at, -delta).filter(l => l.trim() !== '');
    if (removed.length > 0) {
      const target = Math.max(at - 1, 0);
      if (next.length === 0) next.push('');
      next[target] = [next[target], ...removed].filter(l => l.trim() !== '').join('  ');
    }
  }
  return next;
};
