import React, { useState } from 'react';
import { Shield, Mail, KeyRound, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import Input from '../../components/Input';
import Button from '../../components/Button';

const AdminSettings = () => {
  const { user, login } = useAuth(); // We might need to update user context if email changes
  
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
      // We should ideally update the auth context or force a re-login. 
      // For now, we will just inform the user.
      toast.success("Please log in again with your new email.", { duration: 5000 });
      setTimeout(() => {
        window.location.href = '/login'; // Force logout/login
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setIsChangingEmail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary-500" />
          Admin Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Manage your security credentials and account settings.
        </p>
      </div>

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
    </div>
  );
};

export default AdminSettings;
