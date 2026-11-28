import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Notifications d'erreur globales.
 * `notifyError()` peut être appelé depuis n'importe quel composant ;
 * le `<Toaster />` monté dans App.tsx les affiche.
 */

interface ToastItem {
  id: number;
  message: string;
}

type Listener = (toast: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Traduit une erreur Supabase / réseau en message lisible. */
export const describeError = (error: unknown): string => {
  const e = error as { message?: string; code?: string; status?: number } | null;
  const msg = e?.message ?? '';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Vous êtes hors ligne.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Le serveur est injoignable. Vérifiez votre connexion.';
  if (e?.code === '42501' || e?.status === 403 || /row-level security|permission denied/i.test(msg)) {
    return 'Vous n\'avez pas les droits pour cette action.';
  }
  if (e?.status === 401 || /jwt|not authenticated/i.test(msg)) return 'Votre session a expiré : reconnectez-vous.';
  return 'Une erreur inattendue est survenue.';
};

/** Erreur dont le message est déjà rédigé pour l'utilisateur (affiché tel quel). */
export class UserFacingError extends Error {}

/** Construit le message complet : action + cause traduite. */
export const errorMessage = (action: string, error: unknown): string =>
  error instanceof UserFacingError ? error.message : `${action} ${describeError(error)}`;

/**
 * Affiche une erreur à l'utilisateur.
 * @param action ce qui a échoué, ex. « Impossible d'enregistrer la chanson. »
 * @param error  l'erreur d'origine (sert à préciser la cause, et part en console)
 */
export const notifyError = (action: string, error?: unknown) => {
  if (error !== undefined) console.error(action, error);
  const message = error !== undefined ? errorMessage(action, error) : action;
  const toast = { id: nextId++, message };
  listeners.forEach(l => l(toast));
};

const DURATION = 7000;

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setToasts(prev => [...prev.filter(t => t.message !== toast.message), toast].slice(-3));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), DURATION);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[100] left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-[380px] flex flex-col gap-2 pointer-events-none"
      aria-live="assertive"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role="alert"
          className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-slate-900 text-red-700 dark:text-red-300 text-sm shadow-lg"
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
          <p className="m-0 flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Fermer"
            className="shrink-0 -mr-1 p-1 rounded text-red-700/70 dark:text-red-300/70 hover:text-red-700 dark:hover:text-red-300"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
