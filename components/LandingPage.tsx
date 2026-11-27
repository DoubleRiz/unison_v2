import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Song } from '../types';
import { Loader2, Search, ArrowRight, Sun, Moon } from 'lucide-react';
import { Logo, DiceIcon, KeyBadge } from './ui/Brand';

interface LandingPageProps {
  onSelectSong: (songId: string) => void;
  onNavigate: (view: string, query?: string) => void;
  onOpenAuth?: () => void;
  onRandomSong?: () => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

/* Chord tiles behind the hero. Colours follow the Unison accent set. */
const TILE_COLORS: Record<string, string> = {
  violet: 'bg-[#6D3FC8] text-white',
  teal: 'bg-[#0E7C86] text-white',
  amber: 'bg-[#F5B83D] text-ink',
  green: 'bg-[#2C7A4B] text-white',
  blue: 'bg-[#2440D6] text-white',
  red: 'bg-[#D3402A] text-white'
};
const TILE_SEQUENCE: [string, string][] = [
  ['Am', 'violet'], ['A', 'teal'], ['G7', 'teal'], ['D', 'amber'], ['E7', 'green'], ['C', 'blue'],
  ['F', 'blue'], ['C', 'amber'], ['Em', 'red'], ['Bm', 'red'], ['G', 'green'], ['Dm', 'violet']
];
const TILES = Array.from({ length: 60 }, (_, i) => TILE_SEQUENCE[i % TILE_SEQUENCE.length]);

const FEATURES = [
  { n: '01', badge: 'bg-[#2440D6] text-white', title: 'Une bibliothèque commune', desc: 'Paroles et accords au même format, filtrables par artiste, genre et tag.', view: 'search' },
  { n: '02', badge: 'bg-[#2C7A4B] text-white', title: 'Transposition et degrés', desc: "Changez de tonalité en un geste, ou lisez la grille en degrés (I, IV, V) pour jouer dans n'importe quelle tonalité.", view: 'search' },
  { n: '03', badge: 'bg-[#F5B83D] text-ink', title: 'Setlists', desc: "L'ordre du concert, les notes entre les morceaux et l'export PDF pour le pupitre.", view: 'setlists' },
  { n: '04', badge: 'bg-[#D3402A] text-white', title: 'Mode scène', desc: 'Gros caractères, défilement automatique et réglage de la vitesse pendant que vous jouez.', view: 'help' },
  { n: '05', badge: 'bg-[#6D3FC8] text-white', title: "Dictionnaire d'accords", desc: 'Doigtés pour guitare et ukulélé, positions au piano, et des progressions prêtes à jouer.', view: 'chord-dictionary' },
  { n: '06', badge: 'bg-[#0E7C86] text-white', title: 'Groupes', desc: 'Invitez les membres du groupe, partagez les chansons et décidez qui peut les modifier.', view: 'groups' }
];

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

const LandingPage: React.FC<LandingPageProps> = ({ onSelectSong, onNavigate, onOpenAuth, onRandomSong, theme, toggleTheme }) => {
  const [recentSongs, setRecentSongs] = useState<(Song & { created_at?: string })[]>([]);
  const [publicCount, setPublicCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPublicSongs();
  }, []);

  const fetchPublicSongs = async () => {
    setLoading(true);
    const { data, error, count } = await supabase
      .from('songs')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!error && data) {
      setRecentSongs(data.map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        title: s.title,
        artist: s.artist,
        bpm: s.bpm,
        key: s.original_key,
        content: s.content,
        is_public: s.is_public,
        genres: s.genres || [],
        tags: s.tags || [],
        created_at: s.created_at
      })));
      if (typeof count === 'number') setPublicCount(count);
    }
    setLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('search', searchTerm.trim() || undefined);
  };

  const navLinks = [
    { label: 'Bibliothèque', view: 'search' },
    { label: 'Accords', view: 'chord-dictionary' },
    { label: 'Progressions', view: 'progressions' },
    { label: 'Aide', view: 'help' }
  ];

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 text-ink dark:text-slate-100">
      {/* Hero */}
      <div className="relative overflow-hidden bg-stage text-[#ECEDE9] min-h-[640px] md:min-h-[860px]">
        <div
          aria-hidden="true"
          className="absolute grid grid-cols-6 md:grid-cols-10 gap-4 opacity-55 pointer-events-none select-none"
          style={{ inset: '-60px -80px', transform: 'rotate(-6deg) scale(1.05)', opacity: 0.55 }}
        >
          {TILES.map(([chord, color], i) => (
            <span key={i} className={`aspect-square rounded-2xl flex items-end p-3 font-mono font-bold text-2xl md:text-[40px] leading-none ${TILE_COLORS[color]}`}>
              {chord}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'rgba(17, 19, 24, 0.62)' }} />

        <header className="relative z-10 border-b border-white/10">
          <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Logo onClick={() => onNavigate('landing')} className="text-[#ECEDE9]" />
            <nav aria-label="Principale" className="hidden md:flex flex-wrap gap-1 flex-1">
              {navLinks.map(l => (
                <button key={l.view} type="button" onClick={() => onNavigate(l.view)} className="px-3 py-2 text-[#A9AEB8] hover:text-[#ECEDE9] font-medium transition-colors">
                  {l.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2 ml-auto">
              {toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md text-[#A9AEB8] hover:text-[#ECEDE9]"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              <button type="button" onClick={onOpenAuth} className="hidden sm:inline-flex items-center h-10 px-4 rounded-md text-[#ECEDE9] font-semibold hover:bg-white/10">
                Se connecter
              </button>
              <button type="button" onClick={onOpenAuth} className="inline-flex items-center h-10 px-4 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold">
                Créer un compte
              </button>
            </div>
          </div>
        </header>

        <section className="relative z-10 max-w-[1000px] mx-auto px-4 md:px-6 pt-16 md:pt-[104px] pb-16 flex flex-col items-center text-center">
          <p className="mb-7 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 bg-stage/70 text-amber-400 text-xs font-bold uppercase" style={{ letterSpacing: '0.08em' }}>
            <span className="font-mono" aria-hidden="true">#</span>Play together in one accord.
          </p>
          <h1 className="m-0 mb-6 font-display font-extrabold text-[56px] md:text-[104px] leading-[0.95]" style={{ letterSpacing: '-0.045em' }}>
            Réunir avec<br />la musique
          </h1>
          <p className="m-0 mb-10 max-w-[34em] text-lg md:text-[21px] leading-relaxed text-[#D4D7DD]">
            Créez des partitions, transposez en un instant et travaillez avec votre groupe sur une seule scène numérique.
          </p>

          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="w-full max-w-[672px] flex items-center gap-2 h-16 pl-5 pr-2 bg-paper text-ink rounded-xl"
            style={{ boxShadow: '0 16px 50px rgba(0,0,0,0.6)' }}
          >
            <label htmlFor="hero-search" className="sr-only">Chercher par artiste ou titre</label>
            <Search size={22} className="text-slate-500 shrink-0" aria-hidden="true" />
            <input
              id="hero-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Chercher par artiste ou titre…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-lg text-ink placeholder:text-slate-500"
            />
            {onRandomSong && (
              <button
                type="button"
                onClick={onRandomSong}
                aria-label="Chanson au hasard"
                title="Chanson au hasard"
                className="hidden sm:inline-flex w-12 h-12 shrink-0 items-center justify-center rounded-md border border-slate-200 text-ink hover:border-slate-400"
              >
                <DiceIcon size={22} />
              </button>
            )}
            <button type="submit" className="inline-flex items-center gap-2 h-12 px-4 sm:px-[22px] rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-bold shrink-0">
              Chercher <ArrowRight size={18} className="hidden sm:block" />
            </button>
          </form>

          {publicCount !== null && publicCount > 0 && (
            <p className="mt-5 text-sm text-[#A9AEB8]">
              <b className="text-[#ECEDE9]">{publicCount} chansons</b> publiques dans la bibliothèque
            </p>
          )}

          {recentSongs.length > 0 && (
            <div className="flex flex-wrap justify-center items-center gap-2 mt-6">
              <span className="text-sm text-[#A9AEB8] mr-1">Récentes :</span>
              {recentSongs.slice(0, 4).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSong(s.id)}
                  className="inline-flex items-center h-8 px-3 rounded-full border border-white/20 bg-stage/55 text-[#D4D7DD] text-sm font-medium hover:border-white/40 hover:text-white"
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* What Unison does */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-[#E6E8E2] dark:bg-slate-900">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-16">
          <h2 className="m-0 mb-10 font-display font-bold text-[28px]">Ce que fait Unison</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
            {FEATURES.map(f => (
              <button
                key={f.n}
                type="button"
                onClick={() => onNavigate(f.view)}
                className="text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-2.5 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
              >
                <span className={`self-start font-mono text-base font-bold rounded px-2 py-[3px] mb-1.5 ${f.badge}`}>{f.n}</span>
                <h3 className="m-0 font-display font-bold text-[21px]">{f.title}</h3>
                <p className="m-0 text-slate-600 dark:text-slate-400">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Recent additions */}
      <section className="max-w-[1240px] mx-auto px-4 md:px-6 py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
          <h2 className="m-0 font-display font-bold text-[28px]">Ajouts récents</h2>
          <button type="button" onClick={() => onNavigate('search')} className="font-semibold underline underline-offset-[3px] decoration-1 hover:text-slate-600 dark:hover:text-slate-300">
            Toute la bibliothèque
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="text-cyan-600 dark:text-cyan-400 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto border-t-[1.5px] border-ink dark:border-slate-300">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400" style={{ letterSpacing: '0.08em' }}>
                  <th className="px-2 py-3 font-semibold">Titre</th>
                  <th className="px-2 py-3 font-semibold">Artiste</th>
                  <th className="px-2 py-3 font-semibold">Ton</th>
                  <th className="px-2 py-3 font-semibold">Genre</th>
                  <th className="px-2 py-3 font-semibold text-right">Ajoutée</th>
                </tr>
              </thead>
              <tbody>
                {recentSongs.map(song => (
                  <tr key={song.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer" onClick={() => onSelectSong(song.id)}>
                    <td className="px-2 py-3.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onSelectSong(song.id); }} className="font-semibold text-left">{song.title}</button>
                    </td>
                    <td className="px-2 py-3.5 text-slate-600 dark:text-slate-400">{song.artist}</td>
                    <td className="px-2 py-3.5">{song.key && <KeyBadge>{song.key}</KeyBadge>}</td>
                    <td className="px-2 py-3.5 text-slate-600 dark:text-slate-400">{song.genres?.[0] || '—'}</td>
                    <td className="px-2 py-3.5 text-right font-mono text-sm text-slate-500">{formatDate(song.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6 flex flex-wrap gap-5 items-center text-sm text-slate-500">
          <span className="font-display font-extrabold text-ink dark:text-slate-100">unison</span>
          <a
            href="https://east-motorcycle-1da.notion.site/Unison-le-guide-3321b961f5818087b54be8e98023bf67?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1"
          >
            Documentation
          </a>
          <button type="button" onClick={() => onNavigate('changelog')} className="text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1">Nouveautés</button>
          <button type="button" onClick={() => onNavigate('help')} className="text-slate-600 dark:text-slate-400 underline underline-offset-[3px] decoration-1">Aide</button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
