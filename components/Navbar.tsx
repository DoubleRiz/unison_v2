import React, { useState, useRef, useEffect } from 'react';
import { LogIn, Search, Sun, Moon } from 'lucide-react';
import { Song } from '../types';
import { Logo, DiceIcon } from './ui/Brand';

/**
 * Mobile top bar (< 768px). On desktop the Sidebar carries the logo,
 * search, random song and theme switch.
 */
interface NavbarProps {
  session: any;
  songs: Song[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
  onNavigateSetlists: () => void;
  onRandomSong: () => void;
  onSelectSong: (id: string) => void;
  onSearch?: (query: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({
  session,
  songs,
  theme,
  toggleTheme,
  onOpenAuth,
  onNavigateHome,
  onRandomSong,
  onSelectSong,
  onSearch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = searchQuery.trim().length > 0
    ? songs.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.artist.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSelect = (id: string) => {
    onSelectSong(id);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <header className="md:hidden sticky top-0 z-40 flex flex-col gap-3 px-4 pt-4 pb-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <Logo onClick={onNavigateHome} className="text-ink dark:text-slate-100" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            className="w-11 h-11 inline-flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {!session && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-cyan-600 text-white font-semibold"
            >
              <LogIn size={16} /> Connexion
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2" ref={searchRef}>
        <div className="relative flex-1 min-w-0">
          <form
            role="search"
            onSubmit={(e) => { e.preventDefault(); if (onSearch) onSearch(searchQuery.trim()); setShowSuggestions(false); }}
            className="flex items-center gap-2.5 h-11 px-3 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          >
            <Search size={18} className="text-slate-500 shrink-0" aria-hidden="true" />
            <input
              type="search"
              aria-label="Chercher"
              placeholder="Titre ou artiste"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base placeholder:text-slate-500"
            />
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden">
              {suggestions.map(song => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => handleSelect(song.id)}
                  className="w-full flex items-center gap-3 px-3 min-h-[52px] text-left border-b last:border-b-0 border-slate-200 dark:border-slate-800"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{song.title}</span>
                    <span className="block text-sm text-slate-500 truncate">{song.artist}</span>
                  </span>
                  <span className="font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900 rounded px-1.5">{song.key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRandomSong}
          aria-label="Chanson au hasard"
          className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
        >
          <DiceIcon size={20} />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
