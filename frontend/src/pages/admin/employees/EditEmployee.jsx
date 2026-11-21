import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Camera, FileText } from 'lucide-react';
import { employeeService } from '../../../services/employeeService';
import { settingsService } from '../../../services/settingsService';
import Input from '../../../components/Input';
import Button from '../../../components/Button';

const buildDefaultValues = (employee) => ({
  fullName: employee.fullName || '',
  email: employee.email || '',
  mobileNo: employee.mobileNo || employee.phoneNumber || '',
  alternateMobileNo: employee.alternateMobileNo || '',
  department: employee.department || '',
  employeeDept: employee.employeeDept || '',
  employeeRole: employee.employeeRole || '',
  designation: employee.designation || '',
  cityBranch: employee.cityBranch || '',
  role: employee.role || 'Sales',
  joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
  address: employee.address || '',
  bankName: employee.bankName || '',
  bankBranch: employee.bankBranch || '',
  accountHolderName: employee.accountHolderName || '',
  accountNumber: employee.accountNumber || '',
  panCardNo: employee.panCardNo || '',
  localRefName: employee.localRefName || '',
  localRefRelation: employee.localRefRelation || '',
  localRefContact: employee.localRefContact || ''
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
  const [cityBranches, setCityBranches] = useState([]);
  const [profilePictureUrl, setProfilePictureUrl] = useState(employee.profilePictureUrl || null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);
  // The list row doesn't carry bank / reference / document info, so load the full record.
  const [fullEmployee, setFullEmployee] = useState(employee);
  const fullEmployeeRef = useRef(employee); // latest record, readable from async callbacks
  const [docStatus, setDocStatus] = useState({ aadhaar: !!employee.hasAadhaarDoc, pan: !!employee.hasPanDoc });
  const [uploadingDoc, setUploadingDoc] = useState(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: buildDefaultValues(employee)
  });

  const handleDocumentUpload = async (docType, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be 5 MB or smaller');
      return;
    }
    setUploadingDoc(docType);
    try {
      await employeeService.uploadEmployeeDocument(employee.id, docType, file);
      setDocStatus(prev => ({ ...prev, [docType]: true }));
      toast.success('Document uploaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };

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
    employeeService.getEmployeeById(employee.id)
      .then((details) => {
        setFullEmployee(details);
        fullEmployeeRef.current = { ...employee, ...details };
        setDocStatus({ aadhaar: !!details.hasAadhaarDoc, pan: !!details.hasPanDoc });
        reset(buildDefaultValues({ ...employee, ...details }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  // City suggestions come from branches already in use; the field accepts any typed value.
  useEffect(() => {
    employeeService.getAllEmployees()
      .then((list) => setCityBranches([...new Set((list || []).map((e) => e.cityBranch).filter(Boolean))]))
      .catch(() => {});
  }, []);

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
        reset(buildDefaultValues(fullEmployeeRef.current));
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
        phoneNumber: data.mobileNo, // legacy column kept in sync with Mobile No.
        mobileNo: data.mobileNo,
        alternateMobileNo: data.alternateMobileNo,
        department: data.department,
        employeeDept: data.employeeDept,
        employeeRole: data.employeeRole,
        designation: data.designation,
        cityBranch: data.cityBranch,
        address: data.address,
        role: data.role,
        joiningDate: data.joiningDate,
        bankName: data.bankName,
        bankBranch: data.bankBranch,
        accountHolderName: data.accountHolderName,
        accountNumber: data.accountNumber,
        panCardNo: data.panCardNo?.toUpperCase(),
        localRefName: data.localRefName,
        localRefRelation: data.localRefRelation,
        localRefContact: data.localRefContact
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
            label="Mobile No."
            type="tel"
            inputMode="numeric"
            maxLength={10}
            {...register('mobileNo', {
              required: "Mobile No is required",
              pattern: { value: /^\d{10}$/, message: "Enter a 10-digit mobile number" },
              onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
            })}
            error={errors.mobileNo}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            label="Alternate Mobile No."
            type="tel"
            inputMode="numeric"
            maxLength={10}
            {...register('alternateMobileNo', {
              pattern: { value: /^(\d{10})?$/, message: "Enter a 10-digit mobile number" },
              onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
            })}
            error={errors.alternateMobileNo}
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
            City / Branch
          </label>
          <input
            type="text"
            list="edit-city-branch-options"
            placeholder="Select or type a city"
            {...register('cityBranch')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors"
          />
          <datalist id="edit-city-branch-options">
            {cityBranches.map((c) => <option key={c} value={c} />)}
          </datalist>
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
            <option value="SubAdmin">Sub-Admin</option>
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

        <h4 className="sm:col-span-2 text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border-b border-gray-100 dark:border-slate-700 pb-2 mt-2">Bank Information</h4>
        <Input label="Bank Name" {...register('bankName')} />
        <Input label="Branch" {...register('bankBranch')} />
        <Input label="A/c Holder Name" {...register('accountHolderName')} />
        <Input
          label="Account Number"
          inputMode="numeric"
          {...register('accountNumber', { pattern: { value: /^\d{6,20}$/, message: "Enter a valid account number (6–20 digits)" } })}
          error={errors.accountNumber}
        />
        <div className="sm:col-span-2">
          <Input
            label="Pan Card No."
            maxLength={10}
            {...register('panCardNo', { pattern: { value: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: "Invalid PAN format (e.g. ABCDE1234F)" } })}
            error={errors.panCardNo}
          />
        </div>

        <h4 className="sm:col-span-2 text-sm font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 border-b border-gray-100 dark:border-slate-700 pb-2 mt-2">Local Reference</h4>
        <Input label="Name" {...register('localRefName')} />
        <Input label="Relation" {...register('localRefRelation')} />
        <div className="sm:col-span-2">
          <Input label="Contact No." type="tel" {...register('localRefContact')} />
        </div>

        <h4 className="sm:col-span-2 text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 border-b border-gray-100 dark:border-slate-700 pb-2 mt-2">Documents</h4>
        {[
          { key: 'aadhaar', label: 'Aadhaar Card' },
          { key: 'pan', label: 'PAN Card' },
        ].map(doc => (
          <label
            key={doc.key}
            className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${docStatus[doc.key] ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-slate-600 hover:border-primary-500'}`}
          >
            <FileText className={`w-5 h-5 shrink-0 ${docStatus[doc.key] ? 'text-emerald-500' : 'text-gray-400'}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{doc.label}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {uploadingDoc === doc.key ? 'Uploading...' : docStatus[doc.key] ? 'Uploaded — click to replace' : 'Not uploaded — click to upload'}
              </p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={uploadingDoc === doc.key}
              onChange={(e) => handleDocumentUpload(doc.key, e)}
            />
          </label>
        ))}
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
