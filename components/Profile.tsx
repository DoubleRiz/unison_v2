import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Mail, Lock, Music, Activity, Save } from 'lucide-react';
import { Song } from '../types';

interface ProfileProps {
  user: any;
  songs: Song[];
  onNavigateToGroups?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, songs, onNavigateToGroups }) => {
  const [username, setUsername] = useState(user.user_metadata.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const userSongs = songs.filter(s => s.user_id === user.id);
  const totalSongs = userSongs.length;
  const publicSongs = userSongs.filter(s => s.is_public).length;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 1. Update Metadata (Username)
      if (username !== user.user_metadata.full_name) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { full_name: username }
        });
        if (metaError) throw metaError;
      }

      // 2. Update Email (if changed)
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email });
        if (emailError) throw emailError;
        setMessage({ type: 'success', text: 'Lien de confirmation envoyé à la nouvelle adresse.' });
      }

      // 3. Update Password (if provided)
      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: password });
        if (pwdError) throw pwdError;
      }

      // 4. Update Public User Table (Optional but good for syncing)
      await supabase.from('users').update({ username: username }).eq('id', user.id);

      if (!message) {
         setMessage({ type: 'success', text: 'Profil mis à jour.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
      setPassword(''); // Clear password field
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-ink dark:text-white mb-2">Profil</h1>
        <p className="text-slate-600 dark:text-slate-400">Vos informations de compte et votre répertoire.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stats */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">Statistiques</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                   <Music size={20} />
                 </div>
                 <div>
                   <div className="text-2xl font-bold text-ink dark:text-white">{totalSongs}</div>
                   <div className="text-xs text-slate-500">Chansons</div>
                 </div>
              </div>
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                   <Activity size={20} />
                 </div>
                 <div>
                   <div className="text-2xl font-bold text-ink dark:text-white">{publicSongs}</div>
                   <div className="text-xs text-slate-500">Publiques</div>
                 </div>
              </div>
            </div>
          </div>
          
          {onNavigateToGroups && (
            <button 
              onClick={onNavigateToGroups}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 rounded-2xl group-hover:scale-110 transition-transform">
                  <Activity size={24} />
                </div>
                <div className="text-left">
                  <div className="text-ink dark:text-white font-bold">Groupes</div>
                  <div className="text-xs text-slate-500">Gérer vos groupes</div>
                </div>
              </div>
              <Activity className="text-slate-600 group-hover:text-cyan-500 transition-colors" size={20} />
            </button>
          )}

           <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
             <div className="w-full h-32 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center text-slate-600 mb-3">
               <User size={48} />
             </div>
             <div className="text-center">
                <div className="text-ink dark:text-white font-bold">{username}</div>
                <div className="text-xs text-slate-500">{email}</div>
             </div>
           </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
           <form onSubmit={handleUpdateProfile} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h3 className="text-xl font-bold text-ink dark:text-white mb-6">Informations</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom affiché</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-600" size={16} />
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-ink dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                 <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Adresse email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-600" size={16} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-ink dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                 <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nouveau mot de passe (laisser vide pour le conserver)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-600" size={16} />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-400 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-ink dark:text-white focus:outline-none focus:border-cyan-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              {message && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {message.text}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save size={18} />
                  Enregistrer
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;