import { Song } from '../types';

/**
 * Colonnes chargées pour la liste des chansons : tout sauf le texte (`content`)
 * et les notes, chargés à l'ouverture d'une chanson (voir `loadSongDetails`).
 */
export const SONG_LIST_COLUMNS =
  'id, user_id, title, artist, bpm, original_key, display_mode, youtube_url, audio_url, is_public, shared_with_group_id, genres, tags, forked_from, created_at, updated_at';

/** Colonnes chargées à l'ouverture d'une chanson. */
export const SONG_DETAIL_COLUMNS = 'id, content, notes';

/** Taille de page : plafond par défaut de l'API Supabase (`max_rows`). */
export const SONG_PAGE_SIZE = 1000;

/** Convertit une ligne `songs` (colonnes de liste) en `Song` sans contenu. */
export const mapSongListRow = (row: any, favoriteIds: Set<string>): Song => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  artist: row.artist,
  bpm: row.bpm,
  key: row.original_key,
  content: '',
  contentLoaded: false,
  displayMode: row.display_mode ?? null,
  youtubeUrl: row.youtube_url,
  audioUrl: row.audio_url,
  is_public: row.is_public,
  is_favorite: favoriteIds.has(row.id),
  shared_with_group_id: row.shared_with_group_id,
  genres: row.genres || [],
  tags: row.tags || [],
  forked_from: row.forked_from,
});

/** Une chanson dont le contenu reste à charger. */
export const needsContent = (song: Song): boolean => song.contentLoaded === false;

/**
 * Parcourt une requête Supabase page par page (`range`) jusqu'à la dernière.
 * Une page incomplète signale la fin : suppose `max_rows` ≥ SONG_PAGE_SIZE côté API.
 */
export const fetchAllPages = async (
  buildPage: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>,
  onPage: (rows: any[]) => void,
  isStale: () => boolean = () => false
) => {
  for (let from = 0; ; ) {
    const { data, error } = await buildPage(from, from + SONG_PAGE_SIZE - 1);
    if (error) throw error;
    if (isStale()) return;
    const rows = data || [];
    if (rows.length > 0) onPage(rows);
    if (rows.length < SONG_PAGE_SIZE) return;
    from += rows.length;
  }
};
