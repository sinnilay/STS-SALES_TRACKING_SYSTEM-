import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Layers, UserMinus, User2, MapPin, X, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Spinner from '../../../components/Spinner';
import Button from '../../../components/Button';
import Pagination from '../../../components/Pagination';
import QuickSelectBar from './QuickSelectBar';
import CreatedDateFilter, { toLocalDateKey, formatCreated } from './CreatedDateFilter';
import { getStatusMeta } from '../../../constants/stsPipeline';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

// Rendering thousands of rows at once freezes the modal, so the list is paged.
// "Select all matching" still covers every match across all pages.
const PAGE_SIZE = 25;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100';

// Everyone currently holding a record: its primary holder, co-assignees, and the Tele Sales
// owner who handed it on to Field Sales.
const holdersOf = (r) => {
  const seen = new Map();
  [r.allocatedTo, r.teleExecutive, r.marketingExecutive, ...(r.coAssignees || [])].forEach((h) => {
    if (h && !seen.has(h.id)) seen.set(h.id, h);
  });
  return Array.from(seen.values());
};

const targetNames = (targets) => (targets.length <= 3
  ? targets.map((t) => t.fullName).join(', ')
  : `${targets.length} employees`);

const DeAssignRecordsForm = ({ onClose, onSuccess }) => {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [stsSearch, setStsSearch] = useState('');
  const debouncedStsSearch = useDebouncedValue(stsSearch, 250);
  const [profileType, setProfileType] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const debouncedCity = useDebouncedValue(cityFilter, 250);
  const [createdDate, setCreatedDate] = useState(''); // "YYYY-MM-DD", or '' for any day
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');

  const [employeeById, setEmployeeById] = useState(() => new Map());
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sales, emps, deptData, designationData] = await Promise.all([
          stsService.getSalesLite(true),
          employeeService.getAllEmployees(),
          settingsService.getDepartments(),
          settingsService.getDesignations(),
        ]);
        setRecords(sales);
        setEmployeeById(new Map(emps.map((e) => [e.id, e])));
        setDepartments(deptData.map((d) => d.name));
        setDesignations(designationData.map((d) => d.name));
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const allocatedRecords = useMemo(
    () => records.filter((r) => holdersOf(r).length > 0),
    [records]
  );

  const assignees = useMemo(() => {
    const map = new Map();
    allocatedRecords.forEach((r) => {
      holdersOf(r).forEach((h) => map.set(h.id, h.fullName));
    });
    return Array.from(map.entries())
      .map(([id, fullName]) => ({ id, fullName, emp: employeeById.get(id) }))
      .filter(({ emp }) => {
        const matchesDept = !deptFilter || emp?.employeeDept === deptFilter;
        const matchesDesignation = !designationFilter || emp?.designation === designationFilter;
        return matchesDept && matchesDesignation;
      });
  }, [allocatedRecords, employeeById, deptFilter, designationFilter]);

  useEffect(() => {
    if (employeeFilter && !assignees.some((a) => String(a.id) === employeeFilter)) {
      setEmployeeFilter('');
    }
  }, [assignees, employeeFilter]);

  // Who a de-assign takes off the records: the picked employee, else everyone matching the
  // dept / designation filters (other holders keep the records). With no employee filter,
  // every holder is removed and the records go back to the unassigned pool.
  const removalTargets = useMemo(() => {
    if (employeeFilter) return assignees.filter((a) => String(a.id) === employeeFilter);
    if (deptFilter || designationFilter) return assignees;
    return null;
  }, [assignees, employeeFilter, deptFilter, designationFilter]);

  const targetIds = useMemo(
    () => (removalTargets ? new Set(removalTargets.map((a) => a.id)) : null),
    [removalTargets]
  );

  // Cities of the allocated records, with how many records each holds, for the city picker.
  const cityCounts = useMemo(() => {
    const counts = new Map();
    allocatedRecords.forEach((r) => {
      const c = (r.cityDistrict || '').trim();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allocatedRecords]);

  const cityTerm = debouncedCity.trim().toLowerCase();
  const searchTerm = debouncedStsSearch.trim().toLowerCase();

  // Records are only listed once a filter is picked, so the admin starts from a narrowed set.
  const hasFilter = Boolean(searchTerm || cityTerm || createdDate || profileType || employeeFilter || deptFilter || designationFilter);

  const filteredRecords = useMemo(() => {
    if (!hasFilter) return [];
    const prefix = profileType ? `${profileType}-` : '';
    return allocatedRecords.filter((r) => {
      if (prefix && !r.companyID?.toUpperCase().startsWith(prefix)) return false;
      if (cityTerm && !(r.cityDistrict || '').toLowerCase().includes(cityTerm)) return false;
      if (createdDate && toLocalDateKey(r.createdAt) !== createdDate) return false;
      const holders = holdersOf(r);
      if (targetIds && !holders.some((h) => targetIds.has(h.id))) return false;
      if (!searchTerm) return true;
      return [r.companyName, r.companyID, r.email, r.mobile1, ...holders.map((h) => h.fullName)]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(searchTerm));
    });
  }, [allocatedRecords, hasFilter, searchTerm, cityTerm, createdDate, profileType, targetIds]);

  // Any new search or filter starts back on page 1.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, cityTerm, createdDate, profileType, employeeFilter, deptFilter, designationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Each new page starts at the top of the list.
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [currentPage]);

  useEffect(() => {
    // Drop selections that no longer match the current filter/allocated set.
    setSelectedIds((prev) => {
      const visibleIds = new Set(filteredRecords.map((r) => r.id));
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredRecords]);

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMany = (list, allSelected) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) list.forEach((r) => next.delete(r.id));
      else list.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const allMatchingSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));
  const pageSelected = pageRecords.length > 0 && pageRecords.every((r) => selectedIds.has(r.id));

  // Replace the selection with the first N matching records, in list order.
  const selectFirst = (n) => {
    setSelectedIds(new Set(filteredRecords.slice(0, n).map((r) => r.id)));
  };

  // When the selection is exactly the first N matching records, N (so its chip shows active).
  const quickActiveCount = useMemo(() => {
    const size = selectedIds.size;
    if (size === 0 || size > filteredRecords.length) return null;
    for (let i = 0; i < size; i++) {
      if (!selectedIds.has(filteredRecords[i].id)) return null;
    }
    return size;
  }, [selectedIds, filteredRecords]);

  // De-assigns straight away — no confirmation step.
  const handleDeallocate = async () => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      const res = await stsService.bulkDeallocateSalesData({
        salesIds: Array.from(selectedIds),
        reason: reason.trim() || undefined,
        employeeIds: targetIds ? Array.from(targetIds) : undefined,
      });
      toast.success(res.message || 'Records de-allocated');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to de-allocate records');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Allocated records */}
      <div className="lg:col-span-3 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">Allocated STS Records</h3>
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
            {selectedIds.size} selected
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                onClick={() => toggleMany(pageRecords, pageSelected)}
                disabled={pageRecords.length === 0}
                className="font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
              >
                {pageSelected ? 'Clear this page' : 'Select this page'}
              </button>
              <span className="text-gray-300 dark:text-slate-600">|</span>
              <button
                onClick={() => toggleMany(filteredRecords, allMatchingSelected)}
                disabled={filteredRecords.length === 0}
                className="font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
              >
                {allMatchingSelected ? 'Clear all matching' : `Select all ${filteredRecords.length.toLocaleString()} matching`}
              </button>
            </div>
            <span>{filteredRecords.length.toLocaleString()} allocated record(s)</span>
          </div>

          <QuickSelectBar
            total={filteredRecords.length}
            activeCount={quickActiveCount}
            onSelectFirst={selectFirst}
            accent="rose"
          />

          <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
            <div ref={listRef} className="divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {allocatedRecords.length === 0 ? (
              <div className="p-5 sm:p-8 text-center text-sm text-gray-400">No STS records are currently allocated.</div>
            ) : !hasFilter ? (
              <div className="p-5 sm:p-8 flex flex-col items-center text-center text-sm text-gray-400">
                <SlidersHorizontal className="w-6 h-6 mb-2 text-gray-300 dark:text-slate-600" />
                Pick a city, created date, employee, department, designation or profile ID — or search — to see allocated records.
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-5 sm:p-8 text-center text-sm text-gray-400">No records match your filters.</div>
            ) : (
              pageRecords.map((r) => {
                const checked = selectedIds.has(r.id);
                const m = getStatusMeta(r.status);
                const holders = holdersOf(r);
                return (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-rose-50 dark:bg-rose-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleId(r.id)} className="mt-1 rounded" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{r.companyName}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${m.badge}`}>{m.label}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {r.companyID} · {r.cityDistrict || '—'} · Created {formatCreated(r.createdAt)}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                        <User2 className="w-3.5 h-3.5 shrink-0" /> Allotted: {holders.map((h) => h.fullName).join(', ')}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
            </div>
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredRecords.length} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="lg:col-span-2 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">Filters</h3>
        </div>
        <div className="p-4 space-y-3">
          {/* Record filters */}
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Filter Records</p>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              className={`${inputClass} pl-10`}
              placeholder="Search by name, ID, email, mobile, or assignee..."
              value={stsSearch}
              onChange={(e) => setStsSearch(e.target.value)}
            />
          </div>
          <select className={`${inputClass} px-2 text-xs`} value={profileType} onChange={(e) => setProfileType(e.target.value)}>
            <option value="">All Profile IDs</option>
            <option value="NC">NC Profiles</option>
            <option value="EC">EC Profiles</option>
          </select>
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-4 w-4 text-gray-400" />
              </div>
              <input
                list="deassign-sts-cities"
                className={`${inputClass} pl-10 pr-9`}
                placeholder="Filter STS records by city..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              />
              {cityFilter && (
                <button
                  type="button"
                  onClick={() => setCityFilter('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                  aria-label="Clear city"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <datalist id="deassign-sts-cities">
                {cityCounts.map(([c, n]) => <option key={c} value={c} label={`${n.toLocaleString()} records`} />)}
              </datalist>
            </div>
            {cityTerm && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                <span className="font-bold text-rose-600 dark:text-rose-400">{filteredRecords.length.toLocaleString()}</span>
                {' '}record{filteredRecords.length === 1 ? '' : 's'} match city "{debouncedCity.trim()}"
              </p>
            )}
          </div>
          <CreatedDateFilter
            value={createdDate}
            onChange={setCreatedDate}
            matchCount={filteredRecords.length}
            inputClass={inputClass}
            unavailable={records.length > 0 && !records.some((r) => r.createdAt)}
            accentClass="text-rose-600 dark:text-rose-400"
          />

          {/* Holder filters */}
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-2 border-t border-gray-200 dark:border-slate-700">Allotted To</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select className={`${inputClass} px-2 text-xs`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Depts</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={`${inputClass} px-2 text-xs`} value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
              <option value="">All Designations</option>
              {designations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <select className={`${inputClass} px-2 text-xs`} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="">All employees</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </select>
          <textarea
            className={inputClass}
            rows="2"
            placeholder="Reason for de-assignment (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {selectedIds.size > 0
            ? (
              <>
                De-allocate <span className="font-bold text-rose-600 dark:text-rose-400">{selectedIds.size}</span> record(s)
                {removalTargets
                  ? <> from <span className="font-bold">{targetNames(removalTargets)}</span></>
                  : <> — all allotments removed</>}
              </>
            )
            : 'Select allocated records to de-allocate.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleDeallocate}
            isLoading={isSaving}
            disabled={selectedIds.size === 0}
          >
            <UserMinus className="w-4 h-4 mr-2" /> De-Assign Selected
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeAssignRecordsForm;
