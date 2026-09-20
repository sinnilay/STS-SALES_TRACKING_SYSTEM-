import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Building2, User, MapPin, FileText } from 'lucide-react';
import { stsService } from '../../../services/stsService';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import { PRIORITY_OPTIONS } from '../../../constants/stsPipeline';

const SOURCE_OPTIONS = ['Yellow Page', 'Visiting Card', 'Online Directory', 'Referral', 'Website', 'Other'];

const Field = ({ label, error, required, children }) => (
  <div className="w-full">
    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error.message}</p>}
  </div>
);

const selectClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 transition-colors';

const Section = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
      <Icon className="w-4 h-4 text-primary-500" />
      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-slate-300">{title}</h4>
    </div>
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

// Phone-style fields accept exactly 10 digits, pincode exactly 6 — blank stays allowed
// on edit, since older records may not carry these values yet.
const digitsRule = (length, label) => ({
  pattern: {
    value: new RegExp(`^[0-9]{${length}}$`),
    message: `${label} must be exactly ${length} digits`,
  },
});

// Keeps typed and pasted non-digits out of the number-only fields.
const blockNonDigits = (e) => {
  if (e.data && /\D/.test(e.data)) e.preventDefault();
};

const buildDefaults = (r) => ({
  companyName: r.companyName || '',
  contactPerson: r.contactPerson || '',
  designation: r.designation || '',
  email: r.email || '',
  phoneNumber: r.phoneNumber || '',
  mobile1: r.mobile1 || '',
  mobile2: r.mobile2 || '',
  website: r.website || '',
  address1: r.address1 || '',
  address2: r.address2 || '',
  companyAddress: r.companyAddress || '',
  cityDistrict: r.cityDistrict || '',
  state: r.state || '',
  pincode: r.pincode || '',
  country: r.country || 'India',
  priority: r.priority || 'Highest',
  source: r.source || 'Yellow Page',
  leadBy: r.leadBy || '',
  businessDescription: r.businessDescription || '',
  openingComments: r.openingComments || '',
});

const EditStsForm = ({ record, onClose, onSuccess }) => {
  const [isSaving, setIsSaving] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: buildDefaults(record),
  });

  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      await stsService.updateSalesData(record.id, data);
      toast.success('STS record updated');
      onSuccess?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update STS record');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
          {record.companyID}
        </span>
        <span>Status: <span className="font-semibold text-primary-600 dark:text-primary-400">{record.status || 'New'}</span></span>
      </div>

      <Section icon={Building2} title="Company">
        <div className="sm:col-span-2">
          <Field label="STS / Company Name" required error={errors.companyName}>
            <Input {...register('companyName', { required: 'Company name is required' })} error={errors.companyName} />
          </Field>
        </div>
        <Field label="Contact Person"><Input {...register('contactPerson')} /></Field>
        <Field label="Designation"><Input {...register('designation')} /></Field>
        <Field label="Website"><Input {...register('website')} /></Field>
      </Section>

      <Section icon={User} title="Contact">
        <Field label="Email"><Input type="email" {...register('email')} /></Field>
        <Field label="Phone" error={errors.phoneNumber}>
          <Input inputMode="numeric" maxLength={10} {...register('phoneNumber', digitsRule(10, 'Phone'))} onBeforeInput={blockNonDigits} error={errors.phoneNumber} />
        </Field>
        <Field label="Mobile 1" error={errors.mobile1}>
          <Input inputMode="numeric" maxLength={10} {...register('mobile1', digitsRule(10, 'Mobile 1'))} onBeforeInput={blockNonDigits} error={errors.mobile1} />
        </Field>
        <Field label="Mobile 2" error={errors.mobile2}>
          <Input inputMode="numeric" maxLength={10} {...register('mobile2', digitsRule(10, 'Mobile 2'))} onBeforeInput={blockNonDigits} error={errors.mobile2} />
        </Field>
      </Section>

      <Section icon={MapPin} title="Address">
        <Field label="Address 1"><Input {...register('address1')} /></Field>
        <Field label="Address 2"><Input {...register('address2')} /></Field>
        <div className="sm:col-span-2">
          <Field label="Full / Registered Address"><Input {...register('companyAddress')} /></Field>
        </div>
        <Field label="City / District"><Input {...register('cityDistrict')} /></Field>
        <Field label="State"><Input {...register('state')} /></Field>
        <Field label="Pincode" error={errors.pincode}>
          <Input inputMode="numeric" maxLength={6} {...register('pincode', digitsRule(6, 'Pincode'))} onBeforeInput={blockNonDigits} error={errors.pincode} />
        </Field>
        <Field label="Country"><Input {...register('country')} /></Field>
      </Section>

      <Section icon={FileText} title="Lead Details">
        <Field label="Priority">
          <select className={selectClass} {...register('priority')}>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select className={selectClass} {...register('source')}>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Lead By"><Input {...register('leadBy')} /></Field>
        <div className="sm:col-span-2">
          <Field label="Business Description">
            <textarea rows="2" className={selectClass} {...register('businessDescription')} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Opening Comments">
            <textarea rows="2" className={selectClass} {...register('openingComments')} />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
        <Button type="submit" isLoading={isSaving}>Save Changes</Button>
      </div>
    </form>
  );
};

export default EditStsForm;
