import React from 'react';

/** Unison mark: a blue tile with a "u" held between two brackets. */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect width="26" height="26" rx="4" fill="#2440D6" />
    <g fill="none" stroke="#FBFBF9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 6.5H6V19.5H8.5" />
      <path d="M17.5 6.5H20V19.5H17.5" />
      <path d="M10.5 9.5V14a2.5 2.5 0 0 0 5 0V9.5" />
    </g>
  </svg>
);

export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`font-display font-extrabold text-[21px] tracking-tight leading-none ${className}`}>unison</span>
);

export const Logo: React.FC<{ size?: number; className?: string; onClick?: () => void }> = ({ size = 26, className = '', onClick }) => {
  const content = (
    <>
      <LogoMark size={size} />
      <Wordmark />
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`flex items-center gap-2.5 ${className}`} aria-label="Unison, accueil">
        {content}
      </button>
    );
  }
  return <span className={`flex items-center gap-2.5 ${className}`}>{content}</span>;
};

/** Dice icon used for "Chanson au hasard". */
export const DiceIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

/** Key / chord badge: mono, accent ink on accent tint. */
export const KeyBadge: React.FC<{ children: React.ReactNode; size?: 'sm' | 'md'; outlined?: boolean; className?: string }> = ({
  children,
  size = 'sm',
  outlined = false,
  className = ''
}) => (
  <span
    className={`inline-flex items-center font-mono font-bold rounded text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900 ${
      size === 'md' ? 'text-base px-2 py-0.5' : 'text-sm px-1.5 py-px'
    } ${outlined ? 'border-[1.5px] border-cyan-600 dark:border-cyan-400' : ''} ${className}`}
  >
    {children}
  </span>
);

/** Small uppercase label used above sections. */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string; as?: 'p' | 'h2' | 'h3' | 'span' }> = ({
  children,
  className = '',
  as = 'p'
}) => {
  const Tag = as as any;
  return (
    <Tag className={`m-0 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-sans ${className}`} style={{ letterSpacing: '0.08em' }}>
      {children}
    </Tag>
  );
};

/** Initials avatar on an amber tile. */
export const Initials: React.FC<{ name?: string; src?: string; size?: number; className?: string }> = ({ name = '', src, size = 32, className = '' }) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('') || '?';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-amber-400 text-ink font-display font-extrabold overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials}
    </span>
  );
};
