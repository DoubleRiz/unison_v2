import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, X } from 'lucide-react';
import { Logo } from './ui/Brand';
import { inputCls, labelCls, primaryBtn, alertCls } from './ui/styles';

interface AuthProps {
  onClose?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Un lien de réinitialisation a été envoyé à votre adresse email.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,
            }
          }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Compte créé ! Vérifiez votre boîte mail pour le confirmer.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (onClose) onClose();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'signin' | 'signup' | 'forgot') => { setMode(m); setMessage(null); };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <section className="relative w-full max-w-[400px] p-8 bg-slate-50 dark:bg-slate-900 text-ink dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col gap-5">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-ink dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        )}

        <Logo size={28} />

        {mode === 'forgot' ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 id="auth-title" className="m-0 font-display font-extrabold text-[28px] leading-tight">Mot de passe oublié</h2>
              <p className="m-0 text-slate-600 dark:text-slate-400">Recevez un lien pour choisir un nouveau mot de passe.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="vous@exemple.fr" autoComplete="email" />
              </label>
              {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={alertCls(message.type)}>{message.text}</p>}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Envoyer le lien'}
              </button>
            </form>
            <button type="button" onClick={() => switchMode('signin')} className="self-start text-sm font-semibold underline underline-offset-[3px] decoration-1">
              Retour à la connexion
            </button>
          </>
        ) : (
          <>
            <div role="tablist" aria-label="Compte" className="flex border-b border-slate-200 dark:border-slate-800">
              {(['signin', 'signup'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 h-11 -mb-px ${mode === m ? 'border-b-2 border-ink dark:border-slate-100 font-bold' : 'text-slate-600 dark:text-slate-400 font-semibold'}`}
                >
                  {m === 'signin' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>
            <h2 id="auth-title" className="sr-only">{mode === 'signin' ? 'Connexion' : 'Inscription'}</h2>

            <form onSubmit={handleAuth} className="flex flex-col gap-5">
              {mode === 'signup' && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelCls}>Nom affiché</span>
                  <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="Camille R." autoComplete="name" />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="vous@exemple.fr" autoComplete="email" />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm">
                  <label htmlFor="auth-password" className="font-semibold">Mot de passe</label>
                  {mode === 'signin' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="underline underline-offset-[3px] decoration-1">
                      Oublié ?
                    </button>
                  )}
                </span>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>

              {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={alertCls(message.type)}>{message.text}</p>}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};

export default Auth;
