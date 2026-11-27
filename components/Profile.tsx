import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { Song } from '../types';
import { Initials } from './ui/Brand';
import { Segmented } from './ui/Segmented';
import { alertCls, inputCls, labelCls, secondaryBtn } from './ui/styles';

interface ProfileProps {
  user: any;
  songs: Song[];
  groupsCount?: number;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  onSignOut?: () => void;
  onNavigateToGroups?: () => void;
}

const cellCls = [
  'pr-4',
  'px-4 border-l',
  'px-4 max-sm:pl-0 max-sm:border-t sm:border-l',
  'px-4 border-l max-sm:border-t'
].map(c => `flex flex-col gap-0.5 py-5 border-slate-200 dark:border-slate-800 ${c}`);

const Stat: React.FC<{ value: React.ReactNode; label: string; index: number }> = ({ value, label, index }) => (
  <div className={cellCls[index]}>
    <span className="font-display font-extrabold text-4xl leading-none" style={{ letterSpacing: '-0.02em' }}>{value}</span>
    <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
  </div>
);

const Profile: React.FC<ProfileProps> = ({ user, songs, groupsCount, theme, onThemeChange, onSignOut, onNavigateToGroups }) => {
  const initialName = user.user_metadata?.full_name || '';
  const [username, setUsername] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [setlistCount, setSetlistCount] = useState<number | null>(null);

  const userSongs = songs.filter(s => s.user_id === user.id);
  const totalSongs = userSongs.length;
  const publicSongs = userSongs.filter(s => s.is_public).length;
  const displayName = savedName || user.email?.split('@')[0] || 'Musicien·ne';
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('setlists')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled && !error) setSetlistCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let text = 'Profil mis à jour.';

      if (username !== savedName) {
        const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: username } });
        if (metaError) throw metaError;
        await supabase.from('users').update({ username }).eq('id', user.id);
        setSavedName(username);
      }

      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        text = 'Profil mis à jour. Un lien de confirmation a été envoyé à la nouvelle adresse.';
      }

      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password });
        if (pwdError) throw pwdError;
      }

      setMessage({ type: 'success', text });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div className="max-w-[960px] mx-auto flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-5">
        <Initials name={displayName} src={user.user_metadata?.avatar_url} size={72} />
        <div className="flex-1 min-w-0">
          <h1 className="m-0 font-display font-extrabold text-4xl leading-tight break-words" style={{ letterSpacing: '-0.025em' }}>{displayName}</h1>
          <p className="mt-1 mb-0 text-slate-600 dark:text-slate-400">
            {[user.email, memberSince ? `membre depuis ${memberSince}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <section aria-label="Statistiques" className="grid grid-cols-2 sm:grid-cols-4 border-t-[1.5px] border-ink dark:border-slate-300 border-b border-b-slate-200 dark:border-b-slate-800">
        <Stat index={0} value={totalSongs} label={totalSongs > 1 ? 'Chansons créées' : 'Chanson créée'} />
        <Stat index={1} value={publicSongs} label={publicSongs > 1 ? 'Publiques' : 'Publique'} />
        <Stat index={2} value={setlistCount ?? '–'} label={setlistCount === 1 ? 'Setlist' : 'Setlists'} />
        {onNavigateToGroups ? (
          <button type="button" onClick={onNavigateToGroups} className={cellCls[3] + ' text-left hover:bg-slate-100 dark:hover:bg-slate-800/50'}>
            <span className="font-display font-extrabold text-4xl leading-none" style={{ letterSpacing: '-0.02em' }}>{groupsCount ?? '–'}</span>
            <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">Groupes →</span>
          </button>
        ) : (
          <Stat index={3} value={groupsCount ?? '–'} label="Groupes" />
        )}
      </section>

      <div className="flex flex-wrap gap-10 items-start">
        <form onSubmit={handleUpdateProfile} className="flex-[1_1_360px] min-w-0 flex flex-col gap-4">
          <h2 className="m-0 font-display font-bold text-[21px]">Mon compte</h2>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Nom d'artiste</span>
            <input type="text" autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Nouveau mot de passe</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
            <span className="text-sm text-slate-500 dark:text-slate-400">Laissez vide pour garder l'actuel.</span>
          </label>
          {message && <p role="status" className={alertCls(message.type)}>{message.text}</p>}
          <button
            type="submit"
            disabled={loading}
            className="self-start inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />} Enregistrer
          </button>
        </form>

        <section className="flex-[1_1_300px] min-w-0 flex flex-col gap-4">
          <h2 className="m-0 font-display font-bold text-[21px]">Préférences</h2>
          {theme && onThemeChange && (
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>Apparence</span>
              <Segmented
                label="Apparence"
                value={theme}
                onChange={onThemeChange}
                className="self-start"
                options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]}
              />
            </div>
          )}
          {onSignOut && (
            <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className={labelCls}>Session</span>
              <button type="button" onClick={onSignOut} className={secondaryBtn + ' self-start'}>Se déconnecter</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Profile;
