import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Video, MapPin } from 'lucide-react';
import { employeeStsService } from '../../services/employeeStsService';
import Button from '../../components/Button';

// Fixes a meeting (Online/Offline) for an STS record in one's own book — used by both
// Tele Sales and Field Sales from "My STS Records". Optionally chains into the existing
// StatusPipelineModal so the call/meeting outcome can be logged in the same flow.
const ScheduleMeetingModal = ({ salesRecord, onClose, onScheduled }) => {
  const [mode, setMode] = useState(salesRecord.meetingMode || 'Offline');
  const [updateStatusToo, setUpdateStatusToo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await employeeStsService.scheduleMeeting(salesRecord.id, mode);
      toast.success(salesRecord.meetingScheduledAt ? 'Meeting rescheduled to now' : 'Meeting fixed');
      onScheduled(updateStatusToo);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to fix the meeting');
    } finally {
      setIsSaving(false);
    }
  };

  const modeOptions = [
    { value: 'Online', label: 'Online', icon: Video },
    { value: 'Offline', label: 'Offline', icon: MapPin },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{salesRecord.companyName}</h3>
        <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-0.5">{salesRecord.companyID}</p>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Meeting Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                mode === opt.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={updateStatusToo}
          onChange={(e) => setUpdateStatusToo(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-700 dark:text-slate-300">
          Also update this STS's status now
          <span className="block text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Opens the status update form right after the meeting is fixed.
          </span>
        </span>
      </label>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button type="submit" isLoading={isSaving}>Fix the Meeting</Button>
      </div>
    </form>
  );
};

export default ScheduleMeetingModal;
