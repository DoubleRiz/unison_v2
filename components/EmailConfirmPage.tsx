import React from 'react';
import { Check } from 'lucide-react';
import { primaryBtn, cardCls } from './ui/styles';

interface Props {
  onContinue: () => void;
}

const EmailConfirmPage: React.FC<Props> = ({ onContinue }) => {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-ink dark:text-slate-100 flex items-center justify-center p-4">
      <section aria-labelledby="t-confirm" className={`max-w-[400px] w-full p-8 flex flex-col gap-4 ${cardCls}`}>
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-400">
          <Check size={24} strokeWidth={2.4} />
        </span>
        <h1 id="t-confirm" className="m-0 font-display font-extrabold text-[28px] leading-tight">Email confirmé</h1>
        <p className="m-0 text-slate-600 dark:text-slate-400">
          Votre compte est actif. Vous pouvez créer vos chansons, vos setlists et rejoindre un groupe.
        </p>
        <button type="button" onClick={onContinue} className={`${primaryBtn} mt-2`}>
          Ouvrir la bibliothèque
        </button>
      </section>
    </div>
  );
};

export default EmailConfirmPage;
