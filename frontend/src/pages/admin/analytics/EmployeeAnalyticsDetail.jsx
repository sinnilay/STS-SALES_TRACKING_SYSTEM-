import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, AlarmClock, ArrowLeft, BadgeCheck, Camera, CalendarCheck, CalendarDays, ChevronRight, Database, FileCheck2,
  FileDown, FileX2, FilePlus2, Hand, History, IndianRupee, Inbox, Layers, Loader2, Mail, MapPin, Phone, Search, Share2, Target,
} from 'lucide-react';
import api from '../../../services/api';
import { employeeService } from '../../../services/employeeService';
import { stsService } from '../../../services/stsService';
import Spinner from '../../../components/Spinner';
import Pagination from '../../../components/Pagination';
import StsDetailsDrawer from '../sts/StsDetailsDrawer';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { getStatusMeta, getStatusDisplay, GROUP_STYLES } from '../../../constants/stsPipeline';
import { timeAgo } from '../../../utils/timeAgo';
import { Avatar } from './EmployeeAnalytics';
import { Card, EmptyState, LegendDot, PeriodPicker, StatTile } from './analyticsShared';
import { fmtDate, fmtMoney, fmtNum, periodLabel, rangeFromParams, useChartTheme } from './analyticsUtils';

const RECORD_TABS = [
  { id: 'untouched', label: 'Untouched', icon: FileX2, countKey: 'untouched', empty: 'Every record they hold has at least one update from them.' },
  { id: 'touched', label: 'Touched', icon: FileCheck2, countKey: 'touched', empty: "They haven't logged an update on any record they hold yet." },
  { id: 'overdue', label: 'Overdue follow-ups', icon: AlarmClock, countKey: 'overdueFollowUps', empty: 'No follow-ups past their date.' },
  { id: 'all', label: 'All held', icon: Layers, countKey: 'held', empty: 'No records are allotted to this employee.' },
];
const PAGE_SIZE = 15;

// Status summary buckets for the held records — "Fresh" splits never-updated records out of neutral.
const STATUS_BUCKETS = [
  { id: 'fresh', label: 'Fresh / not called', dot: 'bg-gray-200 dark:bg-slate-600' },
  { id: 'neutral', label: 'Follow-up / neutral', dot: GROUP_STYLES.neutral.solid },
  { id: 'positive', label: 'Positive progress', dot: GROUP_STYLES.positive.solid },
  { id: 'success', label: 'Converted', dot: GROUP_STYLES.success.solid },
  { id: 'negative', label: 'Not interested / dead', dot: GROUP_STYLES.negative.solid },
];
const bucketOf = (status) => (!status || status === 'New' || status === 'Assigned' ? 'fresh' : getStatusMeta(status).group);

const fmtTick = (granularity) => (d) => {
  const date = new Date(`${d}T00:00:00`);
  return granularity === 'month'
    ? date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const EmployeeAnalyticsDetail = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const range = rangeFromParams(params);
  const chart = useChartTheme();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState('untouched');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState({ items: [], total: 0 });
  const [recordsLoading, setRecordsLoading] = useState(true);
  const recordsRef = useRef(null);

  const [drawerRecord, setDrawerRecord] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    employeeService.getEmployeeAnalytics(id, { from: range.from, to: range.to })
      .then((res) => { if (!cancelled) { setData(res); setNotFound(false); } })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setNotFound(true);
        else toast.error('Failed to load employee analytics');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id, range.from, range.to]);

  useEffect(() => { setPage(1); }, [tab, debouncedSearch, id]);

  useEffect(() => {
    let cancelled = false;
    setRecordsLoading(true);
    employeeService.getEmployeeAnalyticsRecords(id, { view: tab, search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => { if (!cancelled) setRecords(res); })
      .catch(() => { if (!cancelled) toast.error('Failed to load records'); })
      .finally(() => { if (!cancelled) setRecordsLoading(false); });
    return () => { cancelled = true; };
  }, [id, tab, debouncedSearch, page]);

  const showTab = (next) => {
    setTab(next);
    recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openRecord = async (recordId) => {
    setDrawerOpen(true);
    setDrawerRecord(null);
    try {
      setDrawerRecord(await stsService.getSalesDataById(recordId));
    } catch {
      toast.error('Failed to load STS details');
      setDrawerOpen(false);
    }
  };

  const statusBuckets = useMemo(() => {
    const counts = {};
    (data?.holdings.byStatus || []).forEach((s) => {
      const b = bucketOf(s.name === 'Unspecified' ? '' : s.name);
      counts[b] = (counts[b] || 0) + s.count;
    });
    return STATUS_BUCKETS.map((b) => ({ ...b, count: counts[b.id] || 0 }));
  }, [data]);

  if (isLoading && !data) return <div className="py-16"><Spinner /></div>;

  if (notFound || !data) {
    return (
      <Card>
        <EmptyState icon={Inbox} title={notFound ? 'Employee not found' : "Couldn't load analytics"} message={notFound ? 'They may have been removed from your company.' : 'Check your connection and try again.'} />
        <div className="flex justify-center">
          <Link to={`/admin/sts/employee-analytics?${params.toString()}`} className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline">Back to all employees</Link>
        </div>
      </Card>
    );
  }

  const { employee: emp, holdings: h, activity: a, requests: req, recent } = data;
  const name = emp.fullName || emp.email;
  const heldTotal = h.held || 0;
  const donut = [
    { name: 'Touched', value: h.touched, color: chart.series1 },
    { name: 'Untouched', value: h.untouched, color: chart.track },
  ];
  const outcomes = a.byOutcome.map((o) => ({ ...o, label: getStatusMeta(o.name).label, meta: getStatusMeta(o.name) }));
  const maxOutcome = Math.max(1, ...outcomes.map((o) => o.count));
  const hasTrend = a.trend.some((p) => p.updates > 0);

  return (
    <div className={`space-y-6 animate-fade-in transition-opacity ${isLoading ? 'opacity-70' : ''}`}>
      {/* Profile header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-5 sm:p-8 border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <Link
              to={`/admin/sts/employee-analytics?${params.toString()}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All employees
            </Link>
            <div className="flex items-start gap-4">
              <Avatar employee={emp} size="w-14 h-14 sm:w-16 sm:h-16" text="text-lg" />
              <div className="min-w-0">
                <h2 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
                  <span className="truncate">{name}</span>
                  <span className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${emp.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                    : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'}`}
                  >
                    {emp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                  {[emp.employeeRole, emp.designation, emp.department].filter(Boolean).join(' · ') || 'Employee'}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-slate-400">
                  {emp.email && <span className="inline-flex items-center gap-1.5 min-w-0"><Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{emp.email}</span></span>}
                  {(emp.mobileNo || emp.phoneNumber) && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{emp.mobileNo || emp.phoneNumber}</span>}
                  {emp.cityBranch && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{emp.cityBranch}</span>}
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Joined {fmtDate(emp.joiningDate)}</span>
                  <span className="inline-flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Last update {a.lastActivityAt ? timeAgo(a.lastActivityAt) : 'never'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch lg:items-end gap-3 shrink-0">
            <PeriodPicker params={params} setParams={setParams} />
            <ReportActions data={data} range={range} id={id} />
          </div>
        </div>
      </div>

      {/* Data held */}
      <SectionTitle title="Data held" subtitle="Current allotment — what's on their plate right now" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 content-start">
          <StatTile icon={Database} tone="slate" label="Records held" value={fmtNum(heldTotal)} hint={`${fmtNum(h.primary)} own · ${fmtNum(h.shared)} shared`} onClick={() => showTab('all')} active={tab === 'all'} />
          <StatTile icon={FileCheck2} tone="emerald" label="Touched" value={fmtNum(h.touched)} hint="Worked at least once" onClick={() => showTab('touched')} active={tab === 'touched'} />
          <StatTile icon={FileX2} tone="rose" label="Untouched" value={fmtNum(h.untouched)} hint="No update from them yet" onClick={() => showTab('untouched')} active={tab === 'untouched'} />
          <StatTile icon={AlarmClock} tone="amber" label="Overdue follow-ups" value={fmtNum(h.overdueFollowUps)} hint={`${fmtNum(h.upcomingFollowUps)} due in the next 7 days`} onClick={() => showTab('overdue')} active={tab === 'overdue'} />
          <div className="col-span-2 xl:col-span-4 bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-700 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Where their held records stand</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{fmtNum(h.meetingsFixed)} with a meeting fixed · {fmtNum(h.workedNotHeld)} worked but no longer held</p>
            </div>
            {heldTotal === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No records allotted.</p>
            ) : (
              <>
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 gap-[2px]">
                  {statusBuckets.filter((b) => b.count > 0).map((b) => (
                    <div key={b.id} className={`${b.dot} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(b.count / heldTotal) * 100}%`, minWidth: 4 }} title={`${b.label}: ${fmtNum(b.count)}`} />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                  {statusBuckets.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.dot}`} />
                      <span className="text-xs text-gray-600 dark:text-slate-300 truncate">{b.label}</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(b.count)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Card title="Coverage" subtitle="Share of held records they've touched">
          {heldTotal === 0 ? (
            <EmptyState icon={Database} title="No records held" />
          ) : (
            <>
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius="68%" outerRadius="95%" startAngle={90} endAngle={-270} stroke={chart.dark ? '#1e293b' : '#ffffff'} strokeWidth={2} isAnimationActive={false}>
                      {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...chart.tooltip} formatter={(v) => fmtNum(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{h.coverage}%</span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">touched</span>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                <LegendDot color={chart.series1} label={`Touched ${fmtNum(h.touched)}`} />
                <LegendDot color={chart.track} label={`Untouched ${fmtNum(h.untouched)}`} />
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Activity */}
      <SectionTitle title="Work done" subtitle={`Everything they logged in ${periodLabel(range)}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon={Activity} tone="blue" label="Status updates" value={fmtNum(a.updates)} hint={`on ${fmtNum(a.recordsWorked)} records`} />
        <StatTile icon={BadgeCheck} tone="indigo" label="Conversions" value={fmtNum(a.conversions)} hint={`${a.conversionRate}% of records worked`} />
        <StatTile icon={IndianRupee} tone="amber" label="Revenue" value={fmtMoney(a.revenue)} hint="Value of conversions" />
        <StatTile icon={CalendarCheck} tone="cyan" label="Active days" value={fmtNum(a.activeDays)} hint={`${a.avgPerActiveDay} updates per active day`} />
        <StatTile icon={FilePlus2} tone="emerald" label="New records added" value={fmtNum(a.recordsCreated)} hint="STS created by them" />
        <StatTile icon={Camera} tone="violet" label="Site visit photos" value={fmtNum(a.siteImages)} hint="Uploaded in this period" />
        <StatTile icon={Hand} tone="slate" label="STS requests" value={fmtNum(req.pending + req.approved + req.rejected)} hint={`${req.pending} pending · ${req.approved} approved · ${req.rejected} rejected`} />
        <StatTile icon={Target} tone="rose" label="Meetings fixed" value={fmtNum(h.meetingsFixed)} hint="On records they hold" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card
          className="xl:col-span-2"
          title="Activity trend"
          subtitle={a.trendGranularity === 'month' ? 'Updates per month' : 'Updates per day'}
          action={<div className="flex gap-3"><LegendDot color={chart.series1} label="Updates" /><LegendDot color={chart.series2} label="Conversions" /></div>}
        >
          {!hasTrend ? (
            <EmptyState icon={Activity} title="No updates in this period" message="Pick a longer period to see their history." />
          ) : (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ea-updates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.series1} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chart.series1} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={fmtTick(a.trendGranularity)} tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...chart.tooltip}
                    cursor={{ stroke: chart.tick, strokeDasharray: '3 3' }}
                    labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, a.trendGranularity === 'month' ? { month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  />
                  <Area type="monotone" dataKey="updates" name="Updates" stroke={chart.series1} strokeWidth={2} fill="url(#ea-updates)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: chart.dark ? '#1e293b' : '#fff' }} />
                  <Area type="monotone" dataKey="conversions" name="Conversions" stroke={chart.series2} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: chart.dark ? '#1e293b' : '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Busiest days" subtitle="Updates by day of week">
          {a.updates === 0 ? (
            <EmptyState icon={CalendarDays} title="No updates yet" />
          ) : (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.weekdays} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: chart.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="updates" name="Updates" fill={chart.series1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card title="Call outcomes" subtitle={`Statuses they logged in ${periodLabel(range)}`}>
          {outcomes.length === 0 ? (
            <EmptyState icon={Activity} title="No updates in this period" />
          ) : (
            <ul className="space-y-3">
              {outcomes.slice(0, 10).map((o) => (
                <li key={o.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${o.meta.dot}`} />
                      <span className="truncate text-gray-700 dark:text-slate-200" title={o.label}>{o.label}</span>
                    </span>
                    <span className="font-bold tabular-nums text-gray-900 dark:text-white">{fmtNum(o.count)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${o.meta.solid}`} style={{ width: `${(o.count / maxOutcome) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <BreakdownCard title="Held records by source" items={h.bySource} total={heldTotal} color={chart.series1} />
        <BreakdownCard title="Held records by city" subtitle="Top 8 cities" items={h.byCity} total={heldTotal} color={chart.series1} />
      </div>

      {/* Records explorer */}
      <div ref={recordsRef} className="scroll-mt-24">
        <Card
          title="Records"
          subtitle="Exactly which records they have — and haven't — worked on"
          className="overflow-hidden"
        >
          <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">
            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
              {RECORD_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                  <span className="px-1.5 py-0.5 rounded-md bg-gray-200/80 dark:bg-slate-600/60 text-[10px] tabular-nums">{fmtNum(h[t.countKey])}</span>
                </button>
              ))}
            </div>
            <div className="relative xl:ml-auto xl:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, profile ID, city…"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          {recordsLoading && records.items.length === 0 ? (
            <div className="py-10"><Spinner /></div>
          ) : records.items.length === 0 ? (
            <EmptyState icon={Inbox} title={search ? 'No matching records' : 'Nothing here'} message={search ? 'Try a different search.' : RECORD_TABS.find((t) => t.id === tab)?.empty} />
          ) : (
            <div className={`transition-opacity ${recordsLoading ? 'opacity-50' : ''}`}>
              {/* Desktop table */}
              <div className="hidden md:block -mx-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      <th className="text-left px-6 py-3">Company</th>
                      <th className="text-left px-3 py-3">City</th>
                      <th className="text-left px-3 py-3">Status</th>
                      <th className="text-left px-3 py-3 hidden lg:table-cell">Source</th>
                      <th className="text-right px-3 py-3">Their updates</th>
                      <th className="text-left px-3 py-3">Next follow-up</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/70">
                    {records.items.map((r) => {
                      const meta = getStatusMeta(r.status);
                      return (
                        <tr key={r.id} onClick={() => openRecord(r.id)} className="group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-semibold text-primary-600 dark:text-primary-400 truncate max-w-[280px]" title={r.companyName}>{r.companyName}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
                              {r.companyID}
                              {!r.isPrimary && <span className="px-1.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">Shared</span>}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">{r.cityDistrict || '—'}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold max-w-[180px] truncate align-middle ${meta.badge}`} title={getStatusDisplay(r.status) || meta.label}>{meta.label}</span>
                          </td>
                          <td className="px-3 py-3 text-gray-700 dark:text-slate-300 hidden lg:table-cell whitespace-nowrap">{r.source || '—'}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <span className="font-bold tabular-nums text-gray-900 dark:text-white">{r.myUpdates}</span>
                            {r.myLastUpdateAt && <span className="block text-[11px] text-gray-500 dark:text-slate-400">{timeAgo(r.myLastUpdateAt)}</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {r.nextActionDate ? (
                              <span className={`text-xs font-semibold ${r.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-700 dark:text-slate-300'}`}>
                                {r.isOverdue && <AlarmClock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />}
                                {fmtDate(r.nextActionDate)}
                              </span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="pr-4"><ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2.5">
                {records.items.map((r) => {
                  const meta = getStatusMeta(r.status);
                  return (
                    <button key={r.id} type="button" onClick={() => openRecord(r.id)} className="w-full text-left p-3.5 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 active:scale-[0.99] transition-transform">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-primary-600 dark:text-primary-400 truncate">{r.companyName}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{r.companyID}{r.cityDistrict ? ` · ${r.cityDistrict}` : ''}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[11px] font-semibold max-w-[45%] truncate ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                        <span><b className="text-gray-900 dark:text-white tabular-nums">{r.myUpdates}</b> updates by them</span>
                        {r.nextActionDate && (
                          <span className={r.isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                            Next: {fmtDate(r.nextActionDate)}
                          </span>
                        )}
                        {!r.isPrimary && <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Shared</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-4">
                <Pagination page={records.page || page} pageSize={PAGE_SIZE} total={records.total} onPageChange={setPage} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card title="Recent activity" subtitle="Their latest status updates (any period)">
        {recent.length === 0 ? (
          <EmptyState icon={History} title="No updates logged yet" message={`${name} hasn't logged any status update.`} />
        ) : (
          <ol className="relative border-l border-gray-200 dark:border-slate-700 ml-2 space-y-5">
            {recent.map((r) => {
              const meta = getStatusMeta(r.newStatus);
              return (
                <li key={r.id} className="ml-5">
                  <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-800 ${meta.dot}`} />
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                    <button type="button" onClick={() => openRecord(r.salesDataId)} className="text-left min-w-0 group">
                      <p className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                        {r.companyName} <span className="text-xs font-normal text-gray-500 dark:text-slate-400">{r.companyID}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-gray-500 dark:text-slate-400">{getStatusMeta(r.previousStatus).label}</span>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <span className={`px-1.5 py-0.5 rounded border font-semibold ${meta.badge}`}>{getStatusDisplay(r.newStatus, r.otherStatusText)}</span>
                        {r.convertedFor && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{r.convertedFor}{r.convertedPrice != null ? ` · ${fmtMoney(r.convertedPrice)}` : ''}</span>
                        )}
                      </p>
                      {r.comment && <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 line-clamp-2 break-words">{r.comment}</p>}
                    </button>
                    <time className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap shrink-0" title={new Date(r.createdAt).toLocaleString()}>{timeAgo(r.createdAt)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <StsDetailsDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerRecord(null); }}
        salesRecord={drawerRecord}
        fetchHistory={stsService.getSalesHistory}
      />
    </div>
  );
};

const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'report.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
};

// "Download report" / "Share" — builds the employee's PDF report for the selected period.
const ReportActions = ({ data, range, id }) => {
  const [busy, setBusy] = useState(null); // 'download' | 'share' | null
  const [shareable] = useState(canShareFiles);

  const build = async () => {
    const [company, overdue, untouched] = await Promise.all([
      api.get('/Admin/my-company')
        .then((r) => ({ name: r.data?.name || r.data?.Name, logoUrl: r.data?.logoUrl || r.data?.LogoUrl }))
        .catch(() => ({})),
      employeeService.getEmployeeAnalyticsRecords(id, { view: 'overdue', page: 1, pageSize: 50 }).catch(() => null),
      employeeService.getEmployeeAnalyticsRecords(id, { view: 'untouched', page: 1, pageSize: 25 }).catch(() => null),
    ]);
    const { buildEmployeeReportPdf, reportFileName } = await import('./employeeReportPdf');
    const blob = await buildEmployeeReportPdf({ data, range, company, overdue, untouched });
    return { blob, fileName: reportFileName(data.employee, range) };
  };

  const run = async (mode) => {
    if (busy) return;
    setBusy(mode);
    const toastId = toast.loading('Preparing PDF report…');
    try {
      const { blob, fileName } = await build();
      if (mode === 'share') {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({
            files: [file],
            title: `${data.employee.fullName || data.employee.email} — performance report`,
            text: `Performance report for ${periodLabel(range)}.`,
          });
          toast.success('Report shared', { id: toastId });
        } catch (err) {
          if (err?.name === 'AbortError') toast.dismiss(toastId);
          else throw err;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success('Report downloaded', { id: toastId });
      }
    } catch {
      toast.error("Couldn't create the report. Please try again.", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2 lg:justify-end">
      <button
        type="button"
        onClick={() => run('download')}
        disabled={!!busy}
        className="group flex-1 lg:flex-none inline-flex items-center justify-center gap-2.5 pl-2.5 pr-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-75 disabled:cursor-wait disabled:hover:translate-y-0 transition-all"
      >
        <span className="p-1.5 rounded-lg bg-white/15">
          {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
        </span>
        <span className="text-left leading-tight">
          {busy === 'download' ? 'Preparing PDF…' : 'Download report'}
          <span className="block text-[10px] font-semibold text-white/70">PDF · {periodLabel(range)}</span>
        </span>
      </button>
      {shareable && (
        <button
          type="button"
          onClick={() => run('share')}
          disabled={!!busy}
          title="Share the PDF report (email, WhatsApp…)"
          className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-sm font-bold shadow-sm hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-500/50 dark:hover:text-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-60 disabled:cursor-wait transition-colors"
        >
          {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          <span className="hidden sm:inline">Share</span>
        </button>
      )}
    </div>
  );
};

const SectionTitle = ({ title, subtitle }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-2">
    <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-slate-400">{subtitle}</p>
  </div>
);

// Single-series magnitude list — one hue, labelled rows, scales cleanly on phones.
const BreakdownCard = ({ title, subtitle, items, total, color }) => {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card title={title} subtitle={subtitle}>
      {items.length === 0 ? (
        <EmptyState icon={Database} title="No records held" />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-700 dark:text-slate-200" title={i.name}>{i.name}</span>
                <span className="shrink-0 tabular-nums">
                  <b className="text-gray-900 dark:text-white">{fmtNum(i.count)}</b>
                  <span className="ml-1.5 text-xs text-gray-500 dark:text-slate-400">{total ? Math.round((i.count / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default EmployeeAnalyticsDetail;
