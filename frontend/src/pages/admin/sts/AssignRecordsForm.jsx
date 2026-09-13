import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, CheckCircle2, ClipboardList, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Spinner from '../../../components/Spinner';
import Button from '../../../components/Button';
import { getStatusMeta } from '../../../constants/stsPipeline';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100';

const AssignRecordsForm = ({ onClose, onSuccess }) => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [stsSearch, setStsSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [empSearch, setEmpSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [sales, emps, roleData, deptData, designationData] = await Promise.all([
          stsService.getAllSales(),
          employeeService.getAllEmployees(),
          settingsService.getEmployeeRoles(),
          settingsService.getDepartments(),
          settingsService.getDesignations(),
        ]);
        setRecords(sales);
        setEmployees(emps.filter((e) => e.isActive));
        const dbRoles = roleData.map((r) => r.name);
        setRoles(['Tele Sales', 'Field Sales', ...dbRoles.filter((r) => r !== 'Tele Sales' && r !== 'Field Sales')]);
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

  // Only unallocated records are eligible here — already-allotted ones belong in De-Assign.
  const unassignedRecords = useMemo(
    () => records.filter((r) => !(r.allocatedTo || r.teleExecutive || r.marketingExecutive)),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const term = stsSearch.trim().toLowerCase();
    return unassignedRecords.filter((r) => {
      if (!term) return true;
      return [r.companyName, r.companyID, r.email, r.mobile1, r.cityDistrict]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term));
    });
  }, [unassignedRecords, stsSearch]);

  const hasEmployeeFilter = Boolean(empSearch.trim() || deptFilter || designationFilter || roleFilter);

  const filteredEmployees = useMemo(() => {
    if (!hasEmployeeFilter) return [];
    const term = empSearch.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = !term || e.fullName?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term);
      const matchesRole = !roleFilter || e.employeeRole === roleFilter;
      const matchesDept = !deptFilter || e.employeeDept === deptFilter;
      const matchesDesignation = !designationFilter || e.designation === designationFilter;
      return matchesSearch && matchesRole && matchesDept && matchesDesignation;
    });
  }, [employees, empSearch, roleFilter, deptFilter, designationFilter, hasEmployeeFilter]);

  const toggleId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredRecords.forEach((r) => next.delete(r.id));
      else filteredRecords.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

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
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search STS by name, ID, email, city..."
                value={stsSearch}
                onChange={(e) => setStsSearch(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400 -mt-1">Showing unassigned records only. Already-allotted records can be freed up via De-Assign.</p>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <button onClick={toggleAllVisible} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                {allVisibleSelected ? 'Clear visible' : 'Select all visible'}
              </button>
              <span>{filteredRecords.length} records</span>
            </div>

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto bg-white dark:bg-slate-800">
              {filteredRecords.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No records found.</div>
              ) : (
                filteredRecords.map((r) => {
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
                          {r.companyID} · {r.cityDistrict || '—'} · Unassigned
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select className={`${inputClass} px-2 text-xs`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All Depts</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={`${inputClass} px-2 text-xs`} value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
                <option value="">All Designations</option>
                {designations.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={`${inputClass} px-2 text-xs`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
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
                <div className="p-6 text-center text-sm text-gray-400">Select a department, designation, role, or search to see employees.</div>
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
