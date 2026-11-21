import React, { useState } from 'react';

const QUICK_COUNTS = [50, 100, 200, 500, 1000];

// Tailwind needs literal class names, so each accent spells its classes out.
const ACCENTS = {
  primary: {
    active: 'bg-primary-600 border-primary-600 text-white',
    idle: 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400',
    button: 'bg-primary-600 hover:bg-primary-700 text-white',
    ring: 'focus:ring-primary-500',
  },
  rose: {
    active: 'bg-rose-600 border-rose-600 text-white',
    idle: 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-rose-500 hover:text-rose-600 dark:hover:text-rose-400',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    ring: 'focus:ring-rose-500',
  },
};

// Selects the first N matching records (replacing the current selection),
// in the same order the list shows them.
const QuickSelectBar = ({ total, activeCount, onSelectFirst, accent = 'primary' }) => {
  const [custom, setCustom] = useState('');
  const c = ACCENTS[accent];

  const customValue = parseInt(custom, 10);
  const customValid = Number.isFinite(customValue) && customValue > 0 && total > 0;

  const applyCustom = () => {
    if (!customValid) return;
    onSelectFirst(Math.min(customValue, total));
    setCustom('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold text-gray-500 dark:text-slate-400 mr-1">Quick select first:</span>
      {QUICK_COUNTS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelectFirst(n)}
          disabled={n > total}
          className={`px-2.5 py-1 rounded-full border font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${activeCount === n ? c.active : c.idle}`}
        >
          {n}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <input
          type="number"
          min="1"
          max={total}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
          placeholder="Custom"
          className={`w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${c.ring}`}
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={!customValid}
          className={`px-2.5 py-1 rounded-full font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${c.button}`}
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default QuickSelectBar;
