import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, Mail, Globe, User, Clock, CheckCircle2, UserCircle2, ArrowRight, MessageSquare, Loader2, CalendarClock, Flag, Mail as MailIcon, FileText, Printer, Tag, UserCog } from 'lucide-react';
import { getStatusMeta } from '../../../constants/stsPipeline';

const StsDetailsDrawer = ({ isOpen, onClose, salesRecord, highlightTransition, fetchHistory }) => {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  useEffect(() => {
    if (!salesRecord?.id || !fetchHistory) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchHistory(salesRecord.id)
      .then((data) => { if (!cancelled) setHistory(data || []); })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load STS update history', error);
        setHistory([]);
        setHistoryError(error?.response?.status === 404
          ? 'History is unavailable — the backend may need to be restarted to pick up this feature.'
          : 'Failed to load update history.');
      })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [salesRecord?.id, fetchHistory, historyReloadKey]);

  if (!isOpen && !salesRecord) return null;

  const currentStatus = salesRecord ? getStatusMeta(salesRecord.status) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto border-l border-slate-200 dark:border-slate-800`}
      >
        {!salesRecord ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Loading details...</span>
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {salesRecord.companyID}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${currentStatus.badge}`} title={currentStatus.label}>
                {salesRecord.status || 'New'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {salesRecord.companyName}
            </h2>
            <div className="flex items-center text-sm text-slate-500 mt-1">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Created {new Date(salesRecord.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">

          {/* Current Status */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-500" />
              Current Status
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentStatus.dot}`} />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{salesRecord.status || 'New'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{currentStatus.label}</div>
                </div>
              </div>
              {salesRecord.nextActionDate && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Next: {new Date(salesRecord.nextActionDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </section>

          {/* Update History — every status change, and the comment given for it */}
          {fetchHistory && (
            <section>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary-500" />
                Update History
              </h3>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : historyError ? (
                <div className="flex items-start justify-between gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{historyError}</p>
                  <button
                    onClick={() => setHistoryReloadKey((k) => k + 1)}
                    className="text-xs font-bold text-red-700 dark:text-red-300 underline shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No status updates recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...history].reverse().map((entry) => {
                    const entryStatus = getStatusMeta(entry.newStatus);
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl p-4 border transition-colors ${
                          highlightTransition?.id === entry.id
                            ? 'bg-primary-50/70 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800/60 ring-1 ring-primary-200 dark:ring-primary-800/40'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${entryStatus.badge}`} title={entryStatus.label}>
                            {entry.newStatus}
                          </span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {entry.subject && (
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2">{entry.subject}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            By <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.employee?.fullName || entry.employee?.email || 'Unknown'}</span>
                          </span>
                          {entry.priority && (
                            <span className="flex items-center gap-1"><Flag className="w-3 h-3" /> {entry.priority}</span>
                          )}
                          {entry.callMeetingDate && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(entry.callMeetingDate).toLocaleDateString()}</span>
                          )}
                          {entry.nextCallMeetingDate && (
                            <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Next: {new Date(entry.nextCallMeetingDate).toLocaleDateString()}</span>
                          )}
                          {entry.ccTo && (
                            <span className="flex items-center gap-1"><MailIcon className="w-3 h-3" /> {entry.ccTo}</span>
                          )}
                        </div>

                        {entry.comment && (
                          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
                            "{entry.comment}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Company Details — every field captured for this lead, grouped for scannability */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-500" />
              Company Details
            </h3>

            <div className="space-y-5">
              {/* Lead meta — priority / source / lead by, as quick-scan chips */}
              <div className="flex flex-wrap items-center gap-2">
                {salesRecord.priority && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                    <Flag className="w-3 h-3" /> {salesRecord.priority} Priority
                  </span>
                )}
                {salesRecord.source && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                    <Tag className="w-3 h-3" /> {salesRecord.source}
                  </span>
                )}
                {salesRecord.leadBy && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">
                    <UserCog className="w-3 h-3" /> Lead by {salesRecord.leadBy}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailCard icon={User} label="Contact Person" value={salesRecord.contactPerson} subValue={salesRecord.designation} />
                <DetailCard icon={UserCog} label="Owner Name" value={salesRecord.ownerName} />
                <DetailCard icon={Phone} label="Phone Numbers" value={salesRecord.mobile1 || salesRecord.phoneNumber} subValue={salesRecord.mobile2} />
                <DetailCard icon={Printer} label="Fax" value={salesRecord.fax} />
                <DetailCard icon={Mail} label="Email Address" value={salesRecord.email} />
                <DetailCard icon={Globe} label="Website" value={salesRecord.website} />
                <div className="sm:col-span-2">
                  <DetailCard
                    icon={MapPin}
                    label="Address"
                    value={[salesRecord.address1, salesRecord.address2].filter(Boolean).join(', ')}
                    subValue={[salesRecord.cityDistrict, salesRecord.state, salesRecord.pincode, salesRecord.country].filter(Boolean).join(', ')}
                  />
                </div>
                <div className="sm:col-span-2">
                  <DetailCard icon={FileText} label="Business Description" value={salesRecord.businessDescription} wrap />
                </div>
                <div className="sm:col-span-2">
                  <DetailCard icon={MessageSquare} label="Opening Comments" value={salesRecord.openingComments} wrap />
                </div>
              </div>
            </div>
          </section>

          {/* Allocation & Ownership */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCircle2 className="w-4 h-4 text-primary-500" />
              Team & Allocation
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 space-y-4">

              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Created By</div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {salesRecord.employee?.fullName || 'System'}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Allocated To</div>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 justify-end">
                    {salesRecord.allocatedTo?.fullName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Telecaller Exec</div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {salesRecord.teleExecutive?.fullName || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Marketing Exec</div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {salesRecord.marketingExecutive?.fullName || '-'}
                  </div>
                </div>
              </div>

              {salesRecord.allocatorComment && (
                <div className="pt-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Allocation Comment</div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
                    "{salesRecord.allocatorComment}"
                  </div>
                </div>
              )}

            </div>
          </section>

        </div>
        </>
        )}
      </div>
    </>
  );
};

const DetailCard = ({ icon: Icon, label, value, subValue, wrap }) => (
  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex items-start gap-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm shrink-0">
      <Icon className="w-4 h-4 text-primary-500" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-slate-900 dark:text-white ${wrap ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
        {value || <span className="text-slate-400 font-normal italic">Not provided</span>}
      </p>
      {subValue && (
        <p className="text-xs text-slate-500 truncate mt-0.5">{subValue}</p>
      )}
    </div>
  </div>
);

export default StsDetailsDrawer;
