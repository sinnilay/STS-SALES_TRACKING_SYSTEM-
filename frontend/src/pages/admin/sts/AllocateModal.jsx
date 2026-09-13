import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeService } from '../../../services/employeeService';
import { stsService } from '../../../services/stsService';
import { settingsService } from '../../../services/settingsService';
import Button from '../../../components/Button';
import Spinner from '../../../components/Spinner';

const AllocateModal = ({ salesRecord, onClose, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('');

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, roleData, deptData, designationData] = await Promise.all([
          employeeService.getAllEmployees(),
          settingsService.getEmployeeRoles(),
          settingsService.getDepartments(),
          settingsService.getDesignations()
        ]);
        setEmployees(empData.filter(e => e.isActive));
        const dbRoles = roleData.map(r => r.name);
        setRoles(['Tele Sales', 'Field Sales', ...dbRoles.filter(r => r !== 'Tele Sales' && r !== 'Field Sales')]);
        setDepartments(deptData.map(d => d.name));
        setDesignations(designationData.map(d => d.name));
      } catch (error) {
        toast.error('Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasEmployeeFilter = Boolean(searchTerm.trim() || selectedDept || selectedDesignation || selectedRole);

  const filteredEmployees = !hasEmployeeFilter ? [] : employees.filter(e => {
    const matchesSearch = (e.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           e.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = selectedRole ? e.employeeRole === selectedRole : true;
    const matchesDept = selectedDept ? e.employeeDept === selectedDept : true;
    const matchesDesignation = selectedDesignation ? e.designation === selectedDesignation : true;
    return matchesSearch && matchesRole && matchesDept && matchesDesignation;
  });

  const handleAllocate = async (employeeId) => {
    setIsAllocating(true);
    try {
      await stsService.allocateSalesData(salesRecord.id, employeeId);
      toast.success('Record allocated successfully!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to allocate record');
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Department</label>
          <select
            value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Designation</label>
          <select
            value={selectedDesignation} onChange={e => setSelectedDesignation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">All Designations</option>
            {designations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
          <select
            value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 text-sm"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="mt-4 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center"><Spinner /></div>
        ) : !hasEmployeeFilter ? (
          <div className="p-4 text-center text-gray-500">Select a department, designation, role, or search to see employees.</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No employees found.</div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredEmployees.map(emp => (
              <li key={emp.id} className="p-3 hover:bg-gray-50 dark:hover:bg-slate-800 flex justify-between items-center transition-colors">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{emp.fullName}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">{emp.email} • {emp.employeeDept} • {emp.employeeRole}{emp.designation ? ` • ${emp.designation}` : ''}</div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleAllocate(emp.id)} 
                  disabled={isAllocating}
                >
                  Allocate
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700 mt-4">
        <Button variant="secondary" onClick={onClose} disabled={isAllocating}>Close</Button>
      </div>
    </div>
  );
};

export default AllocateModal;
