import React from 'react';
import { createPortal } from 'react-dom';
import {
  X, Mail, Phone, Smartphone, MapPin, Calendar, Briefcase,
  Building2, GraduationCap, Users, Shield, BadgeCheck, Loader2, Hash
} from 'lucide-react';

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const ACCENTS = {
  blue: { chip: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400', head: 'text-blue-600 dark:text-blue-400' },
  indigo: { chip: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', head: 'text-indigo-600 dark:text-indigo-400' },
  violet: { chip: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400', head: 'text-violet-600 dark:text-violet-400' },
  emerald: { chip: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', head: 'text-emerald-600 dark:text-emerald-400' },
};

const SectionCard = ({ title, icon: Icon, accent = 'blue', children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ACCENTS[accent].chip}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <h3 className={`text-[13px] font-bold uppercase tracking-wider ${ACCENTS[accent].head}`}>{title}</h3>
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
      {children}
    </div>
  </div>
);

const DetailRow = ({ icon: Icon, label, value, href }) => {
  const content = (
    <p className={`text-sm font-semibold text-slate-900 dark:text-white break-words ${href && value ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:underline' : ''}`}>
      {value || <span className="text-slate-400 font-normal italic">Not provided</span>}
    </p>
  );

  return (
    <div className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        {href && value ? <a href={href}>{content}</a> : content}
      </div>
    </div>
  );
};

const EmployeeDetailsDrawer = ({ isOpen, onClose, employee }) => {
  if (!isOpen && !employee) return null;

  const initials = (employee?.fullName || employee?.email || '?')
    .trim()
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-slate-50 dark:bg-slate-950 shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto border-l border-slate-200 dark:border-slate-800`}
      >
        {!employee ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Loading employee details...</span>
          </div>
        ) : (
          <>
            {/* Header / Banner */}
            <div className="sticky top-0 z-10 overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 pt-6 pb-6 shadow-lg">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}></div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-[1] flex items-center gap-5 min-w-0 pr-10">
                <div className="w-20 h-20 shrink-0 rounded-2xl bg-white/10 backdrop-blur-sm border-4 border-white/30 shadow-xl text-white flex items-center justify-center font-black text-2xl overflow-hidden">
                  {employee.profilePictureUrl ? (
                    <img src={employee.profilePictureUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-100/80 uppercase tracking-wider mb-1">
                    <Hash className="w-3 h-3" />
                    Employee ID {employee.id}
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight truncate">
                    {employee.fullName || 'Unnamed Employee'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/25">
                      <BadgeCheck className="w-3 h-3" />
                      {employee.employeeRole || employee.role}
                    </span>
                    {employee.designation && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/25">
                        {employee.designation}
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${employee.isActive ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40' : 'bg-red-400/20 text-red-100 border-red-300/40'}`}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <SectionCard title="Contact Information" icon={Phone} accent="blue">
                <DetailRow icon={Mail} label="Email" value={employee.email} href={employee.email ? `mailto:${employee.email}` : undefined} />
                <DetailRow icon={Phone} label="Phone No." value={employee.phoneNumber} href={employee.phoneNumber ? `tel:${employee.phoneNumber}` : undefined} />
                <DetailRow icon={Smartphone} label="Mobile No." value={employee.mobileNo} href={employee.mobileNo ? `tel:${employee.mobileNo}` : undefined} />
                <DetailRow icon={Smartphone} label="Alternate Mobile No." value={employee.alternateMobileNo} href={employee.alternateMobileNo ? `tel:${employee.alternateMobileNo}` : undefined} />
              </SectionCard>

              <SectionCard title="Employment Details" icon={Briefcase} accent="indigo">
                <DetailRow icon={Building2} label="Department" value={employee.employeeDept || employee.department} />
                <DetailRow icon={Briefcase} label="Designation" value={employee.designation} />
                <DetailRow icon={MapPin} label="City / Branch" value={employee.cityBranch} />
                <DetailRow icon={Calendar} label="Joining Date" value={formatDate(employee.joiningDate)} />
                <DetailRow icon={Building2} label="Company" value={employee.companyName} />
                <DetailRow icon={Shield} label="System Role" value={employee.role} />
              </SectionCard>

              <SectionCard title="Personal Information" icon={Users} accent="violet">
                <DetailRow icon={Users} label="Father's Name" value={employee.fathersName} />
                <DetailRow icon={Calendar} label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                <DetailRow icon={Shield} label="Sex" value={employee.sex} />
                <DetailRow icon={GraduationCap} label="Qualification" value={employee.qualification} />
              </SectionCard>

              <SectionCard title="Address" icon={MapPin} accent="emerald">
                <DetailRow icon={MapPin} label="Local Address" value={employee.localAddress} />
                <DetailRow icon={MapPin} label="Permanent Address" value={employee.permanentAddress} />
                <DetailRow icon={MapPin} label="Zip Code" value={employee.zipCode} />
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
};

export default EmployeeDetailsDrawer;
