import React, { useEffect, useMemo, useState } from 'react';
import { Navigation, Search, Wifi, WifiOff, MapPin, Users, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { gpsService, startGpsConnection, stopGpsConnection } from '../../../services/gpsService';
import Spinner from '../../../components/Spinner';
import { timeAgo } from '../../../utils/timeAgo';
import EmployeeMap from './EmployeeMap';

// Fallback recency window — only used to catch a *missed* disconnect broadcast (tab killed,
// network drop, etc.) so a stale "online" badge can't stick forever. An explicit
// PresenceChanged push is trusted immediately in both directions; this window never overrides
// it, it only demotes online -> offline once a connection has gone quiet for too long.
const ONLINE_WINDOW_MS = 75000;
const TICK_MS = 3000;

const GpsTracking = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const [tick, setTick] = useState(0);

  const fetchEmployees = async () => {
    try {
      const data = await gpsService.getEmployees();
      setEmployees(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load GPS data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Live push updates over the shared SignalR hub — no polling needed while this page is open.
  useEffect(() => {
    let conn;
    let cancelled = false;

    const onLocationUpdated = (payload) => {
      setEmployees((prev) => prev.map((e) => (e.id === payload.userId ? {
        ...e,
        lastLatitude: payload.latitude,
        lastLongitude: payload.longitude,
        lastLocationAt: payload.recordedAt,
        lastSeenAt: payload.recordedAt,
        isOnline: true,
      } : e)));
    };

    const onPresenceChanged = (payload) => {
      setEmployees((prev) => prev.map((e) => (e.id === payload.userId ? {
        ...e,
        isOnline: payload.isOnline,
        lastSeenAt: payload.lastSeenAt,
      } : e)));
    };

    (async () => {
      try {
        conn = await startGpsConnection();
        if (cancelled) return;
        conn.on('LocationUpdated', onLocationUpdated);
        conn.on('PresenceChanged', onPresenceChanged);
      } catch {
        // Connection errors are non-fatal — the list still works from the initial REST fetch.
      }
    })();

    return () => {
      cancelled = true;
      if (conn) {
        conn.off('LocationUpdated', onLocationUpdated);
        conn.off('PresenceChanged', onPresenceChanged);
      }
      stopGpsConnection();
    };
  }, []);

  // Ticks periodically so "online" status and "Xm ago" labels both stay fresh without new data.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Trust the pushed isOnline flag as-is (it's already real-time); only demote a still-"online"
  // record to offline once its last event is older than the fallback window, to catch a missed
  // disconnect broadcast. Never promote offline -> online from recency alone.
  const liveEmployees = useMemo(() => {
    void tick;
    return employees.map((e) => ({
      ...e,
      isOnline: e.isOnline && !!e.lastSeenAt && Date.now() - new Date(e.lastSeenAt).getTime() < ONLINE_WINDOW_MS,
    }));
  }, [employees, tick]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return liveEmployees.filter((e) => {
      if (onlineOnly && !e.isOnline) return false;
      if (!term) return true;
      return [e.fullName, e.email, e.employeeRole].filter(Boolean).some((v) => v.toLowerCase().includes(term));
    });
  }, [liveEmployees, search, onlineOnly]);

  const onlineCount = liveEmployees.filter((e) => e.isOnline).length;
  const locatedCount = liveEmployees.filter((e) => e.lastLatitude != null).length;

  if (isLoading) return <div className="py-12"><Spinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary-500" /> GPS Tracking
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Live login status and location of your field team.
          </p>
        </div>
        <button
          onClick={fetchEmployees}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Total Employees</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{employees.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Online Now</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{onlineCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400">On Map</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{locatedCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Employee list */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700 space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-slate-300">
              <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="rounded" />
              Show online only
            </label>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[24rem] sm:max-h-[36rem] divide-y divide-gray-100 dark:divide-slate-800">
            {filteredEmployees.length === 0 ? (
              <div className="p-5 sm:p-8 text-center text-sm text-gray-400">No employees found.</div>
            ) : (
              filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => e.lastLatitude != null && setFocusedId(e.id)}
                  disabled={e.lastLatitude == null}
                  className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                    focusedId === e.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'
                  } ${e.lastLatitude == null ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                    e.isOnline ? 'bg-emerald-600' : 'bg-slate-400'
                  }`}>
                    {(e.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                    {e.isOnline && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{e.fullName}</span>
                      {!e.isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 shrink-0">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{e.employeeRole || '—'} · {e.employeeDept || '—'}</div>
                    <div className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${e.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                      {e.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {e.isOnline ? 'Online now' : `Last seen ${timeAgo(e.lastSeenAt)}`}
                    </div>
                  </div>
                  {e.lastLatitude != null && (
                    <MapPin className={`w-4 h-4 shrink-0 ${focusedId === e.id ? 'text-primary-600' : 'text-gray-300 dark:text-slate-600'}`} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">View Location on Map</h3>
          </div>
          <div className="h-[22rem] sm:h-[36rem]">
            {locatedCount === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center text-sm text-gray-400 gap-2 p-6">
                <MapPin className="w-8 h-8 text-gray-300 dark:text-slate-600" />
                No employee locations yet. Once an employee opens the Sales Portal with location access granted, they'll appear here.
              </div>
            ) : (
              <EmployeeMap employees={liveEmployees} focusedEmployeeId={focusedId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GpsTracking;
