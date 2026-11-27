import React, { useEffect, useRef, useState } from 'react';
import { Song, Group } from '../types';
import { Plus, Search, LogOut, LogIn, Sun, Moon } from 'lucide-react';
import { Logo, DiceIcon, Initials } from './ui/Brand';

interface SidebarProps {
  session: any;
  songs: Song[];
  groups: Group[];
  pendingInvitesCount: number;
  currentSongId: string | null;
  currentView: string;
  isSidebarOpen?: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onCloseMobile?: () => void;
  onNavigate: (view: any) => void;
  onSearch: (query: string, favoritesOnly?: boolean) => void;
  onSelectSong: (id: string) => void;
  onRandomSong: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
  onCreateSong: () => void;
  libraryFilter?: 'all' | 'favorites';
}

const Sidebar: React.FC<SidebarProps> = ({
  session,
  songs,
  groups,
  pendingInvitesCount,
  currentView,
  theme,
  toggleTheme,
  onNavigate,
  onSearch,
  onSelectSong,
  onRandomSong,
  onSignOut,
  onOpenAuth,
  onCreateSong,
  libraryFilter = 'all'
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowSuggestions(false);
    };
    // "/" focuses the search field, like the design's keyboard hint suggests.
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const suggestions = query.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  const favoritesCount = songs.filter(s => s.is_favorite).length;
  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Musicien';

  const isLibrary = currentView === 'search';

  return (
    <aside className="hidden md:flex flex-col w-[248px] shrink-0 h-full bg-slate-100 dark:bg-slate-950 text-ink dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
      <nav aria-label="Navigation" className="flex flex-col gap-5 h-full px-4 py-5 overflow-y-auto scrollbar-hide">
        <Logo onClick={() => onNavigate('landing')} className="px-2 text-ink dark:text-slate-100" />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCreateSong}
            className="flex items-center justify-center gap-2 h-10 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors"
          >
            <Plus size={16} strokeWidth={2.4} />
            Nouvelle chanson
          </button>

          <div className="flex gap-1.5" ref={searchRef}>
            <div className="relative flex-1 min-w-0">
              <form
                role="search"
                onSubmit={(e) => { e.preventDefault(); onSearch(query.trim()); setShowSuggestions(false); }}
                className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:border-cyan-600 dark:focus-within:border-cyan-400"
              >
                <Search size={16} className="text-slate-500 shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="search"
                  aria-label="Rechercher"
                  placeholder="Rechercher"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base placeholder:text-slate-500"
                />
                <kbd className="font-mono text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded-sm px-1">/</kbd>
              </form>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-[-46px] top-full mt-1 z-50 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden">
                  {suggestions.map(song => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => { onSelectSong(song.id); setQuery(''); setShowSuggestions(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{song.title}</span>
                        <span className="block text-xs text-slate-500 truncate">{song.artist}</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{song.key}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onRandomSong}
              aria-label="Chanson au hasard"
              title="Chanson au hasard"
              className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
            >
              <DiceIcon />
            </button>
          </div>
        </div>

        <NavSection title="Jouer">
          <NavItem label="Accueil" active={currentView === 'landing'} onClick={() => onNavigate('landing')} />
          <NavItem label="Bibliothèque" count={songs.length || undefined} active={isLibrary && libraryFilter === 'all'} onClick={() => onSearch('')} />
          {session && <NavItem label="Favoris" count={favoritesCount || undefined} active={isLibrary && libraryFilter === 'favorites'} onClick={() => onSearch('', true)} />}
        </NavSection>

        <NavSection title="Setlists">
          <NavItem label="Toutes les setlists" active={currentView === 'setlists'} onClick={() => onNavigate('setlists')} />
        </NavSection>

        <NavSection title="Outils">
          <NavItem label="Dictionnaire d'accords" active={currentView === 'chord-dictionary'} onClick={() => onNavigate('chord-dictionary')} />
          <NavItem label="Progressions" active={currentView === 'progressions'} onClick={() => onNavigate('progressions')} />
          <NavItem label="Aide" active={currentView === 'help'} onClick={() => onNavigate('help')} />
        </NavSection>

        <NavSection title="Groupes">
          {groups.length > 0 ? (
            groups.map(g => (
              <NavItem key={g.id} label={g.name} active={currentView === 'groups'} onClick={() => onNavigate('groups')} />
            ))
          ) : (
            <NavItem label={session ? 'Mes groupes' : 'Groupes'} active={currentView === 'groups'} onClick={() => onNavigate('groups')} />
          )}
          {pendingInvitesCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('groups')}
              className="flex items-center justify-between gap-2 h-[34px] px-2 rounded-md text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40"
            >
              <span>Invitations en attente</span>
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-sm bg-red-500 text-white font-mono text-xs">{pendingInvitesCount}</span>
            </button>
          )}
        </NavSection>

        <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 px-2">
            {session ? (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-md py-1 ${currentView === 'profile' ? 'text-cyan-700 dark:text-cyan-400' : ''}`}
              >
                <Initials name={userName} src={session.user?.user_metadata?.avatar_url} />
                <span className="flex flex-col min-w-0 leading-tight">
                  <span className="font-semibold truncate">{userName}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate">Mon profil</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold hover:border-slate-500"
              >
                <LogIn size={16} /> Se connecter
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
              title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
              className="w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {session && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </nav>
    </aside>
  );
};

const NavSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-0.5">
    <p className="mb-1.5 px-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>{title}</p>
    {children}
  </div>
);

const NavItem: React.FC<{ label: string; count?: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`flex items-center justify-between gap-2 h-[34px] px-2 rounded-md text-left transition-colors ${
      active
        ? 'bg-cyan-100 text-cyan-700 font-semibold shadow-[inset_3px_0_0_#2440D6] dark:bg-cyan-900 dark:text-cyan-300 dark:shadow-[inset_3px_0_0_#93A5FF]'
        : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200/60 dark:hover:bg-slate-900 hover:text-ink dark:hover:text-slate-100'
    }`}
  >
    <span className="truncate">{label}</span>
    {count !== undefined && <span className="font-mono text-xs text-slate-500">{count}</span>}
  </button>
);

export default Sidebar;
