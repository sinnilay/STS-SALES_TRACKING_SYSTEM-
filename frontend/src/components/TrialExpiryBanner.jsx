import React, { useState, useEffect } from 'react';
import { Gift, Clock, AlertTriangle, ShieldAlert, Sparkles, CheckCircle2, ArrowRight, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const TrialExpiryBanner = () => {
  const { user } = useAuth();
  const [companyInfo, setCompanyInfo] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const endpoint = user?.role === 'Sales' ? '/Employee/my-company' : '/Admin/my-company';
        const response = await api.get(endpoint);
        if (response.data) {
          setCompanyInfo(response.data);
          
          // Check if popup was already dismissed in this session
          const dismissed = sessionStorage.getItem('trial_popup_dismissed');
          if (!dismissed && response.data.isTrial) {
            setShowPopup(true);
          }
        }
      } catch (e) {
        // Non-admin or fetch fail
      }
    };

    fetchCompanyInfo();
  }, []);

  const isTrialMode = companyInfo?.accountType === 'Trial' || companyInfo?.isTrial;

  if (!companyInfo || !isTrialMode) {
    return null; // Not in a trial mode
  }

  const now = new Date();
  const expiryDate = companyInfo.subscriptionExpiry || companyInfo.trialEndDate;
  const expiry = expiryDate ? new Date(expiryDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const diffTime = expiry.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const isExpired = daysLeft <= 0;

  const handleDismissPopup = () => {
    setShowPopup(false);
    sessionStorage.setItem('trial_popup_dismissed', 'true');
  };

  return (
    <>
      {/* Executive Top Banner */}
      <div className={`w-full text-white px-6 py-3 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 relative z-30 transition-all ${
        isExpired 
          ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 border-b border-red-500' 
          : daysLeft <= 2
          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-b border-amber-500'
          : 'bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 border-b border-indigo-500'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
            {isExpired ? (
              <ShieldAlert className="w-5 h-5 text-red-200 animate-bounce" />
            ) : (
              <Gift className="w-5 h-5 text-amber-300 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 border border-white/20">
                {isExpired ? 'Trial Expired' : '7-Day Free Trial'}
              </span>
              {!isExpired && (
                <span className="text-xs font-bold text-amber-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {daysLeft} {daysLeft === 1 ? 'Day' : 'Days'} Left
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white/95 mt-0.5">
              {isExpired
                ? 'Your 7-day free trial has expired. Contact Super Admin to upgrade your workspace.'
                : `You are currently experiencing the 7-day trial for ${companyInfo.name || 'your property'}. ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} remaining before expiration.`}
            </p>
          </div>
        </div>

        {/* Progress & Action */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          {!isExpired && (
            <div className="hidden md:flex flex-col items-end min-w-[120px]">
              <div className="text-[10px] font-black uppercase text-indigo-100 mb-1">Trial Validity</div>
              <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, (daysLeft / 7) * 100))}%` }}
                ></div>
              </div>
            </div>
          )}

          <button
            onClick={() => toast.success('Please contact Super Admin at superadmin@sts.com to extend subscription.')}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {isExpired ? 'Upgrade Subscription' : 'Upgrade Plan'}
          </button>
        </div>
      </div>

      {/* Login Welcome / Expiry Popup Dialog */}
      {showPopup && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
            
            {/* Background glow */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <button
              onClick={handleDismissPopup}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 flex items-center justify-center text-white mx-auto mb-5 shadow-xl shadow-indigo-500/30 border border-white/20">
              <Gift className="w-8 h-8 text-amber-300 animate-bounce" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 text-xs font-black uppercase tracking-wider mb-2 border border-indigo-200 dark:border-indigo-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Free Trial Active
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              {daysLeft} {daysLeft === 1 ? 'Day' : 'Days'} Remaining!
            </h3>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Welcome to <span className="font-bold text-indigo-600 dark:text-indigo-400">{companyInfo.name}</span>. Your 7-day free trial is currently active. You have <span className="font-black text-slate-900 dark:text-white">{daysLeft} days left</span> to experience all premium features.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Full Access to STS Modules
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Staff Quota: {companyInfo.staffLimit || 10} Users
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unified Analytics & Reports
              </div>
            </div>

            <button
              onClick={handleDismissPopup}
              className="w-full py-3.5 rounded-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-purple-700 transition-all text-sm flex items-center justify-center gap-2"
            >
              Continue to Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TrialExpiryBanner;
