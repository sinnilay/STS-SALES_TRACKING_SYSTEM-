import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, User, Building2, MapPin, Tag, Calendar, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import Button from '../../../components/Button';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import StsDetailsDrawer from './StsDetailsDrawer';
import { getStatusMeta } from '../../../constants/stsPipeline';

const TABS = ['Pending', 'Approved', 'Rejected', 'All'];

const EmployeeStsRequests = () => {
  const [activeTab, setActiveTab] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStsDetails, setSelectedStsDetails] = useState(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await stsService.getStsRequests(activeTab);
      setRequests(data);
    } catch (error) {
      toast.error('Failed to load STS requests');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openStsDetails = async (salesDataId) => {
    if (!salesDataId) return;
    setIsDrawerOpen(true);
    setSelectedStsDetails(null);
    try {
      const details = await stsService.getSalesDataById(salesDataId);
      setSelectedStsDetails(details);
    } catch (error) {
      toast.error('Failed to load STS details');
      setIsDrawerOpen(false);
    }
  };

  const handleApprove = async (request) => {
    setActioningId(request.id);
    try {
      await stsService.approveStsRequest(request.id);
      toast.success(`Allocated "${request.salesData?.companyName}" to ${request.requestedBy?.fullName}`);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve request');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async () => {
    if (!requestToReject) return;
    setActioningId(requestToReject.id);
    try {
      await stsService.rejectStsRequest(requestToReject.id, rejectComment || undefined);
      toast.success('Request rejected');
      setRequestToReject(null);
      setRejectComment('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject request');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary-500" /> STS Request
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Employees who found a duplicate while adding an STS and asked to be allotted it instead.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 p-6 sm:p-12 text-center text-sm text-gray-400">
          No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} requests.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const statusMeta = getStatusMeta(r.salesData?.status);
            const isActioning = actioningId === r.id;
            return (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* STS Record */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                      <p className="font-bold text-gray-900 dark:text-white truncate">{r.salesData?.companyName || 'Unknown record'}</p>
                      <span className="text-xs font-mono text-gray-400 dark:text-slate-500 shrink-0">{r.salesData?.companyID}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${statusMeta.badge}`}>
                        {r.salesData?.status || 'New'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mb-3">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {r.salesData?.cityDistrict || '—'}</span>
                      <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-gray-400" /> {r.salesData?.source || '—'}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {r.salesData?.createdAt ? new Date(r.salesData.createdAt).toLocaleDateString() : '—'}</span>
                      {r.salesData?.allocatedTo && (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <User className="w-3.5 h-3.5" /> Currently allotted to {r.salesData.allocatedTo.fullName}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openStsDetails(r.salesData?.id)}
                      className="w-full text-left inline-flex items-center gap-3 p-2.5 pr-4 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/40 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {(r.requestedBy?.fullName || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          Requested by {r.requestedBy?.fullName || 'Unknown'}
                          <span className="ml-1.5 text-xs font-normal text-primary-600 dark:text-primary-400">(view STS details)</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {r.requestedBy?.email} • {r.requestedBy?.employeeRole || '—'} • {r.requestedBy?.employeeDept || '—'}
                        </p>
                      </div>
                    </button>

                    {r.comment && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/40 rounded-lg px-3 py-2 border border-gray-100 dark:border-slate-700">
                        "{r.comment}"
                      </p>
                    )}

                    {r.status !== 'Pending' && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                        {r.status} by {r.reviewedBy?.fullName || 'Founder'} on {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : '—'}
                        {r.reviewComment && <> — "{r.reviewComment}"</>}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {r.status === 'Pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        onClick={() => handleApprove(r)}
                        isLoading={isActioning}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="w-4 h-4 mr-1.5" /> Approve
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { setRequestToReject(r); setRejectComment(''); }}
                        disabled={isActioning}
                      >
                        <X className="w-4 h-4 mr-1.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StsDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        salesRecord={selectedStsDetails}
        fetchHistory={stsService.getSalesHistory}
      />

      <Modal
        isOpen={!!requestToReject}
        onClose={() => !actioningId && setRequestToReject(null)}
        title="Reject STS Request"
        maxWidthClass="max-w-md"
      >
        {requestToReject && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Reject {requestToReject.requestedBy?.fullName}'s request for <strong>{requestToReject.salesData?.companyName}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Reason (optional)</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-1 focus:ring-primary-500"
                placeholder="Let the employee know why..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setRequestToReject(null)} disabled={!!actioningId}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReject}
                isLoading={actioningId === requestToReject.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeStsRequests;
