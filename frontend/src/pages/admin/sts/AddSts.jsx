import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Save, ArrowLeft, Users, Search, CheckCircle, AlertTriangle, MapPin, Calendar, Tag, User, Phone, Mail, Globe, FileText, Flag, Eye, Upload } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { stsService } from '../../../services/stsService';
import { employeeService } from '../../../services/employeeService';
import { employeeStsService } from '../../../services/employeeStsService';
import { settingsService } from '../../../services/settingsService';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import StsDetailsDrawer from './StsDetailsDrawer';
import ImportStsModal from './ImportStsModal';
import { getStatusMeta } from '../../../constants/stsPipeline';

const AddSts = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [allocatedToId, setAllocatedToId] = useState('');
  const [duplicateResults, setDuplicateResults] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isFormUnlocked, setIsFormUnlocked] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [requestingId, setRequestingId] = useState(null);
  const [requestedIds, setRequestedIds] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const navigate = useNavigate();

  // Duplicate search only returns a handful of summary fields — fetch the full record
  // (and its history) the same way STS List does, so clicking one opens the same drawer.
  const detailsService = user?.role === 'Admin' ? stsService : employeeStsService;

  const handleViewDuplicate = async (id) => {
    setIsDrawerOpen(true);
    setSelectedRecordForDetails(null);
    try {
      const full = await detailsService.getSalesDataById(id);
      setSelectedRecordForDetails(full);
    } catch (error) {
      toast.error('Failed to load record details');
      setIsDrawerOpen(false);
    }
  };

  // Employee found a duplicate and wants it instead of creating a fresh one — sends a
  // request to Admin's "Employee STS Request" queue rather than allocating it directly.
  const handleRequestAllocation = async (id) => {
    setRequestingId(id);
    try {
      await employeeStsService.requestAllocation(id);
      toast.success('Request sent to Admin for approval.');
      setRequestedIds((prev) => [...prev, id]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setRequestingId(null);
    }
  };
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      country: 'India',
      priority: 'Highest',
      source: 'Yellow Page'
    }
  });

  const stsName = watch('companyName');

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Handing a record off to a teammate is an Admin-only privilege — Tele Sales and
  // Field Sales employees always land their own STS records in their own queue.
  const canAllocate = user?.role === 'Admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, roleData, deptData] = await Promise.all([
          user?.role === 'Admin' ? employeeService.getAllEmployees() : employeeStsService.getCompanyEmployees(),
          settingsService.getEmployeeRoles(),
          settingsService.getDepartments()
        ]);
        setEmployees(empData.filter(e => e.isActive));
        const dbRoles = roleData.map(r => r.name);
        setRoles(['Tele Sales', 'Field Sales', ...dbRoles.filter(r => r !== 'Tele Sales' && r !== 'Field Sales')]);
        setDepartments(deptData.map(d => d.name));
      } catch (error) {
        console.error("Failed to fetch data for dropdowns", error);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleCheckDuplicate = async () => {
    if (!stsName) {
      toast.error('Please enter an STS name to check');
      return;
    }
    setIsCheckingDuplicate(true);
    try {
      const results = user?.role === 'Admin'
        ? await stsService.searchSalesData('Name', stsName)
        : await stsService.searchSalesDataAsEmployee('Name', stsName);
      if (results && results.length > 0) {
        setDuplicateResults(results);
        setIsFormUnlocked(false);
      } else {
        toast.success('No duplicates found. You can proceed.');
        setDuplicateResults(null);
        setIsFormUnlocked(true);
      }
    } catch (error) {
      toast.error('Error checking duplicate');
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Re-lock the rest of the form and drop any stale duplicate list if the name is edited
  // after a check — a check only vouches for the exact name it was run against.
  useEffect(() => {
    setIsFormUnlocked(false);
    setDuplicateResults(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stsName]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    data.allocatedToId = allocatedToId ? Number(allocatedToId) : null;
    try {
      if (user?.role === 'Admin') {
        await stsService.addSalesData(data);
      } else {
        await stsService.addSalesDataAsEmployee(data);
      }
      toast.success("STS record added successfully");
      navigate(user?.role === 'Admin' ? '/admin/sts' : '/sales/sts');
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add STS");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = (e.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           e.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = selectedRoleFilter ? e.employeeRole === selectedRoleFilter : true;
    const matchesDept = selectedDeptFilter ? e.employeeDept === selectedDeptFilter : true;
    return matchesSearch && matchesRole && matchesDept;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(user?.role === 'Admin' ? '/admin/sts' : '/sales/sts')}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary-500" />
              Add New STS
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Fill in the details to create a new Sales Tracking System record.
            </p>
          </div>
        </div>
        {user?.role === 'Admin' && (
          <Button type="button" variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Check Duplicate Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">Check Duplicate</h3>
          </div>
          <div className="p-4 flex items-end gap-4 bg-gray-50/50 dark:bg-slate-800/50">
            <div className="flex-1 max-w-md">
              <Input
                label="Enter Name of STS To Be Added"
                {...register('companyName', { required: "STS Name is required" })}
                error={errors.companyName}
                placeholder="e.g. Acme Corp"
                onKeyDown={(e) => {
                  // Enter here should run the duplicate check, not submit the (still hidden)
                  // rest of the form — react-hook-form submits on Enter in any text field by default.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCheckDuplicate();
                  }
                }}
              />
            </div>
            <div className="pb-1">
              <Button type="button" onClick={handleCheckDuplicate} variant="primary" className="h-[42px]" isLoading={isCheckingDuplicate}>
                Check Duplicate
              </Button>
            </div>
          </div>
        </div>

        {/* Duplicate Results — shown inline on the page, not in a popup. Click a record to
            open the same details drawer used on the STS List page. */}
        {duplicateResults && duplicateResults.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-500/30 overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-3.5 border-b border-amber-100 dark:border-amber-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {duplicateResults.length} similar record{duplicateResults.length !== 1 ? 's' : ''} found — review before creating a new one
              </div>
              <button
                type="button"
                onClick={() => setDuplicateResults(null)}
                className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 px-2 py-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors shrink-0"
              >
                Dismiss
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[65vh] overflow-y-auto">
              {duplicateResults.map((r) => {
                const isRequested = requestedIds.includes(r.id);
                const assignee = r.allocatedTo?.fullName || r.teleExecutive?.fullName || r.marketingExecutive?.fullName;
                const address = [r.address1, r.address2, r.cityDistrict, r.state, r.pincode, r.country].filter(Boolean).join(', ');
                return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleViewDuplicate(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleViewDuplicate(r.id); }}
                  className="group w-full text-left px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{r.companyName}</p>
                      <p className="text-xs font-mono text-gray-400 dark:text-slate-500">{r.companyID}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {user?.role !== 'Admin' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRequestAllocation(r.id); }}
                          disabled={isRequested || requestingId === r.id}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                            isRequested
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default'
                              : 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20'
                          }`}
                        >
                          {isRequested ? 'Requested' : requestingId === r.id ? 'Sending...' : 'Allot to Me'}
                        </button>
                      )}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${getStatusMeta(r.status).badge}`}>
                        {r.status || 'New'}
                      </span>
                    </div>
                  </div>

                  {/* Quick-scan chips */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-slate-400 mb-3">
                    {r.priority && <span className="flex items-center gap-1.5"><Flag className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {r.priority}</span>}
                    <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {r.source || '—'}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {new Date(r.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0 text-gray-400" /> {assignee || 'Unassigned'}</span>
                  </div>

                  {/* Detailed company info — visible up front, no click needed */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm bg-gray-50 dark:bg-slate-900/40 rounded-lg p-3.5 border border-gray-100 dark:border-slate-700/50">
                    <div className="flex items-start gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 dark:text-slate-200 truncate">{r.contactPerson || '—'}</div>
                        {r.designation && <div className="text-xs text-gray-400 truncate">{r.designation}</div>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                      <div className="min-w-0 text-gray-700 dark:text-slate-300 truncate">{r.mobile1 || r.phoneNumber || '—'}{r.mobile2 ? ` · ${r.mobile2}` : ''}</div>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                      <div className="min-w-0 text-gray-700 dark:text-slate-300 truncate">{r.email || '—'}</div>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <Globe className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                      <div className="min-w-0 text-gray-700 dark:text-slate-300 truncate">{r.website || '—'}</div>
                    </div>
                    <div className="sm:col-span-2 flex items-start gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                      <div className="min-w-0 text-gray-700 dark:text-slate-300">{address || '—'}</div>
                    </div>
                    {r.businessDescription && (
                      <div className="sm:col-span-2 flex items-start gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                        <div className="min-w-0 text-gray-700 dark:text-slate-300 line-clamp-2">{r.businessDescription}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 mt-2.5">
                    <Eye className="w-3.5 h-3.5" /> Click for full history & timeline
                  </div>
                </div>
              );})}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500 dark:text-slate-400">None of these match? You can still proceed with a new record.</p>
              <Button type="button" onClick={() => { setDuplicateResults(null); setIsFormUnlocked(true); }} variant="primary">
                <Building2 className="w-4 h-4 mr-2" /> Add New STS
              </Button>
            </div>
          </div>
        )}

        {!isFormUnlocked && (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            Enter the STS name above and click <span className="font-semibold">Check Duplicate</span> to continue.
          </div>
        )}

        {isFormUnlocked && (
        <>
        {/* General Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="bg-blue-500 px-6 py-3 border-b border-blue-600 flex items-center justify-center">
            <h3 className="text-sm font-bold text-white tracking-wider">General Information</h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 bg-gray-50/30 dark:bg-slate-800/30">
            
            {/* Left Column */}
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Contact Person <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('contactPerson', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Address-1 <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('address1', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Address-2</label>
                <div className="w-2/3">
                  <input type="text" {...register('address2')} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Phone</label>
                <div className="w-2/3">
                  <input type="text" {...register('phoneNumber')} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Mobile-2</label>
                <div className="w-2/3">
                  <input type="text" {...register('mobile2')} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Website</label>
                <div className="w-2/3">
                  <input type="text" {...register('website')} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">State <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <select {...register('state', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm">
                    <option value="">--Select State--</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Maharashtra">Maharashtra</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Country <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('country', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" readOnly />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Designation <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('designation', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-12">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Mobile-1 <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('mobile1', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Fax</label>
                <div className="w-2/3">
                  <input type="text" {...register('fax')} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Email <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="email" {...register('email', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">City <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input
                    type="text"
                    list="city-options"
                    {...register('cityDistrict', { required: true })}
                    placeholder="Select or type a city"
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm"
                  />
                  <datalist id="city-options">
                    <option value="Gorakhpur" />
                    <option value="Lucknow" />
                    <option value="New Delhi" />
                  </datalist>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-1/3 text-sm font-medium text-gray-700 dark:text-slate-300 text-right">Zip Code <span className="text-red-500">*</span></label>
                <div className="w-2/3">
                  <input type="text" {...register('pincode', { required: true })} className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Executive / Marketing Section -> Replaced with Allocation */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="bg-blue-500 px-6 py-3 border-b border-blue-600 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-wider">
              {canAllocate ? 'Hand Off to a Teammate (optional)' : 'Lead Details'}
            </h3>
            {canAllocate && allocatedToId && (
              <span className="text-xs font-semibold bg-white text-blue-600 px-2 py-1 rounded-full">
                Employee Selected
              </span>
            )}
          </div>

          <div className="p-6 bg-gray-50/30 dark:bg-slate-800/30">
            {user?.role !== 'Admin' && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                {canAllocate
                  ? "This record is yours by default — it'll land straight in your My STS Records. Pick a teammate below only if you want to route it to them instead."
                  : "This record will be added directly to your My STS Records."}
              </p>
            )}
            {canAllocate && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Filter by Role</label>
                    <select
                      value={selectedRoleFilter} onChange={e => setSelectedRoleFilter(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm"
                    >
                      <option value="">All Roles</option>
                      {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Filter by Department</label>
                    <select
                      value={selectedDeptFilter} onChange={e => setSelectedDeptFilter(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm"
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm placeholder-gray-400"
                    placeholder="Search employees by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden h-48 overflow-y-auto bg-white dark:bg-slate-900 mb-4">
                  {filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No employees found.</div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                      {filteredEmployees.map(emp => (
                        <li
                          key={emp.id}
                          onClick={() => setAllocatedToId(emp.id === allocatedToId ? '' : emp.id)}
                          className={`p-3 cursor-pointer flex justify-between items-center transition-colors ${allocatedToId === emp.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                          <div>
                            <div className={`font-medium text-sm ${allocatedToId === emp.id ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{emp.fullName}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">{emp.email} • {emp.employeeDept} • {emp.employeeRole}</div>
                          </div>
                          {allocatedToId === emp.id && <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-900">
                <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
                  <tr>
                    <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 font-medium">Lead By</th>
                    <th className="px-4 py-2 border-r border-gray-200 dark:border-slate-700 font-medium">Business Description</th>
                    <th className="px-4 py-2 font-medium">Opening Comments</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border-r border-t border-gray-200 dark:border-slate-700 align-top">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <label className="w-16 text-xs font-semibold">Priority <span className="text-red-500">*</span></label>
                          <select {...register('priority')} className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800">
                            <option value="Highest">Highest</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-16 text-xs font-semibold">Source <span className="text-red-500">*</span></label>
                          <select {...register('source')} className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800">
                            <option value="Yellow Page">Yellow Page</option>
                            <option value="Visiting Card">Visiting Card</option>
                            <option value="Online Directory">Online Directory</option>
                            <option value="Referral">Referral</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-16 text-xs font-semibold">Lead By</label>
                          <input type="text" {...register('leadBy')} className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800" />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r border-t border-gray-200 dark:border-slate-700 align-top">
                      <textarea {...register('businessDescription')} rows="5" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded text-xs focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-800 resize-none"></textarea>
                    </td>
                    <td className="px-2 py-2 border-t border-gray-200 dark:border-slate-700 align-top">
                      <textarea {...register('openingComments')} rows="5" className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded text-xs focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-800 resize-none"></textarea>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 pt-4">
          <Button type="submit" isLoading={isLoading} className="px-12 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-md">
            Submit
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/sts')} className="px-12 py-2.5 rounded font-medium shadow-sm">
            Reset
          </Button>
        </div>
        </>
        )}
      </form>

      <StsDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        salesRecord={selectedRecordForDetails}
        fetchHistory={detailsService.getSalesHistory}
      />

      {user?.role === 'Admin' && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Import Sales Records"
        >
          <ImportStsModal
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={() => {
              setIsImportModalOpen(false);
              navigate('/admin/sts');
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default AddSts;
