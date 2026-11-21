import React, { useState, useEffect, forwardRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import DeletableSelect from '../../../components/DeletableSelect';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, ArrowLeft, Save, Shield, User, Landmark, Users, FileText, UploadCloud } from 'lucide-react';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Button from '../../../components/Button';

const FIELD_INPUT = 'w-full px-3.5 py-2.5 rounded-xl border bg-gray-50/60 dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 transition focus:outline-none focus:bg-white focus:ring-4';
const FIELD_OK = 'border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-primary-500/15';
const FIELD_ERR = 'border-red-400 focus:border-red-500 focus:ring-red-500/15';

// Modern field used throughout this form (same props as the shared Input).
const Input = forwardRef(({ label, error, className = '', ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">{label}</label>}
    <input ref={ref} className={`${FIELD_INPUT} ${error ? FIELD_ERR : FIELD_OK} ${className}`} {...props} />
    {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
  </div>
));
Input.displayName = 'Input';

const DEFAULT_CITY_BRANCHES = ['GKP', 'LKO', 'DEL'];

const AddEmployee = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employeeRoles, setEmployeeRoles] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  // Suggestions only: the three original branches plus every branch already in use,
  // so the list grows on its own as employees are added elsewhere.
  const [cityBranches, setCityBranches] = useState(DEFAULT_CITY_BRANCHES);
  const [permissions, setPermissions] = useState({
    addSts: false,
    editSts: false,
    addEmployee: false,
    assignSts: false,
  });
  const [documents, setDocuments] = useState({ photo: null, aadhaar: null, pan: null });
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setValue, getValues, control } = useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const depts = await settingsService.getDepartments();
      const desigs = await settingsService.getDesignations();
      const eRoles = await settingsService.getEmployeeRoles();
      const quals = await settingsService.getQualifications();
      setDepartments(depts);
      setDesignations(desigs);
      setEmployeeRoles(eRoles);
      setQualifications(quals);
    } catch (error) {
      toast.error("Failed to fetch settings");
    }
  };

  // Branch suggestions are derived from existing employees — a miss here is
  // harmless, since the field accepts anything typed into it.
  useEffect(() => {
    employeeService.getAllEmployees()
      .then((employees) => {
        const used = (employees || []).map((e) => e.cityBranch).filter(Boolean);
        setCityBranches([...new Set([...DEFAULT_CITY_BRANCHES, ...used])]);
      })
      .catch(() => {});
  }, []);

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

  const handleAddQualification = async () => {
    const name = window.prompt("Enter new Qualification:");
    if (!name) return;
    try {
      const newQual = await settingsService.addQualification(name);
      setQualifications([...qualifications, newQual]);
      setValue('qualification', newQual.name);
      toast.success("Qualification added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add qualification");
    }
  };

  const handleDeleteSetting = async (item, field, label, deleteFn, setList) => {
    if (!window.confirm(`Delete ${label} "${item.name}"?`)) return;
    try {
      await deleteFn(item.id);
      setList((prev) => prev.filter((x) => x.id !== item.id));
      if (getValues(field) === item.name) setValue(field, '');
      toast.success(`${label} deleted successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to delete ${label.toLowerCase()}`);
    }
  };

  const handlePermissionToggle =(key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDocumentChange = (key, file) => {
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error('File must be 5 MB or smaller');
      return;
    }
    setDocuments(prev => ({ ...prev, [key]: file || null }));
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const created = await employeeService.addEmployee({
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
        phoneNumber: data.mobileNo, // Phone No. field was dropped — keep the legacy column in sync with Mobile No.
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
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        panCardNo: data.panCardNo?.toUpperCase(),
        localRefName: data.localRefName,
        localRefRelation: data.localRefRelation,
        localRefContact: data.localRefContact,
      });
      // The employee exists now — a failed upload shouldn't block navigation, but must be reported.
      // Documents are optional — upload only the ones that were chosen.
      const uploads = await Promise.allSettled([
        documents.photo && employeeService.uploadEmployeePicture(created.id, documents.photo),
        documents.aadhaar && employeeService.uploadEmployeeDocument(created.id, 'aadhaar', documents.aadhaar),
        documents.pan && employeeService.uploadEmployeeDocument(created.id, 'pan', documents.pan),
      ].filter(Boolean));
      if (uploads.some(u => u.status === 'rejected')) {
        toast.error("Employee added, but some documents failed to upload. Please re-upload them from Edit Employee.");
      } else {
        toast.success("Employee added and email sent successfully");
      }
      navigate('/admin/employees');
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add employee");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 animate-fade-in pb-28 md:pb-12">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-2 sm:gap-4 mb-5 sm:mb-8">
        <button 
          onClick={() => navigate('/admin/employees')}
          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary-500" />
            New Employee Registration
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Fill in the detailed information below to register a new employee into the STS system.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-8">
        {/* General Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">General Information</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Personal, employment and contact details</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4 sm:gap-6">
            
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">Employee Dept <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddDepartment} className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline">
                  + Add New
                </button>
              </div>
              <Controller
                name="employeeDept"
                control={control}
                rules={{ required: "Employee Department is required" }}
                render={({ field }) => (
                  <DeletableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={departments}
                    placeholder="--Select Dept--"
                    onDelete={(o) => handleDeleteSetting(o, 'employeeDept', 'Department', settingsService.deleteDepartment, setDepartments)}
                  />
                )}
              />
              {errors.employeeDept && <p className="text-xs text-red-500 mt-1">{errors.employeeDept.message}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">Employee Role <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddEmployeeRole} className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline">
                  + Add New
                </button>
              </div>
              <Controller
                name="employeeRole"
                control={control}
                rules={{ required: "Employee Role is required" }}
                render={({ field }) => (
                  <DeletableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={employeeRoles}
                    placeholder="Select Role"
                    onDelete={(o) => handleDeleteSetting(o, 'employeeRole', 'Role', settingsService.deleteEmployeeRole, setEmployeeRoles)}
                  />
                )}
              />
              {errors.employeeRole && <p className="text-xs text-red-500 mt-1">{errors.employeeRole.message}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">Designation <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddDesignation} className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline">
                  + Add New
                </button>
              </div>
              <Controller
                name="designation"
                control={control}
                rules={{ required: "Designation is required" }}
                render={({ field }) => (
                  <DeletableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={designations}
                    placeholder="Select Designation"
                    onDelete={(o) => handleDeleteSetting(o, 'designation', 'Designation', settingsService.deleteDesignation, setDesignations)}
                  />
                )}
              />
              {errors.designation && <p className="text-xs text-red-500 mt-1">{errors.designation.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">City / Branch <span className="text-red-500">*</span></label>
              {/* Free text with suggestions — the branch list is not fixed, so any new
                  city can simply be typed in; existing branches are offered as options. */}
              <input
                type="text"
                list="city-branch-options"
                placeholder="Select or type a branch"
                {...register('cityBranch', { required: "City/Branch is required" })}
                className={`${FIELD_INPUT} ${FIELD_OK}`}
              />
              <datalist id="city-branch-options">
                {cityBranches.map((branch) => <option key={branch} value={branch} />)}
              </datalist>
              {errors.cityBranch && <p className="text-xs text-red-500 mt-1">{errors.cityBranch.message}</p>}
            </div>

            <div className="lg:col-span-2 max-md:col-span-2">
              <Input
                label="Full Name *"
                {...register('fullName', { required: "Full Name is required" })}
                error={errors.fullName}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="max-md:col-span-2">
              <Input
                label="Join Date *"
                type="date"
                {...register('joiningDate', { required: "Join date is required" })}
                error={errors.joiningDate}
              />
            </div>

            <div className="lg:col-span-3 max-md:col-span-2">
              <Input
                label="Father's Name *"
                {...register('fathersName', { required: "Father's name is required" })}
                error={errors.fathersName}
              />
            </div>

            <div className="lg:col-span-3 max-md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">
                Local Address
              </label>
              <textarea
                {...register('localAddress')}
                rows="2"
                className={`${FIELD_INPUT} ${FIELD_OK}`}
                placeholder="Current residential address"
              ></textarea>
            </div>

            <div className="lg:col-span-3 max-md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">
                Permanent Address *
              </label>
              <textarea
                {...register('permanentAddress', { required: "Permanent address is required" })}
                rows="2"
                className={`${FIELD_INPUT} ${FIELD_OK}`}
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
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">Sex <span className="text-red-500">*</span></label>
              <select
                {...register('sex', { required: "Sex is required" })}
                className={`${FIELD_INPUT} ${FIELD_OK}`}
              >
                <option value="">--Select Sex--</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.sex && <p className="text-xs text-red-500 mt-1">{errors.sex.message}</p>}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">Qualification <span className="text-red-500">*</span></label>
                <button type="button" onClick={handleAddQualification} className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:underline">
                  + Add New
                </button>
              </div>
              <Controller
                name="qualification"
                control={control}
                rules={{ required: "Qualification is required" }}
                render={({ field }) => (
                  <DeletableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={qualifications}
                    placeholder="[ Please select a study Level ]"
                    onDelete={(o) => handleDeleteSetting(o, 'qualification', 'Qualification', settingsService.deleteQualification, setQualifications)}
                  />
                )}
              />
              {errors.qualification && <p className="text-xs text-red-500 mt-1">{errors.qualification.message}</p>}
            </div>

            <div>
              <Input
                label="Mobile No. *"
                type="tel"
                {...register('mobileNo', {
                  required: "Mobile No is required",
                  pattern: { value: /^\d{10}$/, message: "Enter a 10-digit mobile number" },
                  onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
                })}
                inputMode="numeric"
                maxLength={10}
                error={errors.mobileNo}
                placeholder="Primary mobile number"
              />
            </div>

            <div>
              <Input
                label="Alternate Mobile No."
                type="tel"
                {...register('alternateMobileNo', {
                  pattern: { value: /^(\d{10})?$/, message: "Enter a 10-digit mobile number" },
                  onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
                })}
                inputMode="numeric"
                maxLength={10}
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
            
            <div className="space-y-1 max-md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300">System Role <span className="text-red-500">*</span></label>
              <select
                {...register('role', { required: "Role is required" })}
                className={`${FIELD_INPUT} ${FIELD_OK}`}
              >
                <option value="Sales">Sales (Limited Access)</option>
                <option value="SubAdmin">Sub-Admin (Full Access)</option>
              </select>
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
            </div>

          </div>
        </div>

        {/* Bank Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Bank Information</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Salary account and PAN details</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4 sm:gap-6">
            <Input label="Bank Name" {...register('bankName')} error={errors.bankName} />
            <Input label="Branch" {...register('bankBranch')} error={errors.bankBranch} />
            <Input label="A/c Holder Name" {...register('accountHolderName')} error={errors.accountHolderName} />
            <Input
              label="Account Number"
              inputMode="numeric"
              {...register('accountNumber', {
                pattern: { value: /^\d{6,20}$/, message: "Enter a valid account number (6–20 digits)" },
              })}
              error={errors.accountNumber}
            />
            <div className="max-md:col-span-2">
            <Input
              label="Pan Card No."
              placeholder="ABCDE1234F"
              maxLength={10}
              {...register('panCardNo', {
                pattern: { value: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: "Invalid PAN format (e.g. ABCDE1234F)" },
              })}
              error={errors.panCardNo}
            />
            </div>
          </div>
        </div>

        {/* Local Reference Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Local Reference</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Someone who can vouch for the employee locally</p>
            </div>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4 sm:gap-6">
            <Input label="Name *" {...register('localRefName', { required: "Reference name is required" })} error={errors.localRefName} />
            <Input label="Relation *" {...register('localRefRelation', { required: "Relation is required" })} error={errors.localRefRelation} />
            <div className="max-md:col-span-2">
            <Input
              label="Contact No. *"
              type="tel"
              {...register('localRefContact', {
                required: "Reference contact number is required",
                pattern: { value: /^\d{10}$/, message: "Enter a 10-digit contact number" },
                onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
              })}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              error={errors.localRefContact}
            />
            </div>
          </div>
        </div>

        {/* Document Upload Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Documents Upload</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Photo, Aadhaar and PAN copies</p>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 sm:mb-6">
              Upload clear copies of the employee's documents (optional — they can also be added later from Edit Employee). JPG, PNG or WEBP (PDF also accepted for Aadhaar / PAN), max 5 MB each.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { key: 'photo', label: 'Employee Photo', accept: 'image/jpeg,image/png,image/webp' },
                { key: 'aadhaar', label: 'Aadhaar Card', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
                { key: 'pan', label: 'PAN Card', accept: 'image/jpeg,image/png,image/webp,application/pdf' },
              ].map(doc => (
                <label
                  key={doc.key}
                  className={`flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 border-2 border-dashed rounded-xl p-2.5 sm:p-6 cursor-pointer transition-colors ${documents[doc.key] ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-slate-600 hover:border-primary-500'}`}
                >
                  <UploadCloud className={`w-6 h-6 sm:w-8 sm:h-8 ${documents[doc.key] ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <span className="text-xs sm:text-base font-semibold text-gray-900 dark:text-slate-100">{doc.label} <span className="text-xs font-normal text-gray-400">(optional)</span></span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 break-all line-clamp-2">
                    {documents[doc.key] ? documents[doc.key].name : 'Click to choose a file'}
                  </span>
                  <input
                    type="file"
                    accept={doc.accept}
                    className="hidden"
                    onChange={(e) => handleDocumentChange(doc.key, e.target.files?.[0])}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Access Module / Permissions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Access Module (Permissions)</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">What this employee is allowed to do</p>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 sm:mb-6">
              Configure what sections and actions this employee is allowed to access within the system.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Login Information</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Credentials used to sign in</p>
            </div>
          </div>
          
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
        <div className="flex items-center justify-end gap-4 pt-4 max-md:fixed max-md:bottom-0 max-md:inset-x-0 max-md:z-30 max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:p-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:bg-white/95 max-md:dark:bg-slate-900/95 max-md:backdrop-blur max-md:border-t max-md:border-slate-200 max-md:dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/employees')}
            disabled={isLoading}
            className="px-4 sm:px-8 max-md:w-full"
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} className="px-4 sm:px-8 max-md:w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 border-none shadow-lg shadow-primary-500/30">
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Registering & Sending Email...' : 'Submit Registration'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddEmployee;
