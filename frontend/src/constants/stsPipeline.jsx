// Single source of truth for STS call-outcome status codes — the same codes the
// legacy STS report used. Selecting one logs an update (Priority, Call/Meeting
// Date, Status, Next Call/Meeting Date, CC To, Subject, Comments) against a
// record; there's no forward-only pipeline, any code can be picked at any time.
// Keep in sync with STS.Services.StsPipeline (backend).
export const STS_STATUS_OPTIONS = [
  { id: 'N_O', label: 'Company Profile Not Open', group: 'neutral' },
  { id: 'W_N', label: 'Wrong No.', group: 'negative' },
  { id: 'CPNA', label: 'Call Person Not Available', group: 'neutral' },
  { id: 'C_B', label: 'Call Back', group: 'neutral' },
  { id: 'C_C', label: 'Cold Call', group: 'neutral' },
  { id: 'APPMT', label: 'Appointment Fix', group: 'positive' },
  { id: 'DMUPIFC', label: 'Decision Making Unit Presentation In Fresh Call', group: 'positive' },
  { id: 'PGIFC', label: 'Prospect Generated in Fresh Call', group: 'positive' },
  { id: 'PGIFU', label: 'Prospect Generated in Follow Up', group: 'positive' },
  { id: 'DMUPIFU1', label: 'Decision Making Unit Presentation In Follow Up First Time', group: 'positive' },
  { id: 'DMUPIFU2', label: 'Decision Making Unit Presentation In Follow Up Second Time', group: 'positive' },
  { id: 'DMUPIFU3', label: 'Decision Making Unit Presentation In Follow Up Third Time', group: 'positive' },
  { id: 'SERV', label: 'Only Service Meeting', group: 'neutral' },
  { id: 'JUNK', label: 'All Information of Company are Wrong', group: 'negative' },
  { id: 'NI', label: 'Not Interested', group: 'negative' },
  { id: 'NI_PH', label: 'Not Interested over Phone', group: 'negative' },
  { id: 'NI_FC', label: 'Not Interested in First Meeting', group: 'negative' },
  { id: 'NI_FU', label: 'Not Interested in Follow Up', group: 'negative' },
  { id: 'CNVT', label: 'Converted', group: 'success' },
  { id: 'A_CNVT', label: 'Already Converted', group: 'success' },
  { id: 'CNVT_PH', label: 'Converted Over Phone', group: 'success' },
  { id: 'CNVT_FC', label: 'Converted in First Call', group: 'success' },
  { id: 'CNVT_FU', label: 'Converted in Follow-up', group: 'success' },
  { id: 'OTHER', label: 'Other', group: 'neutral' },
];

// Status codes that represent a conversion — picking one of these prompts for
// the extra "Converted For" / "Price" details on the update form.
export const CONVERTED_STATUS_IDS = ['CNVT', 'A_CNVT', 'CNVT_PH', 'CNVT_FC', 'CNVT_FU'];

// Records created before this change (or never updated yet) can still carry one
// of these older values as their Status — map them so they render sensibly
// instead of falling through to "unknown".
const LEGACY_STATUS_META = {
  New: { label: 'New', group: 'neutral' },
  Assigned: { label: 'Assigned', group: 'neutral' },
  Reviewed: { label: 'Reviewed', group: 'positive' },
  Contacted: { label: 'Contacted', group: 'positive' },
  'Follow-up': { label: 'Follow-up', group: 'positive' },
  Successful: { label: 'Successful', group: 'success' },
  Unsuccessful: { label: 'Unsuccessful', group: 'negative' },
};

export const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

export const GROUP_STYLES = {
  success: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    ring: 'ring-emerald-200 dark:ring-emerald-500/30',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-500',
  },
  negative: {
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
    ring: 'ring-red-200 dark:ring-red-500/30',
    dot: 'bg-red-500',
    solid: 'bg-red-500',
  },
  positive: {
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30',
    ring: 'ring-indigo-200 dark:ring-indigo-500/30',
    dot: 'bg-indigo-500',
    solid: 'bg-indigo-500',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30',
    ring: 'ring-slate-200 dark:ring-slate-500/30',
    dot: 'bg-slate-400',
    solid: 'bg-slate-400',
  },
};

const STATUS_LOOKUP = STS_STATUS_OPTIONS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, { ...LEGACY_STATUS_META });

// Returns { id, label, group, badge, ring, dot, solid } for any status code,
// old or new — always safe to call, even with an empty/unknown status.
export const getStatusMeta = (statusId) => {
  const entry = STATUS_LOOKUP[statusId] || { label: statusId || 'New', group: 'neutral' };
  return { id: statusId, ...entry, ...GROUP_STYLES[entry.group] };
};

export const isConverted = (statusId) => getStatusMeta(statusId).group === 'success';
export const isNotInterested = (statusId) => getStatusMeta(statusId).group === 'negative';

// Formats status as "CODE (Label)" e.g. "C_B (Call Back)", matching the required STS subject line format
export const getStatusDisplay = (statusId, otherStatusText) => {
  if (!statusId) return '';
  if (statusId === 'OTHER') {
    return otherStatusText ? `OTHER (${otherStatusText})` : 'OTHER';
  }
  const match = STS_STATUS_OPTIONS.find((s) => s.id === statusId);
  if (match) {
    return `${match.id} (${match.label})`;
  }
  const legacy = STATUS_LOOKUP[statusId];
  if (legacy && legacy.label) {
    return `${statusId} (${legacy.label})`;
  }
  return statusId;
};

