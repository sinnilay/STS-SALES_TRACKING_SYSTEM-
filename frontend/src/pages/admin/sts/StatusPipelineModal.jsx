import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import Button from '../../../components/Button';
import { STS_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../../constants/stsPipeline';

const FIELD_LABEL = "block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
const FIELD_INPUT = "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors";

const initialForm = {
  priority: '',
  callMeetingDate: '',
  status: '',
  nextCallMeetingDate: '',
  ccTo: '',
  subject: '',
  comment: '',
};

// Logs a new STS update for a record — Priority, Call/Meeting Date, Status,
// Next Call/Meeting Date, CC To, Subject and Comments — mirroring the STS
// report's update form. Every submission is saved as its own history entry;
// there's no forward-only pipeline, any status code can be picked any time.
const StatusPipelineModal = ({ salesRecord, onClose, onSuccess, onUpdateStatus }) => {
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.priority) next.priority = 'Required';
    if (!form.callMeetingDate) next.callMeetingDate = 'Required';
    if (!form.status) next.status = 'Required';
    if (!form.subject.trim()) next.subject = 'Required';
    if (!form.comment.trim()) next.comment = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      priority: form.priority,
      callMeetingDate: form.callMeetingDate,
      status: form.status,
      nextCallMeetingDate: form.nextCallMeetingDate || null,
      ccTo: form.ccTo.trim() || null,
      subject: form.subject.trim(),
      comment: form.comment.trim(),
    };

    setIsSaving(true);
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(salesRecord.id, payload);
      } else {
        await stsService.updateSalesStatus(salesRecord.id, payload);
      }
      toast.success('STS update saved');
      onSuccess();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save the update');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{salesRecord.companyName}</h3>
        <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-0.5">{salesRecord.companyID}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>Priority <span className="text-red-500">*</span></label>
          <select value={form.priority} onChange={setField('priority')} className={FIELD_INPUT}>
            <option value="">Select Priority</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {errors.priority && <p className="mt-1 text-xs text-red-600">{errors.priority}</p>}
        </div>

        <div>
          <label className={FIELD_LABEL}>Call / Meeting Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.callMeetingDate} onChange={setField('callMeetingDate')} className={FIELD_INPUT} />
          {errors.callMeetingDate && <p className="mt-1 text-xs text-red-600">{errors.callMeetingDate}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Status <span className="text-red-500">*</span></label>
          <select value={form.status} onChange={setField('status')} className={FIELD_INPUT}>
            <option value="">Select Status</option>
            {STS_STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.id} ({s.label})</option>
            ))}
          </select>
          {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
        </div>

        <div>
          <label className={FIELD_LABEL}>Next Call / Meeting Date</label>
          <input type="date" value={form.nextCallMeetingDate} onChange={setField('nextCallMeetingDate')} className={FIELD_INPUT} />
        </div>

        <div>
          <label className={FIELD_LABEL}>CC To</label>
          <input type="text" placeholder="email@example.com" value={form.ccTo} onChange={setField('ccTo')} className={FIELD_INPUT} />
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Subject <span className="text-red-500">*</span></label>
          <input type="text" placeholder="What was this update about?" value={form.subject} onChange={setField('subject')} className={FIELD_INPUT} />
          {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Comments <span className="text-red-500">*</span></label>
          <textarea
            rows="3"
            placeholder="What happened on the call/meeting?"
            value={form.comment}
            onChange={setField('comment')}
            className={FIELD_INPUT}
          />
          {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button type="submit" isLoading={isSaving}>Save Update</Button>
      </div>
    </form>
  );
};

export default StatusPipelineModal;
