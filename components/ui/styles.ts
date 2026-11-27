/** Shared Tailwind class strings for the Unison design system. */
export const inputCls =
  'w-full h-11 px-3 rounded-md border border-slate-400 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-ink dark:text-slate-100 text-base outline-none placeholder:text-slate-500 focus:border-cyan-600 dark:focus:border-cyan-400';
export const labelCls = 'text-sm font-semibold';
export const primaryBtn =
  'inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors disabled:opacity-50';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold hover:border-slate-500 transition-colors disabled:opacity-50';
export const alertCls = (type: 'error' | 'success') =>
  type === 'error'
    ? 'm-0 px-3 py-2.5 rounded-md bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300 text-sm'
    : 'm-0 px-3 py-2.5 rounded-md bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 text-sm';
export const cardCls = 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl';
export const eyebrowCls = 'm-0 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-widest';
