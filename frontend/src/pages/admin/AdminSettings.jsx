import React, { useState, useEffect, useRef } from 'react';
import { Shield, Mail, KeyRound, Lock, ArrowRight, CheckCircle2, Building2, UploadCloud, Trash2, Image, Sparkles, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { settingsService } from '../../services/settingsService';
import Input from '../../components/Input';
import Button from '../../components/Button';

const AdminSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'security'

  // Company State
  const [company, setCompany] = useState(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email State
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const fetchCompanyDetails = async () => {
    setIsLoadingCompany(true);
    try {
      const data = await settingsService.getMyCompany();
      setCompany(data);
    } catch (err) {
      console.error("Failed to load company details", err);
    } finally {
      setIsLoadingCompany(false);
    }
  };

  useEffect(() => {
    fetchCompanyDetails();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error('Please select a PNG, JPG, JPEG, WEBP, or SVG image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5 MB limit.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUploadLogo = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select an image file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploadingLogo(true);
    try {
      const res = await settingsService.uploadCompanyLogo(formData);
      toast.success(res.message || 'Company logo updated successfully!');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCompany((prev) => (prev ? { ...prev, logoUrl: res.logoUrl } : prev));
      window.dispatchEvent(new CustomEvent('company-updated', { detail: { logoUrl: res.logoUrl } }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload company logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the company logo?')) return;

    setIsRemovingLogo(true);
    try {
      const res = await settingsService.removeCompanyLogo();
      toast.success(res.message || 'Company logo removed.');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCompany((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      window.dispatchEvent(new CustomEvent('company-updated', { detail: { logoUrl: null } }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove company logo.');
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(user.email, oldPassword, newPassword);
      toast.success("Password updated successfully!");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    if (!newEmail || newEmail === user.email) {
      toast.error("Please enter a valid new email address.");
      return;
    }

    setIsChangingEmail(true);
    try {
      await authService.requestEmailChange(user.email, newEmail);
      toast.success("OTP sent to your new email address!");
      setOtpSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to request email change.");
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleVerifyEmailChange = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 4) {
      toast.error("Please enter a valid 4-digit OTP.");
      return;
    }

    setIsChangingEmail(true);
    try {
      await authService.verifyEmailChange(user.email, otp);
      toast.success("Email address updated successfully!");
      toast.success("Please log in again with your new email.", { duration: 5000 });
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setIsChangingEmail(false);
    }
  };

  const activeLogo = previewUrl || company?.logoUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary-500" />
            Admin Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure company branding, logo, security credentials, and account settings.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'company'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Company Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'security'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            Security &amp; Credentials
          </button>
        </div>
      </div>

      {/* ─── TAB 1: COMPANY SETTINGS ─── */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Main Logo Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
            <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-slate-800 dark:to-slate-800/80 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Image className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Company Logo</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Uploaded logo appears in Admin &amp; Employee portals, and is embedded in STS notification emails.
                  </p>
                </div>
              </div>
              {company?.logoUrl && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                  <Sparkles className="w-3.5 h-3.5" /> Logo Active
                </span>
              )}
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                {/* Visual Logo Preview Area */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border-2 border-dashed border-gray-200 dark:border-slate-700">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-3">
                    Logo Preview
                  </div>
                  <div className="w-40 h-28 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 flex items-center justify-center shadow-inner overflow-hidden">
                    {activeLogo ? (
                      <img
                        src={activeLogo}
                        alt="Company Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400 dark:text-slate-600">
                        <Building2 className="w-10 h-10 mx-auto mb-1 opacity-50" />
                        <span className="text-[11px]">No custom logo</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 text-center mt-3">
                    Recommended: Transparent PNG or SVG (max 5 MB)
                  </p>
                </div>

                {/* Upload & Actions Area */}
                <div className="md:col-span-2 space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300">
                      Select New Logo Image
                    </label>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Choose an image file from your computer to represent your company identity across the system.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4 text-indigo-500" />
                      {selectedFile ? 'Change Selected File' : 'Choose Logo File'}
                    </button>

                    {selectedFile && (
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                    )}

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={handleUploadLogo}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingLogo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Save Logo'
                        )}
                      </button>
                    )}

                    {company?.logoUrl && !selectedFile && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={isRemovingLogo}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isRemovingLogo ? 'Removing...' : 'Remove Logo'}
                      </button>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Image selected: <strong>{selectedFile.name}</strong>. Click <strong>"Save Logo"</strong> to upload and apply across all portals and emails.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Company Details Readout Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Company Workspace Profile
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Company Name</span>
                <span className="font-bold text-gray-800 dark:text-slate-200">{company?.name || '—'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Account Type</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{company?.accountType || (company?.isTrial ? 'Trial' : 'Permanent')}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Enabled Modules</span>
                <span className="font-bold text-gray-800 dark:text-slate-200">{company?.enabledModules || 'STS'}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Owner Email</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">{company?.ownerEmail || user?.email}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Location</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">
                  {[company?.city, company?.state, company?.country].filter(Boolean).join(', ') || 'Not specified'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 block">Website</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">{company?.website || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SECURITY & CREDENTIALS ─── */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Change Password Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
            <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change Password</h3>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
              <div className="pt-4">
                <Button type="submit" className="w-full justify-center" disabled={isChangingPassword}>
                  <Lock className="w-4 h-4 mr-2" />
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </div>

          {/* Change Email Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
            <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change Email Address</h3>
            </div>
            <div className="p-6">
              {!otpSent ? (
                <form onSubmit={handleRequestEmailChange} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Current Email</label>
                    <div className="px-4 py-2 bg-gray-100 dark:bg-slate-900 rounded-lg text-gray-500 dark:text-slate-500 font-mono text-sm border border-gray-200 dark:border-slate-700">
                      {user?.email}
                    </div>
                  </div>
                  <Input
                    label="New Email Address"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin@newdomain.com"
                    required
                  />
                  <div className="pt-4">
                    <Button type="submit" className="w-full justify-center" variant="secondary" disabled={isChangingEmail}>
                      {isChangingEmail ? "Sending..." : "Send Verification OTP"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailChange} className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl mb-4">
                    <p className="text-sm text-emerald-800 dark:text-emerald-300 flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      We've sent a 4-digit OTP to <strong>{newEmail}</strong>.
                    </p>
                  </div>
                  <Input
                    label="Enter 4-Digit OTP"
                    type="text"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 1234"
                    required
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 justify-center" onClick={() => setOtpSent(false)}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1 justify-center" disabled={isChangingEmail}>
                      {isChangingEmail ? "Verifying..." : "Verify & Update"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
