import { describe, it, expect } from 'vitest';
import { fetchAllPages, mapSongListRow, needsContent, SONG_PAGE_SIZE, SONG_LIST_COLUMNS } from './songRows';

const fakeTable = (total: number) => {
  const rows = Array.from({ length: total }, (_, i) => ({ id: `s${i}` }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, calls };
};

describe('fetchAllPages', () => {
  it('charge au-delà de 1000 lignes, page par page', async () => {
    const { page, calls } = fakeTable(2 * SONG_PAGE_SIZE + 37);
    const seen: any[] = [];
    await fetchAllPages(page, (r) => seen.push(...r));
    expect(seen).toHaveLength(2 * SONG_PAGE_SIZE + 37);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("s'arrête après une page vide quand le total est un multiple de la taille de page", async () => {
    const { page, calls } = fakeTable(SONG_PAGE_SIZE);
    const seen: any[] = [];
    await fetchAllPages(page, (r) => seen.push(...r));
    expect(seen).toHaveLength(SONG_PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("s'interrompt si le chargement est dépassé", async () => {
    const { page, calls } = fakeTable(3 * SONG_PAGE_SIZE);
    let stale = false;
    await fetchAllPages(page, () => { stale = true; }, () => stale);
    expect(calls).toHaveLength(2);
  });

  it("propage les erreurs Supabase", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: new Error('boom') }), () => {})).rejects.toThrow('boom');
  });
});

describe('liste allégée', () => {
  it("ne demande pas le texte des chansons", () => {
    expect(SONG_LIST_COLUMNS).not.toMatch(/\bcontent\b/);
    expect(SONG_LIST_COLUMNS).not.toMatch(/\bnotes\b/);
  });

  it('marque les chansons comme à compléter', () => {
    const song = mapSongListRow({ id: 'a', title: 'T', artist: 'A', original_key: 'C' }, new Set(['a']));
    expect(needsContent(song)).toBe(true);
    expect(song.is_favorite).toBe(true);
    expect(needsContent({ ...song, contentLoaded: undefined })).toBe(false);
  });
});
