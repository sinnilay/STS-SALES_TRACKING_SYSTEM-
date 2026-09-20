import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import { employeeService } from '../../../services/employeeService';
import { profileService } from '../../../services/profileService';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/Button';
import { STS_STATUS_OPTIONS, PRIORITY_OPTIONS, isConverted, getStatusDisplay } from '../../../constants/stsPipeline';

const FIELD_LABEL = "block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";
const FIELD_INPUT = "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors";

const ADMIN_ACTOR = 'admin';

// An update is logged as the call happens, so the Call/Meeting date can only be
// today or one of the two days before it — no older backdating, no future dates.
const CALL_DATE_BACKDATE_DAYS = 2;

const toDateInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const initialForm = {
  priority: '',
  callMeetingDate: '',
  status: '',
  nextCallMeetingDate: '',
  ccTo: '',
  subject: '',
  comment: '',
  otherStatusText: '',
  convertedFor: '',
  convertedPrice: '',
  actingAs: ADMIN_ACTOR,
};

// Logs a new STS update for a record — Priority, Call/Meeting Date, Status,
// Next Call/Meeting Date, CC To, Subject and Comments — mirroring the STS
// report's update form. Every submission is saved as its own history entry;
// there's no forward-only pipeline, any status code can be picked any time.
// `isAdmin` gates the extra "log this as / on behalf of an employee" control.
const StatusPipelineModal = ({ salesRecord, onClose, onSuccess, onUpdateStatus, isAdmin }) => {
  const { user } = useAuth();
  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : user?.role === 'Admin';

  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    if (!effectiveIsAdmin) return;
    employeeService.getAllEmployees()
      .then((data) => setEmployees(data || []))
      .catch(() => setEmployees([]));
  }, [effectiveIsAdmin]);

  useEffect(() => {
    profileService.getMyProfile()
      .then(setMyProfile)
      .catch(() => setMyProfile(null));
  }, []);

  // System-generated Subject according to login role and status:
  // - Field Sales: "Field sales Sales : <Name> [ <Company> <STS ID> <City> ] Status: <Code> (<Label>)"
  // - Tele Sales: "Telesales: <Name> [ <Company> <STS ID> <City> ] Status: <Code> (<Label>)"
  // - Admin: "Admin: <Name> [ <Company> <STS ID> <City> ] Status: <Code> (<Label>)"
  useEffect(() => {
    let prefix = '';

    if (effectiveIsAdmin) {
      if (form.actingAs === ADMIN_ACTOR) {
        const adminName = myProfile?.fullName?.split(' ')[0] || user?.fullName?.split(' ')[0] || 'Admin';
        prefix = `Admin: ${adminName}`;
      } else {
        const actingEmployee = employees.find((e) => String(e.id) === String(form.actingAs));
        const empName = actingEmployee?.fullName?.split(' ')[0] || 'Employee';
        const role = actingEmployee?.employeeRole || actingEmployee?.designation || '';
        if (role === 'Field Sales') {
          prefix = `Field sales Sales : ${empName}`;
        } else if (role === 'Tele Sales') {
          prefix = `Telesales: ${empName}`;
        } else {
          prefix = `${role || 'Employee'}: ${empName}`;
        }
      }
    } else {
      const myName = myProfile?.fullName?.split(' ')[0] || user?.fullName?.split(' ')[0] || 'Employee';
      const role = myProfile?.employeeRole || myProfile?.designation || '';
      if (role === 'Field Sales') {
        prefix = `Field sales Sales : ${myName}`;
      } else if (role === 'Tele Sales') {
        prefix = `Telesales: ${myName}`;
      } else if (myProfile?.role === 'Admin' || user?.role === 'Admin') {
        prefix = `Admin: ${myName}`;
      } else {
        prefix = `${role || 'Sales'}: ${myName}`;
      }
    }

    const city = salesRecord?.cityDistrict || salesRecord?.city || '';
    const companyBlock = `[ ${salesRecord?.companyName || ''} ${salesRecord?.companyID || ''}${city ? ` ${city}` : ''} ]`;
    const statusText = getStatusDisplay(form.status, form.otherStatusText);
    const statusSuffix = statusText ? ` Status: ${statusText}` : '';

    const autoSubject = `${prefix} ${companyBlock}${statusSuffix}`;

    setForm((f) => (f.subject === autoSubject ? f : { ...f, subject: autoSubject }));
  }, [effectiveIsAdmin, form.actingAs, form.status, form.otherStatusText, employees, myProfile, user, salesRecord]);


  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Recomputed per render so a modal left open overnight still offers the right window.
  const today = new Date();
  const callDateMax = toDateInputValue(today);
  const callDateMin = toDateInputValue(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - CALL_DATE_BACKDATE_DAYS)
  );

  const statusIsConverted = isConverted(form.status);
  const statusIsOther = form.status === 'OTHER';

  const validate = () => {
    const next = {};
    if (!form.priority) next.priority = 'Required';
    if (!form.callMeetingDate) next.callMeetingDate = 'Required';
    else if (form.callMeetingDate < callDateMin || form.callMeetingDate > callDateMax) {
      next.callMeetingDate = `Pick today or the last ${CALL_DATE_BACKDATE_DAYS} days`;
    }
    if (!form.status) next.status = 'Required';
    if (!form.subject.trim()) next.subject = 'Required';
    if (!form.comment.trim()) next.comment = 'Required';
    if (statusIsOther && !form.otherStatusText.trim()) next.otherStatusText = 'Required';
    if (statusIsConverted) {
      if (!form.convertedFor.trim()) next.convertedFor = 'Required';
      if (form.convertedPrice === '' || Number(form.convertedPrice) < 0) next.convertedPrice = 'Required';
    }
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
      otherStatusText: statusIsOther ? form.otherStatusText.trim() : null,
      convertedFor: statusIsConverted ? form.convertedFor.trim() : null,
      convertedPrice: statusIsConverted ? Number(form.convertedPrice) : null,
    };

    if (effectiveIsAdmin) {
      payload.updatedAsAdmin = form.actingAs === ADMIN_ACTOR;
      payload.employeeId = form.actingAs === ADMIN_ACTOR ? null : Number(form.actingAs);
    }

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
          <input
            type="date"
            min={callDateMin}
            max={callDateMax}
            value={form.callMeetingDate}
            onChange={setField('callMeetingDate')}
            className={FIELD_INPUT}
          />
          {errors.callMeetingDate && <p className="mt-1 text-xs text-red-600">{errors.callMeetingDate}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Status <span className="text-red-500">*</span></label>
          <select value={form.status} onChange={setField('status')} className={FIELD_INPUT}>
            <option value="">Select Status</option>
            {STS_STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.id === 'OTHER' ? s.label : `${s.id} (${s.label})`}</option>
            ))}
          </select>
          {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status}</p>}
        </div>

        {statusIsOther && (
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Custom Status <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Describe the status"
              value={form.otherStatusText}
              onChange={setField('otherStatusText')}
              className={FIELD_INPUT}
            />
            {errors.otherStatusText && <p className="mt-1 text-xs text-red-600">{errors.otherStatusText}</p>}
          </div>
        )}

        {statusIsConverted && (
          <>
            <div>
              <label className={FIELD_LABEL}>Converted For <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="What was it converted for?"
                value={form.convertedFor}
                onChange={setField('convertedFor')}
                className={FIELD_INPUT}
              />
              {errors.convertedFor && <p className="mt-1 text-xs text-red-600">{errors.convertedFor}</p>}
            </div>
            <div>
              <label className={FIELD_LABEL}>Price <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.convertedPrice}
                onChange={setField('convertedPrice')}
                className={FIELD_INPUT}
              />
              {errors.convertedPrice && <p className="mt-1 text-xs text-red-600">{errors.convertedPrice}</p>}
            </div>
          </>
        )}

        {effectiveIsAdmin && (
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Log This Update As</label>
            <select value={form.actingAs} onChange={setField('actingAs')} className={FIELD_INPUT}>
              <option value={ADMIN_ACTOR}>Myself (Admin)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={FIELD_LABEL}>Next Call / Meeting Date</label>
          <input type="date" value={form.nextCallMeetingDate} onChange={setField('nextCallMeetingDate')} className={FIELD_INPUT} />
        </div>

        <div>
          <label className={FIELD_LABEL}>CC To</label>
          <input
            type="text"
            placeholder="email@example.com, another@example.com"
            title="The company Admin is always notified — add emails here to also CC them, separated by commas"
            value={form.ccTo}
            onChange={setField('ccTo')}
            className={FIELD_INPUT}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL}>Subject <span className="text-red-500">*</span></label>
          <input
            type="text"
            readOnly
            value={form.subject}
            title="Auto-generated from who this update is logged as and the company — not editable"
            className={`${FIELD_INPUT} cursor-not-allowed bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400`}
          />
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
