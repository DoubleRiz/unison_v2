import { describe, expect, it } from 'vitest';
import {
  convertSongContent,
  detectSongFormat,
  parseSongRows,
  joinColumns,
  songChordList,
  splitColumns,
  syncPaneLines,
  spreadChords,
  toClassicContent,
  transposeSongContent,
} from './chordColumns';

// Excerpts from songs of the library, written in columns.
const BARE_COLUMNS = `Comme un souffle fragile,     Em  Am
Ta parole se donne.           B7  Em
Strophe 1
1. Ta parole est murmure.     Em  Am
Comme un secret d'amour,      D7  G`;

const BRACKET_COLUMNS = `[Refrain]
Tournez les yeux          [D] [Bm7]
Vers le Seigneur          [F#m7]
Et rayonnez de joie       [G] [A]  [D]`;

const CLASSIC = `[Verse 1]
[Am]           [F]    [C]
Hello darkness my old friend
[G]I've come to talk with [Am]you again`;

describe('detectSongFormat', () => {
  it('reads column songs, with or without brackets', () => {
    expect(detectSongFormat(BARE_COLUMNS)).toBe('columns');
    expect(detectSongFormat(BRACKET_COLUMNS)).toBe('columns');
  });

  it('reads classic songs', () => {
    expect(detectSongFormat(CLASSIC)).toBe('classic');
    expect(detectSongFormat('Just lyrics\nno chords at all')).toBe('classic');
  });

  it('does not mistake words for chords', () => {
    expect(detectSongFormat('Gloire à Dieu   Dieu est bon\nChrist est là   Esprit')).toBe('classic');
  });
});

describe('parseSongRows', () => {
  it('splits column lines into lyrics and chords', () => {
    const rows = parseSongRows(BARE_COLUMNS);
    expect(rows[0]).toEqual({ type: 'line', lyrics: 'Comme un souffle fragile,', chords: ['Em', 'Am'] });
    expect(rows[2]).toEqual({ type: 'section', label: 'Strophe 1' });
    expect(rows[3]).toMatchObject({ lyrics: '1. Ta parole est murmure.', chords: ['Em', 'Am'] });
  });

  it('strips brackets from column chords', () => {
    const rows = parseSongRows(BRACKET_COLUMNS);
    expect(rows[0]).toEqual({ type: 'section', label: 'Refrain' });
    expect(rows[3]).toMatchObject({ lyrics: 'Et rayonnez de joie', chords: ['G', 'A', 'D'] });
  });

  it('recognises bare section headers', () => {
    const rows = parseSongRows('• Refrain\nMon espoir est en toi  C\nCouplet 2 :\nA toi   C\n1\nJe veux chanter   G');
    expect(rows.filter(r => r.type === 'section')).toEqual([
      { type: 'section', label: 'Refrain' },
      { type: 'section', label: 'Couplet 2' },
      { type: 'section', label: 'Strophe 1' },
    ]);
  });

  it('tolerates a full stop after a chord', () => {
    const rows = parseSongRows('Ta parole se donne.           B7.  Em\nComme un vase d\'argile,       C7. Am6');
    expect(rows[0]).toMatchObject({ lyrics: 'Ta parole se donne.', chords: ['B7', 'Em'] });
    expect(rows[1]).toMatchObject({ lyrics: "Comme un vase d'argile,", chords: ['C7', 'Am6'] });
  });

  it('tolerates a full stop inside brackets, in either format', () => {
    expect(parseSongRows('Ta parole se donne.     [B7.] [Em]')[0]).toMatchObject({ chords: ['B7', 'Em'] });
    expect(toClassicContent('[A.]      [D]\nJ\'étais ébloui')).toBe('[A]      [D]\nJ\'étais ébloui');
    expect(transposeSongContent('[A.]  [D]\nÉbloui', 2)).toBe('[B]  [E]\nÉbloui');
  });

  it('accepts a single space when the chords sit on the usual column', () => {
    const content = `Christ est venu,       D
Christ est né,         A
Christ est ressuscité, D G`;
    expect(parseSongRows(content)[2]).toMatchObject({ lyrics: 'Christ est ressuscité,', chords: ['D', 'G'] });
  });

  it('merges a classic chord line with the lyrics under it', () => {
    const rows = parseSongRows(CLASSIC);
    expect(rows[1]).toMatchObject({ lyrics: 'Hello darkness my old friend', chords: ['Am', 'F', 'C'] });
    expect(rows[2]).toMatchObject({ lyrics: "I've come to talk with you again", chords: ['G', 'Am'] });
  });
});

describe('spreadChords', () => {
  it('places chords at regular intervals over the lyrics', () => {
    expect(spreadChords('Comme un souffle fragile,', ['Em', 'Am'])).toBe('[Em]         [Am]');
  });

  it('keeps a space between chords on short lyrics', () => {
    expect(spreadChords('Oh', ['C', 'G', 'Am'])).toBe('[C] [G] [Am]');
  });
});

describe('convertSongContent', () => {
  it('turns columns into classic, chords above with regular spacing', () => {
    expect(convertSongContent('Tournez les yeux     [D] [Bm7]\nRefrain\nVers le Seigneur     F#m7', 'classic')).toBe(
      '[D]     [Bm7]\nTournez les yeux\n[Refrain]\n[F#m7]\nVers le Seigneur'
    );
  });

  it('turns classic into columns, chords gathered on the right', () => {
    expect(convertSongContent(CLASSIC, 'columns')).toBe(
      `[Verse 1]
Hello darkness my old friend        Am  F  C
I've come to talk with you again    G  Am`
    );
  });

  it('round-trips columns → classic → columns', () => {
    const back = convertSongContent(convertSongContent(BARE_COLUMNS, 'classic'), 'columns');
    expect(parseSongRows(back)).toEqual(parseSongRows(BARE_COLUMNS));
  });

  it('leaves classic text untouched when asked for classic', () => {
    expect(toClassicContent(CLASSIC)).toBe(CLASSIC);
  });
});

describe('transposeSongContent', () => {
  it('transposes bare chords of column lines', () => {
    expect(transposeSongContent('Comme un souffle fragile,     Em  Am', 2)).toBe('Comme un souffle fragile,     F#m  Bm');
  });

  it('transposes bracketed chords and leaves lyrics alone', () => {
    expect(transposeSongContent('A toi la gloire     [D]  [A]\n[Refrain]', 2)).toBe('A toi la gloire     [E]  [B]\n[Refrain]');
    expect(transposeSongContent('Dieu est bon, Amen', 2)).toBe('Dieu est bon, Amen');
  });
});

describe('songChordList', () => {
  it('lists unique chords of either format', () => {
    expect(songChordList(BRACKET_COLUMNS)).toEqual(['D', 'Bm7', 'F#m7', 'G', 'A']);
    expect(songChordList(CLASSIC)).toEqual(['Am', 'F', 'C', 'G']);
  });
});

describe('two-pane column editor', () => {
  it('splits and joins column text', () => {
    const { lyrics, chords } = splitColumns(BARE_COLUMNS);
    expect(lyrics[0]).toBe('Comme un souffle fragile,');
    expect(chords[0]).toBe('Em  Am');
    expect(lyrics[2]).toBe('Strophe 1');
    expect(chords[2]).toBe('');
    expect(parseSongRows(joinColumns(lyrics, chords))).toEqual(parseSongRows(BARE_COLUMNS));
  });

  it('inserts an empty chord line when a lyric line is split', () => {
    const before = ['Ligne un', 'Ligne deux'];
    expect(syncPaneLines(before, ['Ligne', ' un', 'Ligne deux'], ['C', 'G'])).toEqual(['C', '', 'G']);
    expect(syncPaneLines(before, ['', 'Ligne un', 'Ligne deux'], ['C', 'G'])).toEqual(['', 'C', 'G']);
  });

  it('removes the matching line, merging its chords upward', () => {
    expect(syncPaneLines(['a', 'b', 'c'], ['ab', 'c'], ['C', 'G', 'D'])).toEqual(['C  G', 'D']);
    expect(syncPaneLines(['a', '', 'c'], ['a', 'c'], ['C', '', 'D'])).toEqual(['C', 'D']);
  });
});
