
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChordVisualizer from './ChordVisualizer';
import { GUITAR_DATA, UKULELE_DATA } from '../constants/chordShapes';

interface ChordTooltipProps {
  chord: string;
  children: React.ReactNode;
}

const ChordTooltip: React.FC<ChordTooltipProps> = ({ chord, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [instrument, setInstrument] = useState<'guitar' | 'ukulele'>('guitar');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const baseChord = chord.split('/')[0];
  const guitarFrets = GUITAR_DATA[baseChord];
  const ukeFrets = UKULELE_DATA[baseChord];

  const hasShape = instrument === 'guitar' ? !!guitarFrets : !!ukeFrets;
  const currentFrets = instrument === 'guitar' ? guitarFrets : ukeFrets;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 160;
    const padding = 16;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    setPosition({
      top: rect.top + window.scrollY - 8, // will be shifted up via transform
      left,
    });
  };

  const show = () => {
    updatePosition();
    setIsVisible(true);
  };

  const hide = () => setIsVisible(false);

  // Close on scroll
  useEffect(() => {
    if (!isVisible) return;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isVisible]);

  const tooltip = isVisible ? (
    <div
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)',
        zIndex: 9999,
      }}
      className="pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="relative bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-3 shadow-xl min-w-[150px] font-sans">
        <div className="flex justify-between items-center gap-3 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
          <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{chord}</span>
          <span className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setInstrument('guitar'); }}
              className={`h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-semibold transition-colors ${instrument === 'guitar' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' : 'text-slate-500 hover:text-ink dark:hover:text-slate-100'}`}
            >
              Guitare
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setInstrument('ukulele'); }}
              className={`h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-semibold transition-colors ${instrument === 'ukulele' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' : 'text-slate-500 hover:text-ink dark:hover:text-slate-100'}`}
            >
              Ukulélé
            </button>
          </span>
        </div>

        {hasShape ? (
          <ChordVisualizer
            frets={currentFrets || []}
            isUke={instrument === 'ukulele'}
            size={110}
          />
        ) : (
          <span className="block py-4 text-[10px] text-slate-500 text-center italic">
            Diagramme indisponible
          </span>
        )}

        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-slate-300 dark:border-t-slate-700"></span>
      </div>
    </div>
  ) : null;

  return (
    <span
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => {
        e.stopPropagation();
        isVisible ? hide() : show();
      }}
    >
      {children}
      {typeof document !== 'undefined' && createPortal(tooltip, document.body)}
    </span>
  );
};

export default ChordTooltip;
