import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, CheckCircle, XCircle, Edit, KeyRound, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Table from '../../../components/Table';
import Button from '../../../components/Button';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import EditEmployee from './EditEmployee';
import EmployeeDetailsDrawer from './EmployeeDetailsDrawer';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [isEditPermissionsModalOpen, setIsEditPermissionsModalOpen] = useState(false);
  const [selectedEmployeeForPermissions, setSelectedEmployeeForPermissions] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState({});

  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await employeeService.getAllEmployees();
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to fetch employees');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const data = await settingsService.getDepartments();
        setDepartments(data.map((d) => d.name));
      } catch (error) {
        // Non-fatal — the department filter just won't have options.
      }
    };
    fetchDepartments();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const action = currentStatus ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} this employee?`)) return;

    try {
      await employeeService.toggleEmployeeStatus(id);
      toast.success(`Employee ${action}d successfully`);
      fetchEmployees(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${action} employee`);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    try {
      await employeeService.resetPassword(selectedEmployeeForReset.id, newPassword);
      toast.success('Password reset successfully');
      setIsResetPasswordModalOpen(false);
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleSavePermissions = async () => {
    try {
      const activePermissions = Object.keys(editingPermissions).filter(k => editingPermissions[k]);
      await employeeService.updatePermissions(selectedEmployeeForPermissions.id, JSON.stringify(activePermissions));
      toast.success('Permissions updated successfully');
      setIsEditPermissionsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update permissions');
    }
  };

  const openEmployeeDetails = async (employee) => {
    setIsDetailsDrawerOpen(true);
    setSelectedEmployeeDetails(null);
    try {
      const details = await employeeService.getEmployeeById(employee.id);
      setSelectedEmployeeDetails(details);
    } catch (error) {
      toast.error('Failed to load employee details');
      setIsDetailsDrawerOpen(false);
    }
  };

  const closeEmployeeDetails = () => {
    setIsDetailsDrawerOpen(false);
    setSelectedEmployeeDetails(null);
  };

  const openPermissionsModal = (employee) => {
    setSelectedEmployeeForPermissions(employee);
    try {
      const permsArray = employee.permissions ? JSON.parse(employee.permissions) : [];
      setEditingPermissions({
        addSts: permsArray.includes('addSts'),
        editSts: permsArray.includes('editSts'),
        addEmployee: permsArray.includes('addEmployee'),
        assignSts: permsArray.includes('assignSts'),
      });
    } catch (e) {
      setEditingPermissions({});
    }
    setIsEditPermissionsModalOpen(true);
  };

  const filteredEmployees = employees.filter((emp) => {
    if (filter === 'active' && !emp.isActive) return false;
    if (filter === 'inactive' && emp.isActive) return false;
    if (deptFilter && emp.employeeDept !== deptFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        emp.email.toLowerCase().includes(term) ||
        (emp.department && emp.department.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Name', accessor: 'fullName' },
    { header: 'Email', accessor: 'email' },
    { header: 'Phone', accessor: 'phoneNumber' },
    { header: 'Employee Dept', accessor: 'employeeDept' },
    { header: 'Employee Role', accessor: 'employeeRole' },
    { header: 'Designation', accessor: 'designation' },
    {
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      header: 'Joined',
      render: (row) => row.joiningDate ? new Date(row.joiningDate).toLocaleDateString() : 'N/A'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage your company employees here.</p>
        </div>
        <Link to="/admin/employees/add">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between gap-4 transition-colors duration-300">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex gap-2 bg-gray-50 dark:bg-slate-900/50 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'active' ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'inactive' ? 'bg-white dark:bg-slate-700 text-red-700 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
          >
            Inactive
          </button>
        </div>
      </div>

    {isLoading ? (
        <div className="py-12">
          <Spinner />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <Table
            columns={columns}
            data={filteredEmployees}
            onRowClick={openEmployeeDetails}
            renderActions={(row) => (
              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setSelectedEmployeeForEdit(row);
                    setIsEditModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg transition-colors text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                  title="Edit Employee"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => openPermissionsModal(row)}
                  className="p-1.5 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                  title="Edit Permissions"
                >
                  <Shield className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setSelectedEmployeeForReset(row);
                    setNewPassword('');
                    setIsResetPasswordModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg transition-colors text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10"
                  title="Reset Password"
                >
                  <KeyRound className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleToggleStatus(row.id, row.isActive)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    row.isActive
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                      : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10'
                  }`}
                  title={row.isActive ? "Disable Employee" : "Enable Employee"}
                >
                  {row.isActive ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </button>
              </div>
            )}
          />
        </div>
      )}

      <EmployeeDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={closeEmployeeDetails}
        employee={selectedEmployeeDetails}
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmployeeForEdit(null);
        }}
        title="Edit Employee"
        maxWidthClass="max-w-2xl"
      >
        {selectedEmployeeForEdit && (
          <EditEmployee
            employee={selectedEmployeeForEdit}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedEmployeeForEdit(null);
            }}
            onSuccess={() => {
              setIsEditModalOpen(false);
              setSelectedEmployeeForEdit(null);
              fetchEmployees();
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setSelectedEmployeeForReset(null);
        }}
        title="Reset Password"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Set a new password for <strong>{selectedEmployeeForReset?.fullName || selectedEmployeeForReset?.email}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditPermissionsModalOpen}
        onClose={() => {
          setIsEditPermissionsModalOpen(false);
          setSelectedEmployeeForPermissions(null);
        }}
        title="Edit Permissions"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Configure permissions for <strong>{selectedEmployeeForPermissions?.fullName || selectedEmployeeForPermissions?.email}</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'addSts', label: 'Add STS Record', desc: 'Can create new STS records' },
              { key: 'editSts', label: 'Edit STS Record', desc: 'Can modify existing STS data' },
              { key: 'addEmployee', label: 'Add Employee', desc: 'Can register new staff' },
              { key: 'assignSts', label: 'Allotment of STS', desc: 'Can assign STS records to others' },
            ].map(perm => (
              <div key={perm.key} className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer ${editingPermissions[perm.key] ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`} onClick={() => setEditingPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-semibold ${editingPermissions[perm.key] ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-slate-100'}`}>{perm.label}</h4>
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${editingPermissions[perm.key] ? 'bg-primary-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${editingPermissions[perm.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{perm.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditPermissionsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePermissions}>
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeList;
