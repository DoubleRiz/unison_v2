
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Song, Group } from '../types';

/**
 * @param authReady vrai une fois la session Supabase restaurée : évite un premier
 *                  chargement « visiteur » suivi d'un second une fois connecté.
 */
export const useAppData = (session: any, authReady: boolean, currentView: string, currentSongId: string | null) => {
  // On dépend de l'identifiant et non de l'objet session, qui change à chaque
  // rafraîchissement du jeton et relancerait tout le chargement.
  const userId: string | null = session?.user?.id ?? null;
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
    if (!userId) return;
    const { data, error } = await supabase
      .from('group_members')
      .select('*, groups(*)')
      .eq('user_id', userId);
    
    if (!error && data) {
      const accepted = data.filter((m: any) => m.status === 'accepted').map((m: any) => m.groups).filter(Boolean);
      const pending = data.filter((m: any) => m.status === 'pending');
      setGroups(accepted);
      setPendingInvitesCount(pending.length);
    }
  }, [userId]);

  const fetchUserProfile = useCallback(async () => {
    if (!userId) return;
    // La colonne users.is_admin n'est pas lisible directement (RLS) : on passe par la fonction.
    const { data, error } = await supabase.rpc('is_admin');
    if (!error) {
      setIsAdmin(data === true);
    }
  }, [userId]);

  const fetchSongs = useCallback(async () => {
    try {
      let query = supabase.from('songs').select('*');

      if (userId) {
        // Logged in: fetch everything accessible
        query = query.order('updated_at', { ascending: false });
      } else {
        // Guest: fetch top public songs for search/random functionality
        query = query.eq('is_public', true).order('created_at', { ascending: false });
      }

      const { data: songsData, error: songsError } = await query;
      if (songsError) throw songsError;

      // Fetch Favorites only if logged in
      let favoriteIds = new Set();
      if (userId) {
        const { data: favData } = await supabase
          .from('favorites')
          .select('song_id')
          .eq('user_id', userId);
        if (favData) favoriteIds = new Set(favData.map((f: any) => f.song_id));
      }

      if (songsData) {
        const mappedSongs: Song[] = songsData.map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          title: s.title,
          artist: s.artist,
          bpm: s.bpm,
          key: s.original_key,
          content: s.content,
          notes: s.notes,
          youtubeUrl: s.youtube_url,
          audioUrl: s.audio_url, 
          is_public: s.is_public,
          is_favorite: favoriteIds.has(s.id),
          shared_with_group_id: s.shared_with_group_id,
          genres: s.genres || [],
          tags: s.tags || []
        }));
        setSongs(mappedSongs);
      }
    } catch (error: any) {
      console.error('Error fetching songs:', error.message);
    }
  }, [userId]);

  // Chargement initial, puis à chaque connexion / déconnexion.
  // `loading` reste vrai jusqu'à la fin du premier chargement complet ;
  // les rechargements suivants ne réaffichent pas l'écran de chargement.
  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setGroups([]);
      setPendingInvitesCount(0);
      setIsAdmin(false);
    }
    Promise.all([fetchSongs(), fetchGroups(), fetchUserProfile()])
      .finally(() => setLoading(false));
  }, [authReady, userId, fetchSongs, fetchGroups, fetchUserProfile]);

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
    fetchGroups
  };
};
