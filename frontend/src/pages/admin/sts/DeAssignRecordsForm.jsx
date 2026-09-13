import React, { useEffect, useMemo, useState } from 'react';
import { Search, Layers, UserMinus, AlertTriangle, User2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Spinner from '../../../components/Spinner';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import { getStatusMeta } from '../../../constants/stsPipeline';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100';

const DeAssignRecordsForm = ({ onClose, onSuccess }) => {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [stsSearch, setStsSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [reason, setReason] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [employeeById, setEmployeeById] = useState(() => new Map());
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

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
        setEmployeeById(new Map(emps.map((e) => [e.id, e])));
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

  const allocatedRecords = useMemo(
    () => records.filter((r) => r.allocatedTo || r.teleExecutive || r.marketingExecutive),
    [records]
  );

  const assigneeOf = (r) => r.allocatedTo || r.teleExecutive || r.marketingExecutive;

  const assignees = useMemo(() => {
    const map = new Map();
    allocatedRecords.forEach((r) => {
      const a = assigneeOf(r);
      if (a) map.set(a.id, a.fullName);
    });
    return Array.from(map.entries())
      .map(([id, fullName]) => ({ id, fullName, emp: employeeById.get(id) }))
      .filter(({ emp }) => {
        const matchesDept = !deptFilter || emp?.employeeDept === deptFilter;
        const matchesDesignation = !designationFilter || emp?.designation === designationFilter;
        const matchesRole = !roleFilter || emp?.employeeRole === roleFilter;
        return matchesDept && matchesDesignation && matchesRole;
      });
  }, [allocatedRecords, employeeById, deptFilter, designationFilter, roleFilter]);

  useEffect(() => {
    if (employeeFilter && !assignees.some((a) => String(a.id) === employeeFilter)) {
      setEmployeeFilter('');
    }
  }, [assignees, employeeFilter]);

  const filteredRecords = useMemo(() => {
    const term = stsSearch.trim().toLowerCase();
    return allocatedRecords.filter((r) => {
      const a = assigneeOf(r);
      if (employeeFilter && String(a?.id) !== employeeFilter) return false;
      const emp = a ? employeeById.get(a.id) : undefined;
      if (deptFilter && emp?.employeeDept !== deptFilter) return false;
      if (designationFilter && emp?.designation !== designationFilter) return false;
      if (roleFilter && emp?.employeeRole !== roleFilter) return false;
      if (!term) return true;
      return [r.companyName, r.companyID, r.email, r.mobile1, r.cityDistrict, a?.fullName]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term));
    });
  }, [allocatedRecords, stsSearch, employeeFilter, deptFilter, designationFilter, roleFilter, employeeById]);

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

  const allVisibleSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredRecords.forEach((r) => next.delete(r.id));
      else filteredRecords.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const selectedRecords = records.filter((r) => selectedIds.has(r.id));

  const handleDeallocate = async () => {
    setIsSaving(true);
    try {
      const res = await stsService.bulkDeallocateSalesData({
        salesIds: Array.from(selectedIds),
        reason: reason.trim() || undefined,
      });
      toast.success(res.message || 'Records de-allocated');
      setIsConfirmOpen(false);
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
      <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200">Allocated STS Records</h3>
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
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
              placeholder="Search by name, ID, email, city, or assignee..."
              value={stsSearch}
              onChange={(e) => setStsSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select className={inputClass} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Depts</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inputClass} value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}>
              <option value="">All Designations</option>
              {designations.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={inputClass} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="">All employees</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <button onClick={toggleAllVisible} className="font-semibold text-rose-600 dark:text-rose-400 hover:underline" disabled={filteredRecords.length === 0}>
              {allVisibleSelected ? 'Clear visible' : 'Select all visible'}
            </button>
            <span>{filteredRecords.length} allocated record(s)</span>
          </div>

          <div className="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 max-h-80 overflow-y-auto bg-white dark:bg-slate-800">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                {allocatedRecords.length === 0 ? 'No STS records are currently allocated.' : 'No records match your filters.'}
              </div>
            ) : (
              filteredRecords.map((r) => {
                const checked = selectedIds.has(r.id);
                const m = getStatusMeta(r.status);
                const a = assigneeOf(r);
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
                        {r.companyID} · {r.cityDistrict || '—'}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                        <User2 className="w-3.5 h-3.5" /> Allotted: {a?.fullName || 'Unknown'}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {selectedIds.size > 0
            ? <>De-allocate <span className="font-bold text-rose-600 dark:text-rose-400">{selectedIds.size}</span> record(s)</>
            : 'Select allocated records to de-allocate.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => setIsConfirmOpen(true)}
            disabled={selectedIds.size === 0}
          >
            <UserMinus className="w-4 h-4 mr-2" /> De-Assign Selected
          </Button>
        </div>
      </div>

      {/* Confirmation modal */}
      <Modal isOpen={isConfirmOpen} onClose={() => !isSaving && setIsConfirmOpen(false)} title="Confirm De-Assignment" maxWidthClass="max-w-lg">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This will remove the current allotment from <span className="font-bold">{selectedIds.size}</span> record(s)
              and return them to the unassigned pool. This action cannot be undone automatically.
            </p>
          </div>

          <div className="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-800 max-h-40 overflow-y-auto">
            {selectedRecords.map((r) => {
              const a = assigneeOf(r);
              return (
                <div key={r.id} className="p-2.5 text-sm flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-slate-200 truncate">{r.companyName}</span>
                  <span className="text-xs text-gray-400 shrink-0">from {a?.fullName || 'Unknown'}</span>
                </div>
              );
            })}
          </div>

          <textarea
            className={inputClass}
            rows="2"
            placeholder="Reason for de-assignment (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button variant="secondary" onClick={() => setIsConfirmOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button variant="danger" onClick={handleDeallocate} isLoading={isSaving}>
              <UserMinus className="w-4 h-4 mr-2" /> Confirm De-Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeAssignRecordsForm;
