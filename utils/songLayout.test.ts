import { describe, it, expect } from 'vitest';
import { layoutSongContent, chordRowText, SongLayoutLine } from './songLayout';
import { transpose } from './musicLogic';

const id = (c: string) => c;
const rows = (lines: SongLayoutLine[]) =>
  lines.map(l => (l.type === 'row' ? [chordRowText(l.chords), l.lyrics] : l.type));

describe('layoutSongContent', () => {
  it("garde l'espacement des accords collés, comme le site (crochets comptés)", () => {
    const [line] = layoutSongContent('[Am][F][C][G]', id, 80);
    expect(line.type === 'row' && chordRowText(line.chords)).toBe('Am  F  C  G');
  });

  it('respecte les espaces saisis entre accords', () => {
    const [line] = layoutSongContent('[Am]           [F]    [C]', id, 80);
    expect(line.type === 'row' && line.chords.map(c => c.col)).toEqual([0, 15, 22]);
    expect(line.type === 'row' && line.lyrics).toBeNull();
  });

  it('place les accords au-dessus de leur syllabe', () => {
    expect(rows(layoutSongContent('[C]Hello [G]darkness my [Am]old friend', id, 80))).toEqual([
      ['C     G           Am', 'Hello darkness my old friend'],
    ]);
  });

  it("élargit une syllabe plus courte que son accord", () => {
    expect(rows(layoutSongContent('[Cmaj7]a[G]b', id, 80))).toEqual([['Cmaj7 G', 'a     b']]);
  });

  it('garde les colonnes de la forme saisie après transposition', () => {
    const [line] = layoutSongContent('[A]   [D]', c => transpose(c, 1), 80);
    expect(line.type === 'row' && chordRowText(line.chords)).toBe('A#    D#');
  });

  it('coupe les lignes trop longues entre deux segments', () => {
    const out = rows(layoutSongContent('[C]un deux [G]trois quatre', id, 12));
    expect(out).toEqual([['C', 'un deux'], ['G', 'trois quatre']]);
  });

  it('reconnaît sections, lignes vides et paroles seules', () => {
    expect(rows(layoutSongContent('[Intro]\n\nJuste des mots *doux*', id, 80))).toEqual([
      'section', 'blank', ['', 'Juste des mots doux'],
    ]);
  });
});
