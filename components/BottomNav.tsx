import React from 'react';

interface BottomNavProps {
  currentView: string;
  onNavigate: (view: any) => void;
  pendingInvitesCount: number;
}

const icons: Record<string, React.ReactNode> = {
  landing: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  search: <path d="M5 4v16M10 4v16M15 4l4 16" />,
  setlists: <path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1" />,
  'chord-dictionary': (
    <>
      <path d="M6 4v16M10 4v16M14 4v16M18 4v16M4 8h16" />
      <circle cx="10" cy="12" r="1.6" fill="currentColor" />
      <circle cx="14" cy="15" r="1.6" fill="currentColor" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  )
};

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate, pendingInvitesCount }) => {
  const navItems = [
    { id: 'landing', label: 'Accueil' },
    { id: 'search', label: 'Biblio' },
    { id: 'setlists', label: 'Setlists' },
    { id: 'chord-dictionary', label: 'Accords' },
    { id: 'profile', label: 'Moi' }
  ];

  return (
    <nav
      aria-label="Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 h-[72px] pb-2 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {navItems.map((item) => {
        const isActive = currentView === item.id || (item.id === 'profile' && currentView === 'groups');
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-xs ${
              isActive ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-semibold'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons[item.id]}
            </svg>
            {item.label}
            {item.id === 'profile' && pendingInvitesCount > 0 && (
              <span className="absolute top-2 left-1/2 ml-2 w-2 h-2 rounded-full bg-red-500" aria-label={`${pendingInvitesCount} invitation(s)`} />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
