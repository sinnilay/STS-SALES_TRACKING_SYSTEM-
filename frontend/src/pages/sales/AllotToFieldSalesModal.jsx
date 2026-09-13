import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeStsService } from '../../services/employeeStsService';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';

const AllotToFieldSalesModal = ({ salesRecord, onClose, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    employeeStsService.getCompanyEmployees()
      .then((data) => setEmployees(data.filter((e) => e.employeeRole === 'Field Sales')))
      .catch(() => toast.error('Failed to load Field Sales employees'))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter((e) =>
      e.fullName?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const handleAllot = async (employeeId) => {
    setIsAllocating(employeeId);
    try {
      await employeeStsService.allocateToFieldSales(salesRecord.id, employeeId);
      toast.success('Record allotted to Field Sales successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to allot record');
    } finally {
      setIsAllocating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
        Handing off <span className="font-bold">{salesRecord.companyName}</span> ({salesRecord.companyID}) for a site visit. Pick the Field Sales executive to allot it to.
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 text-sm"
          placeholder="Search Field Sales by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center"><Spinner /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-slate-400 text-sm">
            No Field Sales employees found.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredEmployees.map((emp) => (
              <li key={emp.id} className="p-3 hover:bg-gray-50 dark:hover:bg-slate-800 flex justify-between items-center transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">{emp.fullName}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 truncate">
                    {emp.email}
                    {emp.employeeDept && (
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <MapPin className="w-3 h-3" /> {emp.employeeDept}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  onClick={() => handleAllot(emp.id)}
                  isLoading={isAllocating === emp.id}
                  disabled={!!isAllocating}
                >
                  Allot
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
        <Button variant="secondary" onClick={onClose} disabled={!!isAllocating}>Close</Button>
      </div>
    </div>
  );
};

export default AllotToFieldSalesModal;
