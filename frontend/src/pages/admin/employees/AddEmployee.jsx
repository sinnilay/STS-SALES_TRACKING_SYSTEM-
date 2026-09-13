import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, ArrowLeft, Save, Shield, User } from 'lucide-react';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

const AddEmployee = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employeeRoles, setEmployeeRoles] = useState([]);
  const [permissions, setPermissions] = useState({
    addSts: false,
    editSts: false,
    addEmployee: false,
    assignSts: false,
  });
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue } = useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const depts = await settingsService.getDepartments();
      const desigs = await settingsService.getDesignations();
      const eRoles = await settingsService.getEmployeeRoles();
      setDepartments(depts);
      setDesignations(desigs);
      setEmployeeRoles(eRoles);
    } catch (error) {
      toast.error("Failed to fetch settings");
    }
  };

  const handleAddDepartment = async () => {
    const name = window.prompt("Enter new Employee Department:");
    if (!name) return;
    try {
      const newDept = await settingsService.addDepartment(name);
      setDepartments([...departments, newDept]);
      setValue('employeeDept', newDept.name);
      toast.success("Department added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add department");
    }
  };

  const handleAddDesignation = async () => {
    const name = window.prompt("Enter new Designation:");
    if (!name) return;
    try {
      const newDesig = await settingsService.addDesignation(name);
      setDesignations([...designations, newDesig]);
      setValue('designation', newDesig.name);
      toast.success("Designation added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add designation");
    }
  };

  const handleAddEmployeeRole = async () => {
    const name = window.prompt("Enter new Employee Role (e.g. Tele Sales, Field Sales):");
    if (!name) return;
    try {
      const newRole = await settingsService.addEmployeeRole(name);
      setEmployeeRoles([...employeeRoles, newRole]);
      setValue('employeeRole', newRole.name);
      toast.success("Employee Role added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add employee role");
    }
  };

  const handlePermissionToggle = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await employeeService.addEmployee({
        employeeDept: data.employeeDept,
        designation: data.designation,
        cityBranch: data.cityBranch,
        fullName: data.fullName,
        joiningDate: data.joiningDate,
        fathersName: data.fathersName,
        localAddress: data.localAddress,
        permanentAddress: data.permanentAddress,
        zipCode: data.zipCode,
        sex: data.sex,
        qualification: data.qualification,
        phoneNumber: data.phoneNumber,
        mobileNo: data.mobileNo,
        alternateMobileNo: data.alternateMobileNo,
        dateOfBirth: data.dateOfBirth,
        email: data.email, // using email as user id
        password: data.password,
        role: data.role || 'Sales',
        employeeRole: data.employeeRole || '',
        permissions: JSON.stringify(Object.keys(permissions).filter(k => permissions[k])),
        department: data.employeeDept, // default syncing department
        address: data.permanentAddress, // default syncing address
      });
      toast.success("Employee added and email sent successfully");
      navigate('/admin/employees');
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add employee");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/admin/employees')}
          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary-500" />
            New Employee Registration
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Fill in the detailed information below to register a new employee into the STS system.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* General Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">General Information</h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Employee Dept <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddDepartment} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Add New
                </button>
              </div>
              <select
                {...register('employeeDept', { required: "Employee Department is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">--Select Dept--</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              {errors.employeeDept && <p className="text-xs text-red-500 mt-1">{errors.employeeDept.message}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Employee Role <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddEmployeeRole} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Add New
                </button>
              </div>
              <select
                {...register('employeeRole', { required: "Employee Role is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">Select Role</option>
                <option value="Tele Sales">Tele Sales</option>
                <option value="Field Sales">Field Sales</option>
                {employeeRoles.filter(r => r.name !== 'Tele Sales' && r.name !== 'Field Sales').map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
              {errors.employeeRole && <p className="text-xs text-red-500 mt-1">{errors.employeeRole.message}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Designation <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddDesignation} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  + Add New
                </button>
              </div>
              <select
                {...register('designation', { required: "Designation is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">Select Designation</option>
                {designations.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              {errors.designation && <p className="text-xs text-red-500 mt-1">{errors.designation.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">City / Branch <span className="text-red-500">*</span></label>
              <select
                {...register('cityBranch', { required: "City/Branch is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">Select Branch</option>
                <option value="GKP">GKP</option>
                <option value="LKO">LKO</option>
                <option value="DEL">DEL</option>
              </select>
              {errors.cityBranch && <p className="text-xs text-red-500 mt-1">{errors.cityBranch.message}</p>}
            </div>

            <div className="lg:col-span-2">
              <Input
                label="Full Name *"
                {...register('fullName', { required: "Full Name is required" })}
                error={errors.fullName}
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <Input
                label="Join Date *"
                type="date"
                {...register('joiningDate', { required: "Join date is required" })}
                error={errors.joiningDate}
              />
            </div>

            <div className="lg:col-span-3">
              <Input
                label="Father's Name *"
                {...register('fathersName', { required: "Father's name is required" })}
                error={errors.fathersName}
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Local Address
              </label>
              <textarea
                {...register('localAddress')}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
                placeholder="Current residential address"
              ></textarea>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Permanent Address *
              </label>
              <textarea
                {...register('permanentAddress', { required: "Permanent address is required" })}
                rows="2"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
                placeholder="Permanent residential address"
              ></textarea>
              {errors.permanentAddress && <p className="text-xs text-red-500 mt-1">{errors.permanentAddress.message}</p>}
            </div>

            <div>
              <Input
                label="Zip Code *"
                {...register('zipCode', { required: "Zip Code is required" })}
                error={errors.zipCode}
                placeholder="e.g. 226010"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Sex <span className="text-red-500">*</span></label>
              <select
                {...register('sex', { required: "Sex is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">--Select Sex--</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.sex && <p className="text-xs text-red-500 mt-1">{errors.sex.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Qualification <span className="text-red-500">*</span></label>
              <select
                {...register('qualification', { required: "Qualification is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="">[ Please select a study Level ]</option>
                <option value="High School">High School</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Graduate">Graduate</option>
                <option value="Post Graduate">Post Graduate</option>
              </select>
              {errors.qualification && <p className="text-xs text-red-500 mt-1">{errors.qualification.message}</p>}
            </div>

            <div>
              <Input
                label="Phone No."
                type="tel"
                {...register('phoneNumber')}
                error={errors.phoneNumber}
                placeholder="Landline number"
              />
            </div>

            <div>
              <Input
                label="Mobile No. *"
                type="tel"
                {...register('mobileNo', { required: "Mobile No is required" })}
                error={errors.mobileNo}
                placeholder="Primary mobile number"
              />
            </div>

            <div>
              <Input
                label="Alternate Mobile No."
                type="tel"
                {...register('alternateMobileNo')}
                error={errors.alternateMobileNo}
              />
            </div>

            <div>
              <Input
                label="Date of Birth *"
                type="date"
                {...register('dateOfBirth', { required: "Date of Birth is required" })}
                error={errors.dateOfBirth}
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">System Role <span className="text-red-500">*</span></label>
              <select
                {...register('role', { required: "Role is required" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
              >
                <option value="Sales">Sales (Limited Access)</option>
                <option value="Admin">Admin (Full Access)</option>
              </select>
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
            </div>

          </div>
        </div>

        {/* Access Module / Permissions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Access Module (Permissions)</h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Configure what sections and actions this employee is allowed to access within the system.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { key: 'addSts', label: 'Add STS Record', desc: 'Can create new STS records' },
                { key: 'editSts', label: 'Edit STS Record', desc: 'Can modify existing STS data' },
                { key: 'addEmployee', label: 'Add Employee', desc: 'Can register new staff' },
                { key: 'assignSts', label: 'Allotment of STS', desc: 'Can assign STS records to others' },
              ].map(perm => (
                <div key={perm.key} className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer ${permissions[perm.key] ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'}`} onClick={() => handlePermissionToggle(perm.key)}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`font-semibold ${permissions[perm.key] ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-slate-100'}`}>{perm.label}</h4>
                    <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${permissions[perm.key] ? 'bg-primary-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${permissions[perm.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{perm.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Login Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Login Information</h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="User Id (Email Address) *"
              type="email"
              {...register('email', { 
                required: "User ID/Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address format"
                }
              })}
              error={errors.email}
              placeholder="user@ideaspromotion.com"
            />
            
            <Input
              label="Password *"
              type="password"
              {...register('password', { required: "Password is required", minLength: 6 })}
              error={errors.password}
              placeholder="Enter secure password"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/employees')}
            disabled={isLoading}
            className="px-8"
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="px-8 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 border-none shadow-lg shadow-primary-500/30">
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Registering & Sending Email...' : 'Submit Registration'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddEmployee;
