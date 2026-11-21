import React from 'react';
import { Eye, PencilLine, MapPin, Building2, MessageSquare, Camera, Video } from 'lucide-react';
import { getStatusMeta, isNotInterested } from '../../constants/stsPipeline';

export const getEffectiveDate = (record) => new Date(record.lastActionDate || record.createdAt);

export const getMeetingDate = (record) => (record.meetingScheduledAt ? new Date(record.meetingScheduledAt) : null);

export const getNextCallDate = (record) => (record.nextActionDate ? new Date(record.nextActionDate) : null);

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const relativeDayLabel = (date) => {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// Compact "meeting tile" — deliberately small and square-ish so many fit inside the
// scrollable meeting board, instead of a table row.
const MeetingCard = ({ record, onView, onUpdateStatus, onViewImages, tag }) => {
  const statusMeta = getStatusMeta(record.status);
  const meta = { bar: statusMeta.solid, badge: statusMeta.badge, iconBg: statusMeta.badge };
  const meetingDate = getMeetingDate(record);

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      <div className={`h-1 w-full shrink-0 ${meta.bar}`} />
      <div className="p-3 flex flex-col gap-1.5 flex-1 min-h-0">
        <div className="flex items-center justify-between gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full truncate ${meta.badge}`}>
            {record.status || 'New'}
          </span>
          {tag && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {tag}
            </span>
          )}
        </div>

        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBg}`}>
          <Building2 className="w-3.5 h-3.5" />
        </div>

        <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
          {record.companyName}
        </p>
        <p className="text-[10px] font-mono text-gray-400 dark:text-slate-500 truncate">{record.companyID}</p>
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400 truncate">
          <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{record.cityDistrict || '—'}</span>
        </div>
        {record.meetingMode && (
          <span className={`inline-flex w-fit items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
            record.meetingMode === 'Online'
              ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
              : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
          }`}>
            <Video className="w-2.5 h-2.5" /> {record.meetingMode}
          </span>
        )}

        {isNotInterested(record.status) && record.allocatorComment && (
          <div className={`mt-1 flex items-start gap-1 px-1.5 py-1 rounded-md text-[10px] leading-snug line-clamp-2 ${meta.badge}`}>
            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="italic">{record.allocatorComment}</span>
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-gray-50 dark:border-slate-800 flex items-center justify-end gap-0.5">
          {onViewImages && (
            <button
              onClick={onViewImages}
              className="p-1 rounded-md text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Site Images"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onView}
            className="p-1 rounded-md text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onUpdateStatus && (
          <button
            onClick={onUpdateStatus}
            className="p-1 rounded-md text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            title="Update Status"
          >
            <PencilLine className="w-3.5 h-3.5" />
          </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingCard;
