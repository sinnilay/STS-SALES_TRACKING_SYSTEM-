import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity, ArrowDown, ArrowUp, BadgeCheck, ChevronRight, Database, FileCheck2, FileX2, IndianRupee,
  PieChart as PieIcon, Search, Sparkles, UserX, Users, X,
} from 'lucide-react';
import { employeeService } from '../../../services/employeeService';
import Spinner from '../../../components/Spinner';
import { initials, avatarGradient } from '../../../utils/avatar';
import { timeAgo } from '../../../utils/timeAgo';
import { Card, CoverageBar, EmptyState, LegendDot, PeriodPicker, StatTile } from './analyticsShared';
import { fmtMoney, fmtNum, periodLabel, rangeFromParams, useChartTheme } from './analyticsUtils';

const IDLE_DAYS = 7;
const isIdle = (e) => e.held > 0 && (!e.lastActivityAt || Date.now() - new Date(e.lastActivityAt).getTime() > IDLE_DAYS * 864e5);
const shortName = (name = '') => (name.length > 14 ? `${name.slice(0, 13)}…` : name);
// Founders / managers / the Management department are hidden from the team view unless the
// admin explicitly picks their role or department in the filters.
const LEADERSHIP = /founder|manager|management/i;
const isLeadership = (e) => [e.employeeRole, e.designation, e.department].some((v) => LEADERSHIP.test(v || ''));

const COLUMNS = [
  { key: 'held', label: 'Held', title: 'STS records currently allotted to them (own + shared)' },
  { key: 'touched', label: 'Touched', title: 'Held records they have logged at least one update on' },
  { key: 'untouched', label: 'Untouched', title: 'Held records with no update from them yet' },
  { key: 'coverage', label: 'Coverage', title: 'Touched ÷ held' },
  { key: 'updates', label: 'Updates', title: 'Status updates logged in the selected period' },
  { key: 'conversions', label: 'Converted', title: 'Conversions logged in the selected period' },
  { key: 'revenue', label: 'Revenue', title: 'Value of conversions in the selected period' },
  { key: 'lastActivityAt', label: 'Last update', title: 'Most recent status update (any time)' },
];

export const Avatar = ({ employee, size = 'w-10 h-10', text = 'text-sm' }) => (
  employee.profilePictureUrl ? (
    <img src={employee.profilePictureUrl} alt="" className={`${size} shrink-0 rounded-xl object-cover border border-gray-200 dark:border-slate-600`} />
  ) : (
    <div className={`${size} shrink-0 rounded-xl bg-gradient-to-br ${avatarGradient(employee.id)} text-white flex items-center justify-center font-black ${text} shadow-sm`}>
      {initials(employee.fullName || employee.email)}
    </div>
  )
);

const EmployeeAnalytics = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const range = rangeFromParams(params);
  const chart = useChartTheme();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState({ key: 'updates', dir: 'desc' });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    employeeService.getAnalyticsOverview({ from: range.from, to: range.to })
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) toast.error('Failed to load employee analytics'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const employees = useMemo(() => data?.employees || [], [data]);
  const uniq = (key) => [...new Set(employees.map((e) => (e[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const departments = useMemo(() => uniq('department'), [employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = useMemo(() => uniq('employeeRole'), [employees]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const showLeadership = LEADERSHIP.test(role) || LEADERSHIP.test(department);
    const list = employees.filter((e) =>
      (showLeadership || !isLeadership(e)) &&
      (!department || (e.department || '').trim() === department) &&
      (!role || (e.employeeRole || '').trim() === role) &&
      (status === 'all' || (status === 'active' ? e.isActive : !e.isActive)) &&
      (!q || [e.fullName, e.email, e.department, e.designation, e.cityBranch].some((v) => (v || '').toLowerCase().includes(q))));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];
      if (sort.key === 'lastActivityAt') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      if (sort.key === 'fullName') return dir * (a.fullName || '').localeCompare(b.fullName || '');
      return dir * ((av || 0) - (bv || 0)) || (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [employees, query, department, role, status, sort]);

  const hasFilters = !!(query || department || role || status !== 'active');
  const clearFilters = () => { setQuery(''); setDepartment(''); setRole(''); setStatus('active'); };

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  const openEmployee = (id) => navigate(`/admin/sts/employee-analytics/${id}?${params.toString()}`);

  const workload = useMemo(() => rows.filter((e) => e.held > 0).sort((a, b) => b.held - a.held).slice(0, 10)
    .map((e) => ({ name: shortName(e.fullName || e.email), fullName: e.fullName, Touched: e.touched, Untouched: e.untouched })), [rows]);
  const activity = useMemo(() => rows.filter((e) => e.updates > 0).sort((a, b) => b.updates - a.updates).slice(0, 10)
    .map((e) => ({ name: shortName(e.fullName || e.email), fullName: e.fullName, Updates: e.updates, Conversions: e.conversions })), [rows]);

  const t = data?.totals;
  const teamCoverage = t && t.held > 0 ? Math.round((t.touched * 1000) / t.held) / 10 : 0;
  const idleCount = rows.filter(isIdle).length;
  const selectClass = 'w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm shadow-sm focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';

  const tooltipLabel = (_, payload) => payload?.[0]?.payload?.fullName || '';
  const chartHeight = (n) => Math.max(160, n * 38 + 40);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-5 sm:p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg shadow-primary-500/20 shrink-0">
              <PieIcon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                Employee Analytics
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse shrink-0" />
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-2xl">
                How much STS data each employee holds, how much of it they have worked, and what they did in {periodLabel(range)}. Pick an employee for the full breakdown.
              </p>
            </div>
          </div>
          <PeriodPicker params={params} setParams={setParams} />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="py-16"><Spinner /></div>
      ) : !data ? (
        <Card><EmptyState icon={Users} title="Couldn't load analytics" message="Check your connection and try again." /></Card>
      ) : (
        <>
          {/* Team KPIs */}
          <div className={`grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
            <StatTile icon={Database} tone="slate" label="Total STS data" value={fmtNum(t.totalRecords)} hint={`${fmtNum(t.allocatedRecords)} allotted · ${fmtNum(t.unallocatedRecords)} unallotted`} />
            <StatTile icon={FileCheck2} tone="emerald" label="Touched" value={fmtNum(t.touched)} hint={`${teamCoverage}% of ${fmtNum(t.held)} held records`} />
            <StatTile icon={FileX2} tone="rose" label="Untouched" value={fmtNum(t.untouched)} hint="Allotted, no update logged yet" />
            <StatTile icon={Activity} tone="blue" label="Updates" value={fmtNum(t.updates)} hint={`Logged in ${periodLabel(range)}`} />
            <StatTile icon={BadgeCheck} tone="indigo" label="Conversions" value={fmtNum(t.conversions)} hint={`${fmtNum(t.created)} new records added`} />
            <StatTile icon={IndianRupee} tone="amber" label="Revenue" value={fmtMoney(t.revenue)} hint={`Converted in ${periodLabel(range)}`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <Card
              title="Workload & coverage"
              subtitle="Top 10 by records held — how much of their data each person has touched"
              action={<div className="flex gap-3"><LegendDot color={chart.series1} label="Touched" /><LegendDot color={chart.track} label="Untouched" /></div>}
            >
              {workload.length === 0 ? (
                <EmptyState icon={Database} title="No records allotted" message="Allot STS records to employees to see their workload here." />
              ) : (
                <div style={{ height: chartHeight(workload.length) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workload} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
                      <CartesianGrid horizontal={false} stroke={chart.grid} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={96} tick={{ fill: chart.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip {...chart.tooltip} labelFormatter={tooltipLabel} formatter={(v) => fmtNum(v)} />
                      <Bar dataKey="Touched" stackId="w" fill={chart.series1} stroke={chart.dark ? '#1e293b' : '#ffffff'} strokeWidth={2} maxBarSize={22} />
                      <Bar dataKey="Untouched" stackId="w" fill={chart.track} stroke={chart.dark ? '#1e293b' : '#ffffff'} strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card
              title="Activity"
              subtitle={`Top 10 by status updates in ${periodLabel(range)}`}
              action={<div className="flex gap-3"><LegendDot color={chart.series1} label="Updates" /><LegendDot color={chart.series2} label="Conversions" /></div>}
            >
              {activity.length === 0 ? (
                <EmptyState icon={Activity} title="No updates in this period" message="Try a longer period, or check back once the team logs call updates." />
              ) : (
                <div style={{ height: chartHeight(activity.length) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activity} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap={8}>
                      <CartesianGrid horizontal={false} stroke={chart.grid} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={96} tick={{ fill: chart.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip {...chart.tooltip} labelFormatter={tooltipLabel} formatter={(v) => fmtNum(v)} />
                      <Bar dataKey="Updates" fill={chart.series1} radius={[0, 4, 4, 0]} maxBarSize={12} />
                      <Bar dataKey="Conversions" fill={chart.series2} radius={[0, 4, 4, 0]} maxBarSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Employee list */}
          <Card
            title={`Team (${rows.length})`}
            subtitle={idleCount > 0 ? `${idleCount} with allotted data and no update in the last ${IDLE_DAYS} days` : 'Tap an employee for their full analytics'}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 mb-4">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, department, city…"
                  className={`${selectClass} pl-10`}
                />
              </div>
              <select className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                <option value="">All roles</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="all">Active + inactive</option>
              </select>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            </div>

            {/* Mobile sort control (the table headers sort on desktop) */}
            <div className="lg:hidden flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 shrink-0">Sort by</span>
              <select className={`${selectClass} py-2`} value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: e.target.value === 'fullName' ? 'asc' : 'desc' })}>
                <option value="fullName">Name</option>
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' }))}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300"
                aria-label={sort.dir === 'desc' ? 'Sort ascending' : 'Sort descending'}
              >
                {sort.dir === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>

            {rows.length === 0 ? (
              <EmptyState icon={UserX} title="No employees match" message="Try a different search or clear the filters." />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block -mx-6 -mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40">
                        <th className="text-left px-6 py-3">
                          <SortHeader label="Employee" active={sort.key === 'fullName'} dir={sort.dir} onClick={() => toggleSort('fullName')} />
                        </th>
                        {COLUMNS.map((c) => (
                          <th key={c.key} className={`px-3 py-3 ${c.key === 'coverage' ? 'text-left min-w-[150px]' : 'text-right'}`} title={c.title}>
                            <SortHeader label={c.label} active={sort.key === c.key} dir={sort.dir} onClick={() => toggleSort(c.key)} align={c.key === 'coverage' ? 'left' : 'right'} />
                          </th>
                        ))}
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/70">
                      {rows.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => openEmployee(e.id)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') openEmployee(e.id); }}
                          tabIndex={0}
                          className="group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-slate-700/40 focus:outline-none focus-visible:bg-primary-50 dark:focus-visible:bg-slate-700/60 transition-colors"
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar employee={e} />
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 dark:text-white truncate max-w-[220px] flex items-center gap-2">
                                  {e.fullName || e.email}
                                  {!e.isActive && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[220px]">
                                  {[e.employeeRole, e.department].filter(Boolean).join(' · ') || e.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(e.held)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">{fmtNum(e.touched)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-rose-600 dark:text-rose-400 font-semibold">{fmtNum(e.untouched)}</td>
                          <td className="px-3 py-3.5">{e.held > 0 ? <CoverageBar value={e.coverage} /> : <span className="text-xs text-gray-400">No data held</span>}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-gray-700 dark:text-slate-200">{fmtNum(e.updates)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-gray-700 dark:text-slate-200">{fmtNum(e.conversions)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-gray-700 dark:text-slate-200 whitespace-nowrap">{e.revenue > 0 ? fmtMoney(e.revenue) : '—'}</td>
                          <td className="px-3 py-3.5 text-right whitespace-nowrap">
                            <LastActivity employee={e} />
                          </td>
                          <td className="pr-4">
                            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / tablet cards */}
                <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rows.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openEmployee(e.id)}
                      className="text-left p-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 hover:border-primary-300 dark:hover:border-primary-500/40 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar employee={e} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{e.fullName || e.email}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{[e.employeeRole, e.department].filter(Boolean).join(' · ') || e.email}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                        <MiniStat label="Held" value={fmtNum(e.held)} />
                        <MiniStat label="Touched" value={fmtNum(e.touched)} className="text-emerald-600 dark:text-emerald-400" />
                        <MiniStat label="Untouched" value={fmtNum(e.untouched)} className="text-rose-600 dark:text-rose-400" />
                        <MiniStat label="Updates" value={fmtNum(e.updates)} />
                      </div>
                      {e.held > 0 && <CoverageBar value={e.coverage} className="mt-3" />}
                      <div className="flex items-center justify-between gap-2 mt-3 text-xs text-gray-500 dark:text-slate-400">
                        <span>{fmtNum(e.conversions)} converted{e.revenue > 0 ? ` · ${fmtMoney(e.revenue)}` : ''}</span>
                        <LastActivity employee={e} />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

const SortHeader = ({ label, active, dir, onClick, align = 'left' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${align === 'right' ? 'flex-row-reverse' : ''} ${
      active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
    }`}
  >
    {label}
    {active ? (dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <span className="w-3" />}
  </button>
);

const MiniStat = ({ label, value, className = 'text-gray-900 dark:text-white' }) => (
  <div className="min-w-0">
    <p className={`text-base font-black tabular-nums truncate ${className}`}>{value}</p>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 truncate">{label}</p>
  </div>
);

const LastActivity = ({ employee }) => (
  isIdle(employee) ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400" title={`No update in the last ${IDLE_DAYS} days`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {employee.lastActivityAt ? timeAgo(employee.lastActivityAt) : 'Never'}
    </span>
  ) : (
    <span className="text-xs text-gray-500 dark:text-slate-400">{employee.lastActivityAt ? timeAgo(employee.lastActivityAt) : '—'}</span>
  )
);

export default EmployeeAnalytics;
