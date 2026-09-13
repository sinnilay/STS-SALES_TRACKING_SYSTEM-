import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, Plus, Edit2, ShieldCheck, Mail, MapPin, Settings,
  BarChart3, Briefcase, Calendar, Users, FileText, Home, Globe,
  Utensils, QrCode, ArrowLeft, CheckSquare, Sliders, Clock, RefreshCw, Navigation
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ManageCompanies = () => {
  const { token } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompanyModules, setSelectedCompanyModules] = useState(null);
  const [renewCompany, setRenewCompany] = useState(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [isRenewing, setIsRenewing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '', ownerEmail: '', ownerContact: '', city: '', state: '', country: 'India',
    address: '', zipCode: '', taxId: '', website: '', industry: '', staffLimit: 10,
    adminEmail: '', adminPassword: '', accountType: 'Permanent'
  });

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/SuperAdmin/companies');
      setCompanies(response.data);
    } catch (error) {
      toast.error('Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchCompanies();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const isTrial = formData.accountType === 'Trial';
      const payload = {
        ...formData,
        accountType: formData.accountType,
        isTrial: isTrial,
        subscriptionExpiry: isTrial 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
          : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        isActive: true
      };
      
      const response = await api.post('/SuperAdmin/companies', payload);
      
      toast.success(`Tenant workspace provisioned successfully as ${formData.accountType} account!`);
      setCompanies([...companies, response.data]);
      setIsModalOpen(false);
      setFormData({
        name: '', ownerEmail: '', ownerContact: '', city: '', state: '', country: 'India',
        address: '', zipCode: '', taxId: '', website: '', industry: '', staffLimit: 10,
        adminEmail: '', adminPassword: '', accountType: 'Permanent'
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create tenant');
    }
  };

  const handleToggleModule = async (companyId, moduleKey) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    const rawModules = company.enabledModules !== undefined && company.enabledModules !== null
      ? company.enabledModules
      : 'STS';

    let currentModules = rawModules.split(',').map(m => m.trim()).filter(Boolean);
    let updatedModules;
    if (currentModules.includes(moduleKey)) {
      updatedModules = currentModules.filter(m => m !== moduleKey);
    } else {
      updatedModules = [...currentModules, moduleKey];
    }

    const updatedModulesStr = updatedModules.join(',');

    try {
      await api.put(`/SuperAdmin/companies/${companyId}/modules`, {
        enabledModules: updatedModulesStr
      });
      
      const updatedCompany = { ...company, enabledModules: updatedModulesStr };
      setCompanies(companies.map(c => c.id === companyId ? updatedCompany : c));
      if (selectedCompanyModules && selectedCompanyModules.id === companyId) {
        setSelectedCompanyModules(updatedCompany);
      }
      toast.success(`${moduleKey} module updated for ${company.name}`);
    } catch (error) {
      toast.error('Failed to update module access');
    }
  };

  const handleToggleStatus = async (company) => {
    const nextActive = !company.isActive;
    if (!nextActive && !window.confirm(`Suspend "${company.name}"? Its users will not be able to log in until reactivated.`)) {
      return;
    }

    try {
      const response = await api.put(`/SuperAdmin/companies/${company.id}/status`, {
        isActive: nextActive
      });
      setCompanies(companies.map(c => c.id === company.id ? { ...c, isActive: nextActive } : c));
      toast.success(response.data?.message || `${company.name} ${nextActive ? 'activated' : 'suspended'}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update account status');
    }
  };

  const handleRenewSubscription = async (e) => {
    e.preventDefault();
    if (!renewCompany || renewMonths <= 0) return;

    setIsRenewing(true);
    try {
      const response = await api.post(`/SuperAdmin/companies/${renewCompany.id}/renew`, { months: renewMonths });
      const updated = response.data;

      setCompanies(companies.map(c => c.id === renewCompany.id ? {
        ...c,
        accountType: updated.accountType,
        isTrial: updated.isTrial,
        subscriptionExpiry: updated.subscriptionExpiry,
        isActive: updated.isActive
      } : c));

      toast.success(updated.message || 'Subscription renewed successfully!');
      setRenewCompany(null);
      setRenewMonths(1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to renew subscription.');
    } finally {
      setIsRenewing(false);
    }
  };

  if (selectedCompanyModules) {
    const rawModules = selectedCompanyModules.enabledModules !== undefined && selectedCompanyModules.enabledModules !== null
      ? selectedCompanyModules.enabledModules
      : 'STS';

    const enabledList = rawModules.split(',').map(m => m.trim()).filter(Boolean);

    const availableModules = [
      { key: 'STS', name: 'STS (Sales Tracking System)', icon: BarChart3 },
      { key: 'GPS', name: 'GPS Tracking', icon: Navigation },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header - Matching Reference Screenshot 2 */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black">Manage Modules: <span className="text-cyan-300">{selectedCompanyModules.name}</span></h2>
              <p className="text-indigo-200 text-sm font-medium">Enable or disable module access for this property workspace</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-inner">
            <Sliders className="w-4 h-4 text-cyan-300" />
            Module Control
          </div>
        </div>

        {/* Grid of Module Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-3xl gap-5">
          {availableModules.map((module) => {
            const isActive = enabledList.includes(module.key);
            const IconComponent = module.icon;
            return (
              <div 
                key={module.key} 
                className="bg-white rounded-2xl border border-blue-100/80 shadow-sm p-6 flex flex-col items-center justify-between text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-900/20 group-hover:scale-110 transition-transform">
                  <IconComponent className="w-7 h-7" />
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm mb-4 min-h-[2rem] flex items-center justify-center">
                  {module.name}
                </h3>

                {/* Toggle Switch */}
                <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggleModule(selectedCompanyModules.id, module.key)}
                    className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <span className={`px-3 py-0.5 rounded-full text-xs font-black tracking-wide ${
                    isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back Button */}
        <div className="pt-4">
          <button
            onClick={() => setSelectedCompanyModules(null)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 shadow-md transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Properties Management</h2>
          <p className="text-slate-400 font-medium text-sm">Manage workspaces, subscriptions, and quotas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" />
          Add New Property
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Property Information</th>
                <th className="px-6 py-4">Owner Contact</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-center">Account Type</th>
                <th className="px-6 py-4 text-center">Staff Limit</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">Loading tenants...</td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">No tenants found. Add one to get started.</td>
                </tr>
              ) : (
                companies.map((company) => {
                  const isTrial = company.accountType === 'Trial' || company.isTrial;
                  const daysLeft = isTrial
                    ? Math.max(0, Math.ceil((new Date(company.subscriptionExpiry || company.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
                    : null;

                  return (
                    <tr key={company.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center border border-indigo-200">
                            <span className="text-lg font-black text-indigo-600 uppercase">
                              {company.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-base">{company.name}</p>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">{company.industry || 'Property Workspace'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-700">{company.ownerEmail}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {company.ownerContact}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {company.city}
                        </div>
                      </td>
                      
                      {/* Account Type Column */}
                      <td className="px-6 py-4 text-center">
                        {isTrial ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border shadow-sm ${
                              daysLeft > 0 
                                ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              TRIAL
                            </span>
                            <span className={`text-[11px] font-bold mt-1 ${daysLeft > 0 ? 'text-amber-700' : 'text-rose-600 font-black'}`}>
                              {daysLeft > 0 ? `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}` : 'Expired'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            PERMANENT
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-sm font-bold text-slate-600">
                          {company.staffLimit}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(company)}
                            title={company.isActive ? 'Click to suspend this account' : 'Click to activate this account'}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              company.isActive ? 'bg-emerald-500' : 'bg-rose-400'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                company.isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            company.isActive
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}>
                            {company.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        { company.accountType === 'Trial' || company.isTrial?
                       <button
                          onClick={() => { setRenewCompany(company); setRenewMonths(1); }}
                          title="Renew Subscription"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                          Renew Subscription
                        </button>: ""}
                        <button
                          onClick={() => setSelectedCompanyModules(company)}
                          title="Manage Modules"
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <Settings className="w-3.5 h-3.5 text-indigo-600" />
                          Manage Modules
                        </button>
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in-up my-8 relative">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Provision New Tenant Workspace</h3>
                  <p className="text-sm text-slate-500 font-medium">Enter comprehensive property and admin details.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-200/50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                  ✕
                </button>
              </div>
            
            <form onSubmit={handleSubmit} className="p-8">
              
              {/* Account Type Selection */}
              <div className="mb-8 p-5 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-2xl border border-indigo-100/80">
                <label className="block text-xs font-black uppercase tracking-wider text-indigo-900 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> Select Property Account Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, accountType: 'Permanent' })}
                    className={`p-4 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                      formData.accountType === 'Permanent'
                        ? 'border-emerald-600 bg-white shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm mt-0.5 flex-shrink-0 ${
                      formData.accountType === 'Permanent' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      ✓
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">Permanent Account</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Full paid subscription (1 Year auto-renew)</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, accountType: 'Trial' })}
                    className={`p-4 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                      formData.accountType === 'Trial'
                        ? 'border-purple-600 bg-white shadow-md ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm mt-0.5 flex-shrink-0 ${
                      formData.accountType === 'Trial' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      🎁
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">Trial Account (7-Day)</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Free 7-day trial with countdown warning</p>
                    </div>
                  </button>

                </div>
              </div>

              {/* Section 1: Basic & Location Info */}
              <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">1. Organization Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Company / Property Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({...formData, industry: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="e.g. Real Estate"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Owner Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({...formData, ownerEmail: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="owner@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Owner Contact *</label>
                  <input
                    type="text"
                    required
                    value={formData.ownerContact}
                    onChange={(e) => setFormData({...formData, ownerContact: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              {/* Section 2: Address & Location */}
              <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">2. Address & Location</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Section 3: Admin User Credentials */}
              <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 border-b border-indigo-100 pb-2">3. Primary Admin User Account</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Company Admin Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="admin@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Admin Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30 transition-all"
                >
                  Provision Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>,
      document.body
      )}

      {/* Renew Subscription Modal */}
      {renewCompany && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-fade-in-up relative">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Renew Subscription</h3>
                    <p className="text-xs text-slate-500 font-medium">{renewCompany.name}</p>
                  </div>
                </div>
                <button onClick={() => setRenewCompany(null)} className="text-slate-400 hover:text-slate-600 bg-slate-200/50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                  ✕
                </button>
              </div>

              <form onSubmit={handleRenewSubscription} className="p-6">
                <p className="text-sm text-slate-500 font-medium mb-4">
                  Current expiry: <span className="font-bold text-slate-700">
                    {renewCompany.subscriptionExpiry ? new Date(renewCompany.subscriptionExpiry).toLocaleDateString() : 'N/A'}
                  </span>
                </p>

                <label className="block text-sm font-bold text-slate-700 mb-2">Number of Months *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium text-slate-800 mb-4"
                />

                <div className="flex gap-2 mb-6">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRenewMonths(m)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${
                        renewMonths === m
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m}mo
                    </button>
                  ))}
                </div>

                {(renewCompany.accountType === 'Trial' || renewCompany.isTrial) && (
                  <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-6">
                    This will convert the trial into a Permanent paid account.
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRenewCompany(null)}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenewing}
                    className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
                  >
                    {isRenewing ? 'Renewing...' : 'Confirm Renewal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ManageCompanies;
