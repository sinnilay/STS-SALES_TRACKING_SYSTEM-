import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Calendar, ClipboardList, CheckCircle2, XCircle, BarChart3,
  Sparkles, RefreshCw, Filter, X, Tag, ArrowLeft, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dsrService } from '../../services/dsrService';
import { employeeService } from '../../services/employeeService';
import { stsService } from '../../services/stsService';
import Spinner from '../../components/Spinner';
import EmployeePicker from '../../components/EmployeePicker';
import StsDetailsDrawer from './sts/StsDetailsDrawer';
import { getStatusMeta, isConverted, isNotInterested } from '../../constants/stsPipeline';
import { initials, avatarGradient } from '../../utils/avatar';

const formatTime = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

const relativeDayLabel = (dateKey) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(dateKey);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return null;
};

// Modern re-interpretation of the legacy DSR colour legend (Prospect / NI / Convt,
// each split Fresh Call vs Follow-up, plus Normal Meeting and Cold Call). The
// current STS pipeline doesn't carry a separate fresh/follow-up flag for every
// status, so it's derived from the status id itself.
const DSR_BOX_CATEGORIES = {
  prospectFresh: { label: 'Prospect · Fresh Call', dot: 'bg-amber-500', bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  prospectFollow: { label: 'Prospect · Follow-up', dot: 'bg-orange-500', bar: 'bg-orange-400', text: 'text-orange-600 dark:text-orange-400' },
  niFresh: { label: 'Not Interested · Fresh Call', dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  niFollow: { label: 'Not Interested · Follow-up', dot: 'bg-rose-400', bar: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-400' },
  converted: { label: 'Converted', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  meeting: { label: 'Normal Meeting', dot: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  cold: { label: 'Cold Call', dot: 'bg-slate-400 dark:bg-slate-500', bar: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-500 dark:text-slate-400' },
};

const FRESH_CALL_IDS = new Set(['DMUPIFC', 'PGIFC', 'NI_FC']);
const FOLLOW_UP_IDS = new Set(['PGIFU', 'DMUPIFU1', 'DMUPIFU2', 'DMUPIFU3', 'NI_FU']);

const getDsrBoxCategory = (statusId) => {
  if (statusId === 'C_C') return DSR_BOX_CATEGORIES.cold;
  // SERV ("Only Service Meeting") is the one neutral status that's a genuine meeting —
  // everything else neutral (CPNA, N_O, C_B, legacy New/Assigned, …) is not, and
  // mislabeling them "Normal Meeting" hides what actually happened on the call.
  if (statusId === 'SERV') return DSR_BOX_CATEGORIES.meeting;
  const meta = getStatusMeta(statusId);
  if (meta.group === 'success') return DSR_BOX_CATEGORIES.converted;
  if (meta.group === 'negative') {
    return FRESH_CALL_IDS.has(statusId) ? DSR_BOX_CATEGORIES.niFresh : DSR_BOX_CATEGORIES.niFollow;
  }
  if (meta.group === 'positive') {
    return FOLLOW_UP_IDS.has(statusId) ? DSR_BOX_CATEGORIES.prospectFollow : DSR_BOX_CATEGORIES.prospectFresh;
  }
  return { label: meta.label, dot: 'bg-slate-400 dark:bg-slate-500', bar: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-500 dark:text-slate-400' };
};

const DailyReport = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailsRecord, setDetailsRecord] = useState(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    employeeService.getAllEmployees()
      .then(setEmployees)
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setIsLoadingEmployees(false));
  }, []);

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setEntries([]);
  };

  const backToEmployeeList = () => {
    setSelectedEmployee(null);
    setEntries([]);
  };

  const openEntryDetails = async (entry) => {
    setSelectedEntry(entry);
    try {
      const record = await stsService.getSalesDataById(entry.salesDataId);
      setDetailsRecord(record);
    } catch (error) {
      toast.error('Failed to load STS details');
      setSelectedEntry(null);
    }
  };

  const closeEntryDetails = () => {
    setSelectedEntry(null);
    setDetailsRecord(null);
  };

  const refreshDetailsAfterStatusUpdate = async () => {
    if (selectedEntry) {
      try {
        const record = await stsService.getSalesDataById(selectedEntry.salesDataId);
        setDetailsRecord(record);
      } catch (error) {
        toast.error('Failed to refresh STS details');
      }
    }
    fetchEntries(false);
  };

  const fetchEntries = async (showSpinner = true) => {
    if (!selectedEmployee) return;
    const requestId = ++fetchIdRef.current;
    if (showSpinner) setIsLoading(true); else setIsRefreshing(true);
    try {
      const data = await dsrService.getDsrEntries({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        employeeId: selectedEmployee.id,
        search: search || undefined,
      });
      // Ignore responses from requests that were superseded by a newer filter
      // change (e.g. picking "From" then "To" can leave an in-flight
      // "From"-only request that resolves after the fully-filtered one).
      if (requestId !== fetchIdRef.current) return;
      setEntries(data);
    } catch (error) {
      if (requestId === fetchIdRef.current) toast.error('Failed to load the daily sales report');
    } finally {
      if (requestId === fetchIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedEmployee) return;
    const timeout = setTimeout(() => fetchEntries(true), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, search, dateFrom, dateTo]);

  // A company can be updated several times in one day (e.g. re-opened, called
  // back, re-graded) — each of those writes its own audit-log DsrEntry. For the
  // report, only the latest status per company per day is worth showing.
  const dedupedEntries = useMemo(() => {
    const latestByCompanyPerDay = new Map();
    entries.forEach((entry) => {
      const dayKey = new Date(entry.reportDate).toDateString();
      const dedupeKey = `${dayKey}|${entry.companyID || entry.companyName}`;
      const existing = latestByCompanyPerDay.get(dedupeKey);
      if (!existing || new Date(entry.createdAt) > new Date(existing.createdAt)) {
        latestByCompanyPerDay.set(dedupeKey, entry);
      }
    });
    return Array.from(latestByCompanyPerDay.values());
  }, [entries]);

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const todaysEntries = dedupedEntries.filter(e => new Date(e.reportDate).toDateString() === todayKey);
    return {
      totalToday: todaysEntries.length,
      successful: todaysEntries.filter(e => isConverted(e.newStatus)).length,
      unsuccessful: todaysEntries.filter(e => isNotInterested(e.newStatus)).length,
      totalInRange: dedupedEntries.length,
    };
  }, [dedupedEntries]);

  const grouped = useMemo(() => {
    const map = new Map();
    dedupedEntries.forEach((entry) => {
      const key = new Date(entry.reportDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return Array.from(map.entries())
      .map(([dateKey, dayEntries]) => [dateKey, dayEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))])
      .sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [dedupedEntries]);

  const hasActiveFilters = search || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const openPicker = (ref) => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };

  if (!selectedEmployee) {
    return (
      <EmployeePicker
        employees={employees}
        isLoading={isLoadingEmployees}
        onSelect={handleSelectEmployee}
        icon={Users}
        title="Daily Sales Report"
        subtitle="Pick a team member to open their day-by-day STS activity — every DSR is scoped to one employee at a time."
      />
    );
  }

  const statCards = [
    { name: "Updates Today", value: stats.totalToday, icon: ClipboardList, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
    { name: 'Converted Today', value: stats.successful, icon: CheckCircle2, gradient: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/20' },
    { name: 'Not Interested Today', value: stats.unsuccessful, icon: XCircle, gradient: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/20' },
    { name: 'Updates In Range', value: stats.totalInRange, icon: BarChart3, gradient: 'from-fuchsia-500 to-purple-600', shadow: 'shadow-purple-500/20' },
  ];

  const employeeName = selectedEmployee.fullName || selectedEmployee.email;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(selectedEmployee.id)} text-white flex items-center justify-center font-black text-lg shadow-md`}>
              {initials(employeeName)}
            </div>
            <div>
              <button
                onClick={backToEmployeeList}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 mb-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Switch employee
              </button>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                {employeeName}&rsquo;s Daily Sales Report
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse shrink-0" />
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                {selectedEmployee.department ? `${selectedEmployee.department} · ` : ''}Every STS status change logged by {employeeName}, grouped by date.
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchEntries(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:shadow-none dark:hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{stat.name}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl text-white bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.shadow} transform group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
              placeholder="Search by company name or STS ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 transition-colors duration-300">
            <Calendar className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
            <input
              ref={dateFromRef}
              type="date"
              value={dateFrom}
              onClick={() => openPicker(dateFromRef)}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[130px] bg-transparent text-gray-900 dark:text-slate-100 text-sm cursor-pointer focus:outline-none"
            />
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">to</span>
            <input
              ref={dateToRef}
              type="date"
              value={dateTo}
              onClick={() => openPicker(dateToRef)}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[130px] bg-transparent text-gray-900 dark:text-slate-100 text-sm cursor-pointer focus:outline-none"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-wrap items-center gap-x-5 gap-y-2 transition-colors duration-300">
        <span className="flex items-center gap-1.5 text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          <Tag className="w-3.5 h-3.5" /> Legend
        </span>
        {Object.values(DSR_BOX_CATEGORIES).map((c) => (
          <span key={c.label} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300">
            <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`}></span>
            {c.label}
          </span>
        ))}
      </div>

      {/* DSR by Date */}
      {isLoading ? (
        <div className="py-12">
          <Spinner />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors duration-300">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 mb-4">
            <Filter className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No activity found</h3>
          <p className="text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
            {hasActiveFilters
              ? 'No status updates match your current filters. Try adjusting your search or date range.'
              : `${employeeName} hasn't logged any STS updates yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayEntries]) => {
            const d = new Date(dateKey);
            const relative = relativeDayLabel(dateKey);
            const monthShort = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
            const dayNum = d.toLocaleDateString(undefined, { day: '2-digit' });
            const fullDate = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            return (
              <div
                key={dateKey}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 transition-colors duration-300"
              >
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex flex-col items-center justify-center shadow-md leading-none">
                      <span className="text-[10px] font-bold">{monthShort}</span>
                      <span className="text-lg font-black">{dayNum}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white">
                        {relative || d.toLocaleDateString(undefined, { weekday: 'long' })}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{fullDate}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {dayEntries.length} update{dayEntries.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {dayEntries.map((entry) => {
                    const category = getDsrBoxCategory(entry.newStatus);
                    return (
                      <button
                        key={entry.id}
                        onClick={() => openEntryDetails(entry)}
                        title={`${entry.companyName} (${entry.companyID}) · ${getStatusMeta(entry.newStatus).label} · ${formatTime(entry.createdAt)}`}
                        className="group relative flex flex-col gap-2 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 dark:hover:border-slate-600 transition-all duration-200 p-3.5 pl-4 text-left overflow-hidden"
                      >
                        <span className={`absolute left-0 top-0 bottom-0 w-1 ${category.bar}`} />
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${category.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${category.dot}`} />
                            {category.label}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 dark:text-slate-500 shrink-0">{formatTime(entry.createdAt)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{entry.companyName}</p>
                          <p className="text-[11px] font-mono text-gray-400 dark:text-slate-500 truncate">{entry.companyID}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STS Details Drawer — opened by clicking a DSR entry */}
      <StsDetailsDrawer
        isOpen={!!selectedEntry}
        onClose={closeEntryDetails}
        salesRecord={detailsRecord}
        highlightTransition={selectedEntry}
        fetchHistory={stsService.getSalesHistory}
        onUpdateStatus={stsService.updateSalesStatus}
        onUpdated={refreshDetailsAfterStatusUpdate}
      />
    </div>
  );
};

export default DailyReport;
