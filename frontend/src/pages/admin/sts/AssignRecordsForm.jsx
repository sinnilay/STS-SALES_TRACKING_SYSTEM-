import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Users, CheckCircle2, ClipboardList, Layers, MapPin, X } from 'lucide-react';
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

const holdersLabel = (r, roleById) => {
  const holders = holdersOf(r);
  if (holders.length === 0) return 'Unassigned';
  return 'With ' + holders
    .map((h) => (roleById.get(h.id) ? `${h.fullName} (${roleById.get(h.id)})` : h.fullName))
    .join(', ');
};

const AssignRecordsForm = ({ onClose, onSuccess }) => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roleById, setRoleById] = useState(() => new Map());
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [stsSearch, setStsSearch] = useState('');
  const debouncedStsSearch = useDebouncedValue(stsSearch, 250);
  const [profileType, setProfileType] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const debouncedCity = useDebouncedValue(cityFilter, 250);
  const [createdDate, setCreatedDate] = useState(''); // "YYYY-MM-DD", or '' for any day
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);

  const [empSearch, setEmpSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sales, emps, deptData, designationData] = await Promise.all([
          stsService.getSalesLite(),
          employeeService.getAllEmployees(),
          settingsService.getDepartments(),
          settingsService.getDesignations(),
        ]);
        setRecords(sales);
        setEmployees(emps.filter((e) => e.isActive));
        setRoleById(new Map(emps.map((e) => [e.id, e.employeeRole || ''])));
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

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // Who the records should be "not yet with": the picked employee's whole role (one holder
  // per role, e.g. one Tele Sales + one Field Sales), else everyone matching the dept /
  // designation dropdowns. With none of those, only fully unassigned records are offered.
  const target = useMemo(() => {
    if (selectedEmployee) {
      const role = selectedEmployee.employeeRole;
      return role
        ? { label: `a ${role} employee`, ids: new Set(employees.filter((e) => e.employeeRole === role).map((e) => e.id).concat(selectedEmployee.id)) }
        : { label: selectedEmployee.fullName, ids: new Set([selectedEmployee.id]) };
    }
    if (!deptFilter && !designationFilter) return null;
    const ids = employees
      .filter((e) => (!deptFilter || e.employeeDept === deptFilter)
        && (!designationFilter || e.designation === designationFilter))
      .map((e) => e.id);
    return { label: 'a matching employee', ids: new Set(ids) };
  }, [selectedEmployee, employees, deptFilter, designationFilter]);

  const eligibleRecords = useMemo(() => {
    if (!target) return records.filter((r) => holdersOf(r).length === 0);
    return records.filter((r) => !holdersOf(r).some((h) => target.ids.has(h.id)));
  }, [records, target]);

  // Records that stop being eligible (e.g. the newly picked employee already has them) are unticked.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const eligibleIds = new Set(eligibleRecords.map((r) => r.id));
      const next = new Set(Array.from(prev).filter((id) => eligibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [eligibleRecords]);

  // Cities of the eligible records, with how many records each holds, for the city picker.
  const cityCounts = useMemo(() => {
    const counts = new Map();
    eligibleRecords.forEach((r) => {
      const c = (r.cityDistrict || '').trim();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [eligibleRecords]);

  const cityTerm = debouncedCity.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    const term = debouncedStsSearch.trim().toLowerCase();
    const prefix = profileType ? `${profileType}-` : '';
    return eligibleRecords.filter((r) => {
      if (prefix && !r.companyID?.toUpperCase().startsWith(prefix)) return false;
      if (cityTerm && !(r.cityDistrict || '').toLowerCase().includes(cityTerm)) return false;
      if (createdDate && toLocalDateKey(r.createdAt) !== createdDate) return false;
      if (!term) return true;
      return [r.companyName, r.companyID, r.email, r.mobile1]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term));
    });
  }, [eligibleRecords, debouncedStsSearch, profileType, cityTerm, createdDate]);

  // A new search, profile / city / date filter or target starts back on page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedStsSearch, profileType, cityTerm, createdDate, target]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Each new page starts at the top of the list.
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [currentPage]);

  const hasEmployeeFilter = Boolean(empSearch.trim() || deptFilter || designationFilter);

  const filteredEmployees = useMemo(() => {
    if (!hasEmployeeFilter) return [];
    const term = empSearch.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = !term || e.fullName?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term);
      const matchesDept = !deptFilter || e.employeeDept === deptFilter;
      const matchesDesignation = !designationFilter || e.designation === designationFilter;
      return matchesSearch && matchesDept && matchesDesignation;
    });
  }, [employees, empSearch, deptFilter, designationFilter, hasEmployeeFilter]);

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

  const handleAssign = async () => {
    if (!selectedEmployeeId) return toast.error('Select an employee to allot to');
    if (selectedIds.size === 0) return toast.error('Select at least one STS record');
    setIsSaving(true);
    try {
      const res = await stsService.bulkAllocateSalesData({
        employeeId: selectedEmployeeId,
        salesIds: Array.from(selectedIds),
        allocatorComment: comment.trim() || undefined,
      });
      toast.success(res.message || 'Records allotted');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to allot records');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* STS records */}
        <div className="lg:col-span-3 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">Select STS Records</h3>
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-400">
              {target
                ? <>Showing records not yet with {target.label}. Records another team holds are shared — they keep them too.</>
                : 'Showing unassigned records. Pick a department, designation or employee to also see records other teams hold.'}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-400">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  onClick={() => toggleMany(pageRecords, pageSelected)}
                  disabled={pageRecords.length === 0}
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                >
                  {pageSelected ? 'Clear this page' : 'Select this page'}
                </button>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <button
                  onClick={() => toggleMany(filteredRecords, allMatchingSelected)}
                  disabled={filteredRecords.length === 0}
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                >
                  {allMatchingSelected ? 'Clear all matching' : `Select all ${filteredRecords.length.toLocaleString()} matching`}
                </button>
              </div>
              <span>{filteredRecords.length.toLocaleString()} records</span>
            </div>

            <QuickSelectBar
              total={filteredRecords.length}
              activeCount={quickActiveCount}
              onSelectFirst={selectFirst}
              accent="primary"
            />

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              <div ref={listRef} className="divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No records found.</div>
              ) : (
                pageRecords.map((r) => {
                  const checked = selectedIds.has(r.id);
                  const m = getStatusMeta(r.status);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleId(r.id)} className="mt-1 rounded" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{r.companyName}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${m.badge}`}>{m.label}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {r.companyID} · {r.cityDistrict || '—'} · Created {formatCreated(r.createdAt)} · {holdersLabel(r, roleById)}
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

        {/* Employee picker */}
        <div className="lg:col-span-2 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">Allot To</h3>
          </div>
          <div className="p-4 space-y-3">
            {/* Record filters: narrow the STS records list on the left */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Filter Records</p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search STS by name, ID, email, mobile..."
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
                  list="assign-sts-cities"
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
                <datalist id="assign-sts-cities">
                  {cityCounts.map(([c, n]) => <option key={c} value={c} label={`${n.toLocaleString()} records`} />)}
                </datalist>
              </div>
              {cityTerm && (
                <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                  <span className="font-bold text-primary-600 dark:text-primary-400">{filteredRecords.length.toLocaleString()}</span>
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
            />

            {/* Employee filters: pick who the records go to */}
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-2 border-t border-gray-200 dark:border-slate-700">Choose Employee</p>
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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search employees..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />
            </div>

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 max-h-56 overflow-y-auto bg-white dark:bg-slate-800">
              {!hasEmployeeFilter ? (
                <div className="p-6 text-center text-sm text-gray-400">Select a department, designation, or search to see employees.</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No employees found.</div>
              ) : (
                filteredEmployees.map((emp) => {
                  const active = selectedEmployeeId === emp.id;
                  return (
                    <button
                      type="button"
                      key={emp.id}
                      onClick={() => setSelectedEmployeeId(active ? null : emp.id)}
                      className={`w-full text-left p-3 flex items-center justify-between gap-2 transition-colors ${active ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/60'}`}
                    >
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${active ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>{emp.fullName}</div>
                        <div className="text-xs text-gray-400 truncate">{emp.email} · {emp.employeeRole || '—'}{emp.designation ? ` · ${emp.designation}` : ''}</div>
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            <textarea
              className={inputClass}
              rows="2"
              placeholder="Allocation comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {selectedIds.size > 0 ? (
            <>Allot <span className="font-bold text-primary-600 dark:text-primary-400">{selectedIds.size}</span> record(s) to{' '}
              <span className="font-bold">{selectedEmployee ? selectedEmployee.fullName : '—'}</span></>
          ) : 'Select records and an employee to allot.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleAssign} isLoading={isSaving} disabled={!selectedEmployeeId || selectedIds.size === 0}>
            <ClipboardList className="w-4 h-4 mr-2" /> Allot Selected
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignRecordsForm;
