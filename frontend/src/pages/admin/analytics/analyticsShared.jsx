import React from 'react';
import { CalendarRange } from 'lucide-react';
import { PERIODS, coverageTone, rangeFromParams, toIsoDate } from './analyticsUtils';

// Shared bits for the Employee Analytics overview + drill-down pages.

// Period selector: preset chips that scroll sideways on phones, plus from/to inputs for "Custom".
export const PeriodPicker = ({ params, setParams }) => {
  const range = rangeFromParams(params);
  const select = (id) => {
    const next = new URLSearchParams(params);
    next.set('period', id);
    if (id === 'custom') {
      if (!next.get('from')) next.set('from', range.from || toIsoDate(new Date(Date.now() - 29 * 864e5)));
      if (!next.get('to')) next.set('to', range.to || toIsoDate(new Date()));
    } else {
      next.delete('from');
      next.delete('to');
    }
    setParams(next, { replace: true });
  };
  const setBound = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const dateClass = 'w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';

  return (
    <div className="flex flex-col gap-2 w-full lg:w-auto">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
        <CalendarRange className="w-4 h-4 mx-1.5 shrink-0 text-gray-400 dark:text-slate-500" />
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => select(p.id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              range.period === p.id
                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {range.period === 'custom' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
          <input type="date" aria-label="From date" className={dateClass} value={range.from || ''} max={range.to || undefined} onChange={(e) => setBound('from', e.target.value)} />
          <span className="hidden sm:inline text-xs font-semibold text-gray-400">to</span>
          <input type="date" aria-label="To date" className={dateClass} value={range.to || ''} min={range.from || undefined} onChange={(e) => setBound('to', e.target.value)} />
        </div>
      )}
    </div>
  );
};

// Per-tone styling. Light theme gets a tinted card + solid gradient icon chip; dark theme keeps
// the plain slate card with a soft icon chip. Class strings stay literal so Tailwind keeps them.
const TONES = {
  blue: {
    card: 'bg-gradient-to-br from-blue-50 via-white to-sky-50 border-blue-100',
    icon: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 dark:bg-none dark:bg-blue-500/10 dark:text-blue-400 dark:shadow-none',
    label: 'text-blue-700/80',
    glow: 'bg-blue-300/30',
  },
  emerald: {
    card: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-100',
    icon: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md shadow-emerald-500/25 dark:bg-none dark:bg-emerald-500/10 dark:text-emerald-400 dark:shadow-none',
    label: 'text-emerald-700/80',
    glow: 'bg-emerald-300/30',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-100',
    icon: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25 dark:bg-none dark:bg-amber-500/10 dark:text-amber-400 dark:shadow-none',
    label: 'text-amber-700/80',
    glow: 'bg-amber-300/30',
  },
  rose: {
    card: 'bg-gradient-to-br from-rose-50 via-white to-pink-50 border-rose-100',
    icon: 'bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-md shadow-rose-500/25 dark:bg-none dark:bg-rose-500/10 dark:text-rose-400 dark:shadow-none',
    label: 'text-rose-700/80',
    glow: 'bg-rose-300/30',
  },
  indigo: {
    card: 'bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-100',
    icon: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 dark:bg-none dark:bg-indigo-500/10 dark:text-indigo-400 dark:shadow-none',
    label: 'text-indigo-700/80',
    glow: 'bg-indigo-300/30',
  },
  slate: {
    card: 'bg-gradient-to-br from-slate-100 via-white to-slate-50 border-slate-200',
    icon: 'bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md shadow-slate-500/25 dark:bg-none dark:bg-slate-500/10 dark:text-slate-300 dark:shadow-none',
    label: 'text-slate-600',
    glow: 'bg-slate-300/30',
  },
  violet: {
    card: 'bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-violet-100',
    icon: 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 dark:bg-none dark:bg-violet-500/10 dark:text-violet-400 dark:shadow-none',
    label: 'text-violet-700/80',
    glow: 'bg-violet-300/30',
  },
  cyan: {
    card: 'bg-gradient-to-br from-cyan-50 via-white to-sky-50 border-cyan-100',
    icon: 'bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-md shadow-cyan-500/25 dark:bg-none dark:bg-cyan-500/10 dark:text-cyan-400 dark:shadow-none',
    label: 'text-cyan-700/80',
    glow: 'bg-cyan-300/30',
  },
};

export const StatTile = ({ icon: Icon, label, value, hint, tone = 'blue', onClick, active }) => {
  const Tag = onClick ? 'button' : 'div';
  const t = TONES[tone] || TONES.blue;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden text-left w-full min-w-0 ${t.card} dark:bg-none dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border shadow-sm transition-all duration-200 ${
        active ? '!border-primary-400 dark:!border-primary-500/60 ring-2 ring-primary-500/20' : 'dark:border-slate-700'
      } ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : ''}`}
    >
      <span className={`pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl ${t.glow} dark:hidden`} />
      <div className="relative flex items-start justify-between gap-3">
        <p className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${t.label} dark:text-slate-400 leading-snug`}>{label}</p>
        {Icon && (
          <span className={`p-2 rounded-xl shrink-0 ${t.icon}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <p className="relative mt-1 text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white truncate">{value}</p>
      {hint && <p className="relative mt-1 text-xs text-gray-500 dark:text-slate-400 truncate" title={typeof hint === 'string' ? hint : undefined}>{hint}</p>}
    </Tag>
  );
};

// Touched-vs-held progress bar; colour shifts with how much of their data they've worked.

export const CoverageBar = ({ value, className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden min-w-[3rem]">
      <div className={`h-full rounded-full ${coverageTone(value)}`} style={{ width: `${Math.min(100, Math.max(value > 0 ? 2 : 0, value))}%` }} />
    </div>
    <span className="text-xs font-bold tabular-nums text-gray-700 dark:text-slate-200 w-11 text-right">{value}%</span>
  </div>
);

export const Card = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm min-w-0 ${className}`}>
    {(title || action) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="min-w-0">
          {title && <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className="p-4 sm:p-6">{children}</div>
  </section>
);

export const LegendDot = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
    {label}
  </span>
);

export const EmptyState = ({ icon: Icon, title, message }) => (
  <div className="py-10 flex flex-col items-center justify-center text-center">
    {Icon && (
      <div className="w-14 h-14 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 mb-3">
        <Icon className="w-7 h-7 text-gray-400 dark:text-slate-500" />
      </div>
    )}
    <p className="font-bold text-gray-900 dark:text-white">{title}</p>
    {message && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-sm">{message}</p>}
  </div>
);
