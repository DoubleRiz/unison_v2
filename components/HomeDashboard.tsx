import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Song, Setlist, Group } from '../types';
import { KeyBadge } from './ui/Brand';

interface HomeDashboardProps {
  session: any;
  songs: Song[];
  groups: Group[];
  onSelectSong: (id: string) => void;
  onNavigate: (view: any) => void;
  onOpenLibrary: (favoritesOnly?: boolean) => void;
}

const SET_COLORS = ['#2440D6', '#F5B83D', '#6D3FC8', '#2C7A4B', '#0E7C86', '#D3402A'];
const FAV_TINTS = [
  'bg-cyan-100 dark:bg-cyan-900',
  'bg-amber-100 dark:bg-amber-900',
  'bg-green-100 dark:bg-green-900',
  'bg-violet-100 dark:bg-violet-900',
  'bg-teal-100 dark:bg-teal-900',
  'bg-red-100 dark:bg-red-900'
];

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({ session, songs, groups, onSelectSong, onNavigate, onOpenLibrary }) => {
  const [setlists, setSetlists] = useState<(Setlist & { song_count?: number })[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let { data, error } = await supabase
        .from('setlists')
        .select('*, setlist_songs(count)')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) {
        // Fallback if the embedded count is not available on this schema.
        ({ data } = await supabase.from('setlists').select('*').order('created_at', { ascending: false }).limit(3));
      }
      if (!cancelled && data) {
        setSetlists(data.map((s: any) => ({ ...s, song_count: s.setlist_songs?.[0]?.count })));
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || '';
  const firstName = name.split(' ')[0];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const latest = songs.slice(0, 6);
  const favorites = songs.filter(s => s.is_favorite);
  const lastSetlist = setlists[0];
  const groupName = (id?: string | null) => groups.find(g => g.id === id)?.name;

  return (
    <div className="max-w-[1120px] mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-14 flex flex-col gap-10">
      <header className="flex flex-col gap-1.5">
        <p className="m-0 text-xs font-semibold uppercase text-cyan-600 dark:text-cyan-400 first-letter:uppercase" style={{ letterSpacing: '0.08em' }}>{today}</p>
        <h1 className="m-0 font-display font-extrabold text-4xl md:text-[52px] leading-none" style={{ letterSpacing: '-0.035em' }}>
          Bonjour{firstName ? ` ${firstName}` : ''}
        </h1>
        <p className="mt-1 mb-0 text-lg text-slate-600 dark:text-slate-400">
          {songs.length} chanson{songs.length > 1 ? 's' : ''} dans votre bibliothèque{favorites.length ? `, dont ${favorites.length} en favoris` : ''}.
        </p>
      </header>

      {lastSetlist && (
        <section aria-labelledby="t-next" className="flex flex-wrap items-center gap-6 px-6 md:px-7 py-6 bg-stage text-[#ECEDE9] rounded-xl">
          <div className="flex-1 basis-[320px] min-w-0 flex flex-col gap-1">
            <p className="m-0 text-xs font-semibold uppercase text-amber-400" style={{ letterSpacing: '0.08em' }}>Dernière setlist créée</p>
            <h2 id="t-next" className="m-0 font-display font-extrabold text-[28px] leading-tight">{lastSetlist.title}</h2>
            <p className="m-0 text-[#A9AEB8]">
              {[fmtDate(lastSetlist.created_at), groupName(lastSetlist.group_id), lastSetlist.song_count !== undefined ? `${lastSetlist.song_count} morceaux` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('setlists')}
              className="inline-flex items-center h-11 px-4 rounded-md border border-[#343842] text-[#ECEDE9] font-semibold hover:border-[#A9AEB8]"
            >
              Ouvrir
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-10 items-start">
        <section aria-labelledby="t-new" className="flex-[999_1_460px] min-w-0 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="t-new" className="m-0 font-display font-bold text-[21px]">Dernières chansons</h2>
            <button type="button" onClick={() => onOpenLibrary()} className="text-sm font-semibold underline underline-offset-[3px] decoration-1">Toute la bibliothèque</button>
          </div>
          <div className="border-t-[1.5px] border-ink dark:border-slate-300">
            {latest.length === 0 && (
              <p className="py-6 text-slate-500">Aucune chanson pour l'instant.</p>
            )}
            {latest.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSong(s.id)}
                className="w-full flex items-center gap-3.5 min-h-[60px] px-1 py-2 border-b border-slate-200 dark:border-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="font-semibold truncate">{s.title}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{s.artist}</span>
                </span>
                {s.key && <KeyBadge>{s.key}</KeyBadge>}
              </button>
            ))}
          </div>
        </section>

        <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-10">
          <section aria-labelledby="t-sets" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="t-sets" className="m-0 font-display font-bold text-[21px]">Dernières setlists</h2>
              <button type="button" onClick={() => onNavigate('setlists')} className="text-sm font-semibold underline underline-offset-[3px] decoration-1">Toutes</button>
            </div>
            <div className="border-t-[1.5px] border-ink dark:border-slate-300">
              {setlists.length === 0 && <p className="py-4 text-slate-500">Pas encore de setlist.</p>}
              {setlists.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onNavigate('setlists')}
                  className="w-full flex flex-col gap-0.5 px-1 py-3 border-b border-slate-200 dark:border-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span aria-hidden="true" className="shrink-0 w-2.5 h-2.5 rounded-[3px]" style={{ background: SET_COLORS[i % SET_COLORS.length] }} />
                    {t.title}
                  </span>
                  <span className="pl-5 text-sm text-slate-500 dark:text-slate-400">
                    {[fmtDate(t.created_at), t.song_count !== undefined ? `${t.song_count} morceaux` : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="t-fav" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="t-fav" className="m-0 font-display font-bold text-[21px]">Favoris</h2>
              {favorites.length > 0 && (
                <button type="button" onClick={() => onOpenLibrary(true)} className="text-sm font-semibold underline underline-offset-[3px] decoration-1">
                  Les {favorites.length} favoris
                </button>
              )}
            </div>
            {favorites.length === 0 ? (
              <p className="m-0 text-slate-500">Ajoutez des chansons en favoris depuis leur fiche.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {favorites.slice(0, 8).map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectSong(f.id)}
                    className={`inline-flex items-center gap-2 h-10 px-3 rounded-md text-sm font-semibold ${FAV_TINTS[i % FAV_TINTS.length]}`}
                  >
                    {f.title}
                    {f.key && <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">{f.key}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
