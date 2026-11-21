import React from 'react';
import { Headset } from 'lucide-react';

export const SUPPORT_PHONE = '+91-9450046460';

// Support contact card for the sidebars; the icon-only form is used when the sidebar is collapsed.
const SupportDesk = ({ compact = false }) => {
  const href = `tel:${SUPPORT_PHONE.replace(/-/g, '')}`;

  if (compact) {
    return (
      <a href={href} title={`Support Desk: ${SUPPORT_PHONE}`} aria-label={`Support Desk ${SUPPORT_PHONE}`}
        className="flex items-center justify-center p-2.5 mb-2 rounded-xl text-sky-400 hover:bg-sky-500/10 transition-colors">
        <Headset className="w-5 h-5" />
      </a>
    );
  }

  return (
    <a href={href}
      className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl bg-sky-500/10 dark:bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 transition-colors">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-sky-500/15 text-sky-500 dark:text-sky-400 flex items-center justify-center">
        <Headset className="w-5 h-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Support Desk</span>
        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-100 truncate">{SUPPORT_PHONE}</span>
      </span>
    </a>
  );
};

export default SupportDesk;
