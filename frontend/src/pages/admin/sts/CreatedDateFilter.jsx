import React from 'react';
import { CalendarDays, X } from 'lucide-react';

// "YYYY-MM-DD" for a timestamp, in the viewer's local timezone (IST for the team) — the
// same shape an <input type="date"> produces, so records can be matched to the picked day.
// Created dates are stored in UTC, so a record added at 2 AM IST counts on that IST day.
export const toLocalDateKey = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const todayKey = () => toLocalDateKey(new Date());

// DD/MM/YYYY for showing a record's created date in the picker lists.
export const formatCreated = (value) => (value ? new Date(value).toLocaleDateString('en-GB') : '—');

// Single-day "STS created on" picker shared by the bulk Assign / De-Assign forms.
// `unavailable` = the loaded records carry no created date at all (an older backend build),
// so the filter can't match anything — say so instead of silently showing 0 records.
const CreatedDateFilter = ({ value, onChange, matchCount, inputClass, unavailable = false, accentClass = 'text-primary-600 dark:text-primary-400' }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">STS Created Date</label>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <CalendarDays className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="date"
        max={todayKey()}
        className={`${inputClass} pl-10 [color-scheme:light] dark:[color-scheme:dark]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
    {value && unavailable && (
      <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        Created dates aren't available — the backend needs to be restarted to pick up this filter.
      </p>
    )}
    {value && !unavailable && matchCount != null && (
      <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
        <span className={`font-bold ${accentClass}`}>{matchCount.toLocaleString()}</span>
        {' '}record{matchCount === 1 ? '' : 's'} created on{' '}
        {new Date(`${value}T00:00:00`).toLocaleDateString('en-GB')}
      </p>
    )}
  </div>
);

export default CreatedDateFilter;
