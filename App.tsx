
import React, { useState, useEffect, useMemo } from 'react';
import { Song, NotationMode } from './types';
import { supabase } from './lib/supabaseClient';
import { useAppData } from './hooks/useAppData';
import Sidebar from './components/Sidebar';
import SongSheet from './components/SongSheet';
import SongEditor from './components/SongEditor';
import Auth from './components/Auth';
import Profile from './components/Profile';
import SetlistEditor from './components/SetlistEditor';
import GroupManager from './components/GroupManager';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import AdvancedSearch from './components/AdvancedSearch';
import HelpPage from './components/HelpPage';
import ChordDictionary from './components/tools/ChordDictionary';
import ChordProgressions from './components/tools/ChordProgressions';
import BottomNav from './components/BottomNav';
import ChangelogPage from './components/ChangelogPage';
import EmailConfirmPage from './components/EmailConfirmPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import HomeDashboard from './components/HomeDashboard';
import { 
  Loader2, 
  ListMusic,
  Lock,
  ArrowRight,
  Download,
  X
} from 'lucide-react';
import { LogoMark } from './components/ui/Brand';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });
  
  // Navigation & UI State
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'main' | 'editor' | 'profile' | 'setlists' | 'groups' | 'search' | 'help' | 'chord-dictionary' | 'progressions' | 'email-confirmed' | 'reset-password' | 'changelog'>('landing');
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'favorites'>('all');
  const [transpose, setTranspose] = useState(0);
  const [notationMode, setNotationMode] = useState<NotationMode>(NotationMode.LETTERS);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Responsive State
  const [isMobile, setIsMobile] = useState(false);

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // PWA Install & Environment Check
  useEffect(() => {
    // Check if already in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('pwa_banner_dismissed') && !isAppInstalled) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsAppInstalled(true);
      setShowInstallBanner(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isAppInstalled]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      }
    } else {
      // Fallback for iOS or Android browsers that don't support beforeinstallprompt
      alert("Pour installer l'app : \n1. Appuyez sur les 3 points (Android) ou Partager (iOS)\n2. Sélectionnez 'Ajouter à l'écran d'accueil'");
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if this is a Supabase auth redirect
    const hash = window.location.hash;
    const isEmailConfirmation = hash.includes('type=signup') || hash.includes('type=email_change');
    const isPasswordRecovery = hash.includes('type=recovery');

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && isEmailConfirmation) {
        setCurrentView('email-confirmed');
        window.history.replaceState(null, '', window.location.pathname);
      } else if (session && isPasswordRecovery) {
        setCurrentView('reset-password');
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'PASSWORD_RECOVERY') {
        setCurrentView('reset-password');
        window.history.replaceState(null, '', window.location.pathname);
      } else if (session) {
        setShowAuthModal(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const { 
    songs, 
    setSongs, 
    groups, 
    pendingInvitesCount, 
    loading, 
    publicSongData, 
    isAdmin 
  } = useAppData(session, currentView, currentSongId);

  const handleToggleFavorite = async (songId: string, isFav: boolean) => {
    if (!session) return;
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, is_favorite: isFav } : s));
    if (isFav) {
      await supabase.from('favorites').insert({ user_id: session.user.id, song_id: songId });
    } else {
      await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('song_id', songId);
    }
  };

  const handleRandomSong = () => {
    if (songs.length === 0) return;
    const randomIndex = Math.floor(Math.random() * songs.length);
    const randomSong = songs[randomIndex];
    setCurrentSongId(randomSong.id);
    setCurrentView('main');
    setTranspose(0);
  };

  const handleSaveSong = async (songData: Song, onSuccess?: () => void) => {
    if (!session) return;
    try {
      const existing = songs.find(s => s.id === songData.id);
      const isNew = !existing;
      const dbSong: any = {
        title: songData.title,
        artist: songData.artist,
        bpm: songData.bpm,
        original_key: songData.key,
        content: songData.content,
        display_mode: songData.displayMode ?? null,
        notes: songData.notes,
        youtube_url: songData.youtubeUrl,
        audio_url: songData.audioUrl,
        is_public: songData.is_public,
        shared_with_group_id: songData.shared_with_group_id,
        genres: songData.genres,
        tags: songData.tags
      };
      if (isNew) {
        dbSong.user_id = session.user.id;
        dbSong.forked_from = songData.forked_from;
        const { data, error } = await supabase.from('songs').insert([dbSong]).select().single();
        if (error) throw error;
        const newSong: Song = { ...songData, id: data.id, user_id: session.user.id, is_favorite: false };
        setSongs([newSong, ...songs]);
        setCurrentSongId(data.id);
      } else {
        // Seul le propriétaire (ou un admin) peut changer la visibilité et le groupe.
        if (existing.user_id !== session.user.id && !isAdmin) {
          delete dbSong.is_public;
          delete dbSong.shared_with_group_id;
        }
        const { error } = await supabase.from('songs').update(dbSong).eq('id', songData.id);
        if (error) throw error;
        setSongs(songs.map(s => s.id === songData.id ? { ...songData, user_id: s.user_id || session.user.id, is_favorite: s.is_favorite } : s));
      }
      if (onSuccess) onSuccess(); else setCurrentView('main');
    } catch (error: any) {
      console.error('Error saving song:', error.message);
    }
  };

  const handleDeleteSong = async (id: string) => {
     if (!session) return;
     try {
       const { error } = await supabase.from('songs').delete().eq('id', id);
       if (error) throw error;
       setSongs(songs.filter(s => s.id !== id));
       setCurrentSongId(null);
       setCurrentView('main');
     } catch(e: any) {
       console.error("Delete error:", e.message);
     }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentView('landing');
  };

  const createNewSong = () => {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    setCurrentSongId(null);
    setCurrentView('editor');
  };

  const changeTranspose = (delta: number) => {
    setTranspose(prev => prev + delta);
  };

  const openSong = (id: string) => {
    setCurrentSongId(id);
    setCurrentView('main');
    setTranspose(0);
  };

  const openLibrary = (query = '', favoritesOnly = false) => {
    setInitialSearchQuery(query);
    setLibraryFilter(favoritesOnly ? 'favorites' : 'all');
    setCurrentView('search');
  };

  const favoriteIds = useMemo(() => new Set(songs.filter(s => s.is_favorite).map(s => s.id)), [songs]);

  const allExistingTags = useMemo(() => {
    const tags = new Set<string>();
    songs.forEach(s => s.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [songs]);

  const currentSong = session 
    ? (songs.find(s => s.id === currentSongId) || null)
    : publicSongData;

  const AuthRequiredState = ({ title, desc }: { title: string, desc: string }) => (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full flex flex-col gap-4 p-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400">
          <Lock size={22} />
        </span>
        <h2 className="m-0 font-display font-extrabold text-[28px] leading-tight">{title}</h2>
        <p className="m-0 text-slate-600 dark:text-slate-400">{desc}</p>
        <button 
          type="button"
          onClick={() => setShowAuthModal(true)}
          className="mt-2 flex items-center justify-center gap-2 h-12 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors"
        >
          Se connecter ou créer un compte <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (currentView === 'landing') {
      return (
        <HomeDashboard
          session={session}
          songs={songs}
          groups={groups}
          onSelectSong={openSong}
          onNavigate={setCurrentView}
          onOpenLibrary={(fav) => openLibrary('', !!fav)}
        />
      );
    }

    if (currentView === 'help') {
      return <HelpPage onBack={() => setCurrentView(session ? 'main' : 'landing')} />;
    }

    if (currentView === 'changelog') {
      return <ChangelogPage onBack={() => setCurrentView(session ? 'main' : 'landing')} />;
    }

    if (currentView === 'chord-dictionary') {
      return <ChordDictionary />;
    }

    if (currentView === 'progressions') {
      return <ChordProgressions />;
    }

    if (currentView === 'search') {
      return (
        <AdvancedSearch
          session={session}
          isAdmin={isAdmin}
          initialQuery={initialSearchQuery}
          favoritesOnly={libraryFilter === 'favorites'}
          favoriteIds={favoriteIds}
          onToggleFavorite={session ? handleToggleFavorite : undefined}
          onFavoritesOnlyChange={(v) => setLibraryFilter(v ? 'favorites' : 'all')}
          onSelectSong={(id) => {
            openSong(id);
            setInitialSearchQuery(''); 
          }}
          onAddSong={createNewSong}
        />
      );
    }

    if (currentView === 'profile') {
      return session ? <Profile user={session.user} songs={songs} groupsCount={groups.length} theme={theme} onThemeChange={(t) => { if (t !== theme) toggleTheme(); }} onSignOut={handleSignOut} onNavigateToGroups={() => setCurrentView('groups')} /> : <AuthRequiredState title="Votre profil" desc="Créez un compte pour gérer votre profil, suivre votre répertoire et le retrouver sur tous vos appareils." />;
    }

    if (currentView === 'setlists') {
      return session ? (
        <SetlistEditor
          user={session.user}
          allSongs={songs}
          groups={groups}
          onBack={() => setCurrentView('landing')}
          onSaveSong={handleSaveSong}
        />
      ) : <AuthRequiredState title="Setlists" desc="Connectez-vous pour préparer l'ordre de vos concerts et répétitions, et les partager avec votre groupe." />;
    }

    if (currentView === 'groups') {
      return session ? (
        <GroupManager 
          user={session.user}
          songs={songs}
          onClose={() => setCurrentView('landing')}
        />
      ) : <AuthRequiredState title="Groupes" desc="Invitez les membres de votre groupe, partagez vos arrangements et préparez les répétitions ensemble." />;
    }

    if (currentView === 'editor') {
      return session ? (
        <SongEditor 
          key={currentSongId || 'new'}
          initialSong={currentSongId ? currentSong : null}
          groups={groups}
          canManageVisibility={!currentSongId || !currentSong || currentSong.user_id === session.user.id || isAdmin}
          existingTags={allExistingTags}
          onSave={handleSaveSong} 
          onCancel={() => {
            setCurrentView('main');
          }}
        />
      ) : <AuthRequiredState title="Éditeur de chanson" desc="Connectez-vous pour créer et modifier vos fiches de chansons." />;
    }

    if (currentSong) {
      return (
        <SongSheet 
          song={currentSong} 
          transposeSemitones={transpose} 
          notationMode={notationMode}
          onToggleFavorite={(isFav) => handleToggleFavorite(currentSong.id, isFav)}
          session={session}
          isAdmin={isAdmin}
          onOpenAuth={() => setShowAuthModal(true)}
          onEdit={() => setCurrentView('editor')}
          onDelete={handleDeleteSong}
          onTransposeChange={changeTranspose}
          onTransposeReset={() => setTranspose(0)}
          onNotationModeChange={setNotationMode}
          onBack={() => openLibrary()}
        />
      );
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-slate-500 px-4 text-center">
        <ListMusic size={48} className="opacity-40" />
        <p className="text-lg m-0">Choisissez une chanson pour commencer.</p>
        <button type="button" onClick={() => openLibrary()} className="h-11 px-4 rounded-md border border-slate-300 dark:border-slate-700 font-semibold text-ink dark:text-slate-100">Ouvrir la bibliothèque</button>
      </div>
    );
  };

  if (currentView === 'email-confirmed') {
    return <EmailConfirmPage onContinue={() => setCurrentView('landing')} />;
  }

  if (currentView === 'reset-password') {
    return <ResetPasswordPage onDone={() => setCurrentView('landing')} />;
  }

  if (loading) {
    return (
      <div className="h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 text-cyan-600 dark:text-cyan-400">
        <LogoMark size={40} />
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const installBanner = showInstallBanner && (
    <div role="dialog" aria-label="Installer l'application" className="fixed top-4 left-4 right-4 md:left-auto md:w-[400px] z-[100] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <LogoMark size={36} />
        <div className="min-w-0">
          <div className="font-semibold">Installer Unison</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Accès rapide et mode hors ligne</div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button 
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold"
        >
          <Download size={14} /> {deferredPrompt ? 'Installer' : 'Comment ?'}
        </button>
        <button 
          type="button"
          aria-label="Fermer"
          onClick={() => {
            setShowInstallBanner(false);
            sessionStorage.setItem('pwa_banner_dismissed', 'true');
          }}
          className="w-10 h-10 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-ink dark:hover:text-slate-100"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );

  // Visitors land on the full-bleed marketing page (no sidebar).
  if (!session && currentView === 'landing') {
    return (
      <div className="h-screen overflow-y-auto bg-slate-100 dark:bg-slate-950">
        {showAuthModal && <Auth onClose={() => setShowAuthModal(false)} />}
        {installBanner}
        <LandingPage
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenAuth={() => setShowAuthModal(true)}
          onRandomSong={handleRandomSong}
          onNavigate={(view, query) => {
            if (view === 'search') { openLibrary(query || ''); return; }
            setCurrentView(view as any);
          }}
          onSelectSong={openSong}
        />
        {isMobile && (
          <BottomNav currentView={currentView} onNavigate={setCurrentView} pendingInvitesCount={pendingInvitesCount} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-ink dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      
      {showAuthModal && <Auth onClose={() => setShowAuthModal(false)} />}
      {installBanner}
      
      {!isMobile && (
        <Sidebar 
          session={session}
          songs={songs}
          groups={groups}
          pendingInvitesCount={pendingInvitesCount}
          currentSongId={currentSongId}
          currentView={currentView}
          theme={theme}
          toggleTheme={toggleTheme}
          libraryFilter={libraryFilter}
          onNavigate={setCurrentView}
          onSearch={(q, fav) => openLibrary(q, !!fav)}
          onSelectSong={openSong}
          onRandomSong={handleRandomSong}
          onSignOut={handleSignOut}
          onOpenAuth={() => setShowAuthModal(true)}
          onCreateSong={createNewSong}
        />
      )}

      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex-1 overflow-y-auto w-full pb-24 md:pb-0">
          {isMobile && (
            <Navbar 
              session={session}
              songs={songs}
              theme={theme}
              toggleTheme={toggleTheme}
              onOpenAuth={() => setShowAuthModal(true)}
              onSignOut={handleSignOut}
              onNavigateHome={() => { setCurrentView('landing'); setCurrentSongId(null); }}
              onNavigateProfile={() => setCurrentView('profile')}
              onNavigateSetlists={() => setCurrentView('setlists')}
              onRandomSong={handleRandomSong}
              onSelectSong={openSong}
              onSearch={(q) => openLibrary(q)}
            />
          )}
          {['landing', 'main', 'search'].includes(currentView) ? (
            renderMainContent()
          ) : (
            <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-6 md:py-10">{renderMainContent()}</div>
          )}
          {currentView !== 'changelog' && currentView !== 'main' && (
            <footer className="px-4 md:px-10 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-4 text-sm">
              <button
                type="button"
                onClick={() => setCurrentView('changelog')}
                className="text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100 underline-offset-[3px] hover:underline"
              >
                Nouveautés v1.0.0
              </button>
              <a
                href="https://east-motorcycle-1da.notion.site/Unison-le-guide-3321b961f5818087b54be8e98023bf67?source=copy_link"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 dark:text-slate-400 hover:text-ink dark:hover:text-slate-100 underline-offset-[3px] hover:underline"
              >
                Documentation
              </a>
            </footer>
          )}
        </div>

        {isMobile && (
          <BottomNav 
            currentView={currentView} 
            onNavigate={setCurrentView} 
            pendingInvitesCount={pendingInvitesCount} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
