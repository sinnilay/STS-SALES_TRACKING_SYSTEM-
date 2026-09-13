import React from 'react';
import { ShieldAlert, Sparkles, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SubscriptionExpired = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950 p-6">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-rose-200/60 dark:border-rose-900/60 p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-12 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-rose-500/30 border border-white/20 relative">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-xs font-black uppercase tracking-wider mb-3 border border-rose-200 dark:border-rose-800">
          Access Denied
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Your Subscription Has Expired
        </h1>

        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {user?.companyName ? (
            <>The workspace <span className="font-bold text-slate-800 dark:text-slate-200">{user.companyName}</span> no longer has an active subscription.</>
          ) : (
            'Your workspace no longer has an active subscription.'
          )}{' '}
          Please contact your Super Admin to renew access. All modules are locked until then.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Mail className="w-4 h-4 text-rose-500" />
          superadmin@sts.com
        </div>

        <div className="flex gap-3">
          <button
            onClick={logout}
            className="w-full py-3.5 rounded-2xl font-black bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg shadow-rose-500/30 hover:from-rose-700 hover:to-red-800 transition-all text-sm flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        <p className="mt-6 text-[11px] font-semibold text-slate-400 dark:text-slate-600 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Renew anytime to instantly restore access.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionExpired;
