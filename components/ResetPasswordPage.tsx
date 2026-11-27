
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { inputCls, labelCls, primaryBtn, alertCls, cardCls } from './ui/styles';

interface Props {
  onDone: () => void;
}

const ResetPasswordPage: React.FC<Props> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Mot de passe mis à jour !' });
      setTimeout(onDone, 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-ink dark:text-slate-100 flex items-center justify-center p-4">
      <section aria-labelledby="t-reset" className={`w-full max-w-[400px] p-8 flex flex-col gap-4 ${cardCls}`}>
        <h1 id="t-reset" className="m-0 font-display font-extrabold text-[28px] leading-tight">Nouveau mot de passe</h1>
        <p className="m-0 text-slate-600 dark:text-slate-400">Choisissez un nouveau mot de passe pour votre compte.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Nouveau mot de passe</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="new-password" />
            <span className="text-sm text-slate-500">6 caractères minimum.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Confirmer</span>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${inputCls} ${mismatch ? '!border-red-700 dark:!border-red-400 border-[1.5px]' : ''}`}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={mismatch}
            />
            {mismatch && <span className="text-sm text-red-700 dark:text-red-400">Les deux mots de passe ne correspondent pas.</span>}
          </label>

          {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={alertCls(message.type)}>{message.text}</p>}

          <button type="submit" disabled={loading} className={`${primaryBtn} mt-1`}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Mettre à jour'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ResetPasswordPage;
