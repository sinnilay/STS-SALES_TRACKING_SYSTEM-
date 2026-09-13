import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Camera, Mail, Phone, Smartphone, MapPin, Calendar, Briefcase,
  Building2, GraduationCap, Users, Shield, Pencil, Check, X, BadgeCheck
} from 'lucide-react';
import { profileService } from '../../services/profileService';
import Spinner from '../../components/Spinner';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3">
    <div className="mt-0.5 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 break-words">{value || '—'}</p>
    </div>
  </div>
);

const EditableRow = ({ icon: Icon, label, value, onSave, placeholder, type = 'tel' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setDraft(value || ''); }, [value]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 group">
      <div className="mt-0.5 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-2.5 py-1.5 text-sm border border-primary-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setDraft(value || ''); setIsEditing(false); }}
              className="p-1.5 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{value || <span className="italic text-gray-400 dark:text-slate-500">Not added</span>}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
              title={value ? 'Edit' : 'Add'}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
    <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
      <Icon className="w-5 h-5 text-primary-500" />
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
    </div>
    <div className="p-6 divide-y divide-gray-50 dark:divide-slate-700/50">
      {children}
    </div>
  </div>
);

const SalesProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadProfile = async () => {
    try {
      const data = await profileService.getMyProfile();
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load your profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleFieldSave = (field) => async (val) => {
    try {
      await profileService.updateMyProfile({ [field]: val });
      setProfile((prev) => ({ ...prev, [field]: val }));
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update');
      throw error;
    }
  };

  const handlePictureClick = () => fileInputRef.current?.click();

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const result = await profileService.uploadProfilePicture(file);
      setProfile((prev) => ({ ...prev, profilePictureUrl: result.profilePictureUrl }));
      toast.success('Profile picture updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (!profile) return null;

  const initials = (profile.fullName || profile.email || '?')
    .trim()
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header / Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-lg">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="relative z-10 px-8 py-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-2xl bg-white/10 backdrop-blur-sm border-4 border-white/30 shadow-xl overflow-hidden flex items-center justify-center">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt={profile.fullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-white">{initials}</span>
              )}
            </div>
            <button
              onClick={handlePictureClick}
              disabled={isUploading}
              className="absolute -bottom-2 -right-2 p-2.5 rounded-xl bg-white text-blue-600 shadow-lg hover:bg-blue-50 transition-colors disabled:opacity-60"
              title="Change profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePictureChange} />
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-white truncate">{profile.fullName || 'Unnamed Employee'}</h1>
            <div className="mt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/25">
                <BadgeCheck className="w-3.5 h-3.5" />
                {profile.employeeRole || profile.role}
              </span>
              {profile.designation && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/25">
                  {profile.designation}
                </span>
              )}
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${profile.isActive ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40' : 'bg-red-400/20 text-red-100 border-red-300/40'}`}>
                {profile.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-2 text-sm text-blue-100 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {profile.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Contact Information" icon={Phone}>
          <EditableRow icon={Phone} label="Phone No." value={profile.phoneNumber} placeholder="Landline number" onSave={handleFieldSave('phoneNumber')} />
          <EditableRow icon={Smartphone} label="Mobile No." value={profile.mobileNo} placeholder="Primary mobile number" onSave={handleFieldSave('mobileNo')} />
          <EditableRow icon={Smartphone} label="Alternate Mobile No." value={profile.alternateMobileNo} placeholder="Alternate mobile number" onSave={handleFieldSave('alternateMobileNo')} />
        </SectionCard>

        <SectionCard title="Employment Details" icon={Briefcase}>
          <DetailRow icon={Building2} label="Department" value={profile.employeeDept || profile.department} />
          <DetailRow icon={Briefcase} label="Designation" value={profile.designation} />
          <DetailRow icon={MapPin} label="City / Branch" value={profile.cityBranch} />
          <DetailRow icon={Calendar} label="Joining Date" value={formatDate(profile.joiningDate)} />
          <DetailRow icon={Building2} label="Company" value={profile.companyName} />
        </SectionCard>

        <SectionCard title="Personal Information" icon={Users}>
          <DetailRow icon={Users} label="Father's Name" value={profile.fathersName} />
          <DetailRow icon={Calendar} label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
          <DetailRow icon={Shield} label="Sex" value={profile.sex} />
          <DetailRow icon={GraduationCap} label="Qualification" value={profile.qualification} />
        </SectionCard>

        <SectionCard title="Address" icon={MapPin}>
          <EditableRow icon={MapPin} label="Local Address" value={profile.localAddress} placeholder="Current residential address" type="text" onSave={handleFieldSave('localAddress')} />
          <DetailRow icon={MapPin} label="Permanent Address" value={profile.permanentAddress} />
          <DetailRow icon={MapPin} label="Zip Code" value={profile.zipCode} />
        </SectionCard>
      </div>
    </div>
  );
};

export default SalesProfile;
