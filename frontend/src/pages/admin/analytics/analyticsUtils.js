import { useTheme } from '../../../context/ThemeContext';

// Non-component helpers for the Employee Analytics pages (kept apart so fast refresh works).

export const PERIODS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

const pad = (n) => String(n).padStart(2, '0');
export const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Turns the period kept in the URL (?period=30d or ?from=…&to=…) into the API's { from, to }.
export const rangeFromParams = (params) => {
  const period = params.get('period') || '30d';
  const today = new Date();
  if (period === 'custom') {
    return { period, from: params.get('from') || undefined, to: params.get('to') || undefined };
  }
  if (period === 'all') return { period };
  if (period === 'month') {
    return { period, from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIsoDate(today) };
  }
  const days = parseInt(period, 10) || 30;
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { period, from: toIsoDate(start), to: toIsoDate(today) };
};

export const periodLabel = (range) => {
  if (range.period === 'all') return 'all time';
  if (range.period === 'custom') {
    if (range.from && range.to) return `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
    if (range.from) return `since ${fmtDate(range.from)}`;
    if (range.to) return `up to ${fmtDate(range.to)}`;
    return 'all time';
  }
  if (range.period === 'month') return 'this month';
  return `the last ${parseInt(range.period, 10)} days`;
};

export const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
export const fmtMoney = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const coverageTone = (pct) => (pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500');

// Chart colours validated (light on #fff, dark on slate-800) for the two-series charts:
// series 1 = blue, series 2 = orange. Grid/axis stay recessive.
export const useChartTheme = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    series1: dark ? '#3987e5' : '#2a78d6',
    series2: dark ? '#d95926' : '#eb6834',
    track: dark ? '#334155' : '#e2e8f0',
    grid: dark ? '#334155' : '#e5e7eb',
    tick: dark ? '#94a3b8' : '#64748b',
    tooltip: {
      contentStyle: {
        borderRadius: '0.75rem',
        border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
        background: dark ? '#0f172a' : '#ffffff',
        color: dark ? '#e2e8f0' : '#0f172a',
        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.25)',
        fontSize: 12,
      },
      labelStyle: { color: dark ? '#e2e8f0' : '#0f172a', fontWeight: 700, marginBottom: 4 },
      itemStyle: { color: dark ? '#cbd5e1' : '#334155', padding: 0 },
      cursor: { fill: dark ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.08)' },
    },
  };
};
