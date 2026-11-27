import React, { useEffect } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md';
}

/** Plain dialog: ink scrim, paper panel, display title, actions bottom-right. */
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, footer, width = 'sm' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width === 'md' ? 'max-w-md' : 'max-w-sm'} bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col gap-4 text-ink dark:text-slate-100`}
      >
        <h2 className="m-0 font-display font-bold text-[21px] leading-tight">{title}</h2>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2 pt-1">{footer}</div>}
      </div>
    </div>
  );
};
