import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle2, XCircle, Building2, User, Mail, Phone, MapPin, 
  Sparkles, ShieldCheck, Search, Filter, Loader2, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PendingTrialRequests = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/SuperAdmin/trial-requests');
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to load trial requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id, companyName) => {
    if (!window.confirm(`Are you sure you want to approve trial request for "${companyName}"? This will provision a 7-day free trial property workspace and admin account.`)) return;

    setProcessingId(id);
    try {
      const response = await api.post(`/SuperAdmin/trial-requests/${id}/approve`);
      toast.success(response.data.message || 'Trial request approved successfully!');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve trial request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (optional):', 'Requirements incomplete');
    if (reason === null) return;

    setProcessingId(id);
    try {
      await api.post(`/SuperAdmin/trial-requests/${id}/reject`, { reason });
      toast.success('Trial request rejected');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to reject trial request');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesTab = activeTab === 'All' || req.status === activeTab;
    const matchesSearch = 
      req.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const rejectedCount = requests.filter(r => r.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-indigo-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner">
            <Clock className="w-7 h-7 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-black uppercase tracking-wider border border-indigo-400/30">
                Super Admin HQ
              </span>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-400/30">
                  {pendingCount} Action Needed
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Pending Trial Requests</h2>
            <p className="text-indigo-200 text-sm font-medium">Review client submissions, verify details, and approve 7-day trial workspaces.</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 relative z-10 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
          <div className="px-4 py-2 text-center border-r border-white/10">
            <p className="text-xs text-slate-400 font-bold uppercase">Pending</p>
            <p className="text-xl font-black text-amber-400">{pendingCount}</p>
          </div>
          <div className="px-4 py-2 text-center border-r border-white/10">
            <p className="text-xs text-slate-400 font-bold uppercase">Approved</p>
            <p className="text-xl font-black text-emerald-400">{approvedCount}</p>
          </div>
          <div className="px-4 py-2 text-center">
            <p className="text-xs text-slate-400 font-bold uppercase">Rejected</p>
            <p className="text-xl font-black text-rose-400">{rejectedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['Pending', 'Approved', 'Rejected', 'All'].map((tab) => {
            const count = tab === 'Pending' ? pendingCount : tab === 'Approved' ? approvedCount : tab === 'Rejected' ? rejectedCount : requests.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === tab 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search request..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Property / Company</th>
                <th className="px-6 py-4">Owner & Contact</th>
                <th className="px-6 py-4">Location & Sector</th>
                <th className="px-6 py-4 text-center">Date Submitted</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading trial requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                    No trial requests found for "{activeTab}".
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Property */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center font-black text-indigo-600 uppercase">
                          {req.companyName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-base">{req.companyName}</p>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                            <Building2 className="w-3 h-3 text-indigo-500" /> Limit: {req.staffLimit} Staff
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {req.ownerName}
                      </p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" /> {req.ownerEmail}
                      </p>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {req.ownerContact}
                      </p>
                    </td>

                    {/* Location & Industry */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 flex items-center gap-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        {req.city}, {req.state} ({req.country})
                      </div>
                      <span className="text-xs text-slate-400 font-semibold block mt-1">
                        Sector: {req.industry || 'N/A'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-slate-600">
                        {new Date(req.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                        req.status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : req.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      }`}>
                        {req.status === 'Approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {req.status === 'Rejected' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                        {req.status === 'Pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {req.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {req.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req.id, req.companyName)}
                            disabled={processingId === req.id}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve (7-Day Trial)
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 italic">
                          Processed {req.processedAt ? new Date(req.processedAt).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default PendingTrialRequests;
