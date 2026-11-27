
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Song, Group } from '../types';
import { SONG_LIST_COLUMNS, SONG_DETAIL_COLUMNS, fetchAllPages, mapSongListRow, needsContent } from '../utils/songRows';

// Nombre d'identifiants par requête `in(...)` (longueur d'URL raisonnable).
const DETAIL_CHUNK_SIZE = 150;


export const useAppData = (session: any, currentView: string, currentSongId: string | null) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publicSongData, setPublicSongData] = useState<Song | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch Public Song Details (Single)
  useEffect(() => {
    if (currentView === 'main' && currentSongId && !session) {
      fetchPublicSongDetails(currentSongId);
    }
  }, [currentSongId, currentView, session]);

  const fetchPublicSongDetails = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .eq('is_public', true)
      .single();
    
    if (data && !error) {
      const s: Song = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        artist: data.artist,
        bpm: data.bpm,
        key: data.original_key,
        content: data.content,
        notes: data.notes,
        youtubeUrl: data.youtube_url,
        audioUrl: data.audio_url,
        is_public: data.is_public,
        is_favorite: false,
        genres: data.genres || [],
        tags: data.tags || []
      };
      setPublicSongData(s);
    }
    setLoading(false);
  };

  const fetchGroups = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('group_members')
      .select('*, groups(*)')
      .eq('user_id', session.user.id);
    
    if (!error && data) {
      const accepted = data.filter((m: any) => m.status === 'accepted').map((m: any) => m.groups).filter(Boolean);
      const pending = data.filter((m: any) => m.status === 'pending');
      setGroups(accepted);
      setPendingInvitesCount(pending.length);
    }
  }, [session]);

  const fetchUserProfile = useCallback(async () => {
    if (!session) return;
    // La colonne users.is_admin n'est pas lisible directement (RLS) : on passe par la fonction.
    const { data, error } = await supabase.rpc('is_admin');
    if (!error) {
      setIsAdmin(data === true);
    }
  }, [session]);

  // Incrémenté à chaque chargement : un chargement dépassé (changement de session) s'arrête.
  const songsFetchId = useRef(0);

  const fetchSongs = useCallback(async () => {
    const fetchId = ++songsFetchId.current;
    const isStale = () => fetchId !== songsFetchId.current;
    try {
      // Favoris d'abord (paginés eux aussi), pour marquer les chansons dès la première page.
      const favoriteIds = new Set<string>();
      if (session) {
        await fetchAllPages(
          (from, to) => supabase
            .from('favorites')
            .select('song_id')
            .eq('user_id', session.user.id)
            .order('song_id', { ascending: true })
            .range(from, to),
          (rows) => rows.forEach((f: any) => favoriteIds.add(f.song_id)),
          isStale
        );
      }
      if (isStale()) return;

      // Liste allégée (sans content/notes), chargée page par page : la bibliothèque
      // s'affiche dès la première page puis se complète.
      const loaded: Song[] = [];
      await fetchAllPages(
        (from, to) => {
          let query = supabase.from('songs').select(SONG_LIST_COLUMNS);
          query = session
            ? query.order('updated_at', { ascending: false })
            : query.eq('is_public', true).order('created_at', { ascending: false });
          // Départage stable entre pages.
          return query.order('id', { ascending: true }).range(from, to);
        },
        (rows) => {
          loaded.push(...rows.map((row: any) => mapSongListRow(row, favoriteIds)));
          const page = [...loaded];
          // Garde le contenu déjà chargé (chanson ouverte) : sinon elle se viderait au rechargement.
          setSongs(prev => {
            const withContent = new Map(prev.filter(s => !needsContent(s)).map(s => [s.id, s]));
            return page.map(s => {
              const full = withContent.get(s.id);
              return full ? { ...s, content: full.content, notes: full.notes, contentLoaded: true } : s;
            });
          });
        },
        isStale
      );
      if (!isStale() && loaded.length === 0) setSongs([]);
    } catch (error: any) {
      console.error('Error fetching songs:', error.message);
    }
  }, [session]);

  /**
   * Charge le contenu complet (content, notes) des chansons qui ne l'ont pas encore,
   * met à jour la liste et renvoie les chansons complétées.
   */
  const loadSongDetails = useCallback(async (targets: Song[]): Promise<Song[]> => {
    const missing = [...new Set(targets.filter(needsContent).map(s => s.id))];
    if (missing.length === 0) return targets;

    const details = new Map<string, { content: string; notes?: string }>();
    for (let i = 0; i < missing.length; i += DETAIL_CHUNK_SIZE) {
      const ids = missing.slice(i, i + DETAIL_CHUNK_SIZE);
      const { data, error } = await supabase.from('songs').select(SONG_DETAIL_COLUMNS).in('id', ids);
      if (error) {
        console.error('Error fetching song details:', error.message);
        continue;
      }
      (data || []).forEach((row: any) => details.set(row.id, { content: row.content || '', notes: row.notes || undefined }));
    }

    const complete = (s: Song): Song => {
      const d = details.get(s.id);
      return d && needsContent(s) ? { ...s, ...d, contentLoaded: true } : s;
    };
    setSongs(prev => prev.map(complete));
    return targets.map(complete);
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchSongs();
    if (session) {
      fetchGroups();
      fetchUserProfile();
    }
    setLoading(false);
  }, [session, fetchSongs, fetchGroups, fetchUserProfile]);

  return {
    songs,
    setSongs,
    groups,
    setGroups,
    pendingInvitesCount,
    loading,
    publicSongData,
    isAdmin,
    fetchSongs,
    fetchGroups,
    loadSongDetails
  };
};
