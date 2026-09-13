import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

const buildDefaultValues = (employee) => ({
  fullName: employee.fullName || '',
  email: employee.email || '',
  phoneNumber: employee.phoneNumber || '',
  department: employee.department || '',
  employeeDept: employee.employeeDept || '',
  employeeRole: employee.employeeRole || '',
  designation: employee.designation || '',
  role: employee.role || 'Sales',
  joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
  address: employee.address || ''
});

// Ensures a <select> can display a value that predates a renamed/removed option
// (e.g. an employee whose EmployeeRole is still the old "Tele Caller") instead of
// silently falling back to a blank selection.
const withCurrentValue = (options, currentValue) => {
  if (!currentValue || options.some((o) => o.name === currentValue)) return options;
  return [{ id: `current-${currentValue}`, name: currentValue }, ...options];
};

const EditEmployee = ({ employee, onSuccess, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [employeeRoles, setEmployeeRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [profilePictureUrl, setProfilePictureUrl] = useState(employee.profilePictureUrl || null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: buildDefaultValues(employee)
  });

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller');
      e.target.value = '';
      return;
    }

    setIsUploadingPicture(true);
    try {
      const result = await employeeService.uploadEmployeePicture(employee.id, file);
      setProfilePictureUrl(result.profilePictureUrl);
      toast.success('Profile picture updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setIsUploadingPicture(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [rolesRes, deptsRes, desigsRes] = await Promise.all([
          settingsService.getEmployeeRoles(),
          settingsService.getDepartments(),
          settingsService.getDesignations()
        ]);
        setEmployeeRoles(rolesRes);
        setDepartments(deptsRes);
        setDesignations(desigsRes);
        // The Employee Dept / Role / Designation <select> options only exist once these
        // lists arrive, so react-hook-form's initial defaultValues (set before this fetch
        // resolved) couldn't match an <option> yet — re-apply them now that the options exist.
        reset(buildDefaultValues(employee));
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    };
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await employeeService.updateEmployee(employee.id, {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        department: data.department,
        employeeDept: data.employeeDept,
        employeeRole: data.employeeRole,
        designation: data.designation,
        address: data.address,
        role: data.role,
        joiningDate: data.joiningDate
      });
      toast.success("Employee updated successfully");
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update employee");
    } finally {
      setIsLoading(false);
    }
  };

  const initials = (employee.fullName || employee.email || '?')
    .trim()
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800/60 shadow-sm overflow-hidden flex items-center justify-center">
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={employee.fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black text-primary-600 dark:text-primary-400">{initials}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPicture}
            className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-lg bg-primary-600 text-white shadow-md hover:bg-primary-700 transition-colors disabled:opacity-60"
            title="Change profile picture"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePictureChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input
            label="Full Name"
            {...register('fullName', { required: "Full Name is required" })}
            error={errors.fullName}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            label="Email Address"
            type="email"
            {...register('email', { required: "Email is required" })}
            error={errors.email}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            label="Phone Number"
            type="tel"
            {...register('phoneNumber')}
            error={errors.phoneNumber}
          />
        </div>
        
        <Input
          label="Department (System)"
          {...register('department', { required: "Department is required" })}
          error={errors.department}
        />
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Employee Dept
          </label>
          <select
            {...register('employeeDept')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">--Select Dept--</option>
            {withCurrentValue(departments, employee.employeeDept).map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Employee Role
          </label>
          <select
            {...register('employeeRole')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">--Select Role--</option>
            <option value="Tele Sales">Tele Sales</option>
            <option value="Field Sales">Field Sales</option>
            {withCurrentValue(
              employeeRoles.filter(r => r.name !== 'Tele Sales' && r.name !== 'Field Sales'),
              employee.employeeRole !== 'Tele Sales' && employee.employeeRole !== 'Field Sales' ? employee.employeeRole : null
            ).map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Designation
          </label>
          <select
            {...register('designation')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="">--Select Designation--</option>
            {withCurrentValue(designations, employee.designation).map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Role
          </label>
          <select
            {...register('role', { required: "Role is required" })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          >
            <option value="Sales">Sales</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Joining Date"
            type="date"
            {...register('joiningDate')}
            error={errors.joiningDate}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Address
          </label>
          <textarea
            {...register('address')}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          ></textarea>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Update Employee
        </Button>
      </div>
    </form>
  );
};

export default EditEmployee;
