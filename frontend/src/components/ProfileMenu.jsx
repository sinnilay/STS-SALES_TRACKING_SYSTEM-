import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { X, LogOut, UserCircle } from 'lucide-react';

// Signed-in user chip for the top header: avatar + name, opening a small account menu
// (name, email, role, profile link, logout). Used by the Admin, Sales and Super Admin layouts.
const ProfileMenu = ({ name, email, roleLabel, avatarUrl, onLogout, profilePath }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (name || email || '?').trim().charAt(0).toUpperCase();

  const Avatar = ({ size }) => (
    <div className={`${size} shrink-0 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-bold overflow-hidden`}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initial}
    </div>
  );

  return (
    <div className="relative group" ref={ref}>
      {/* Google-style round avatar button with a ring */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name || email}`}
        className={`rounded-full p-[3px] bg-gradient-to-br from-sky-400 to-emerald-400 transition-shadow ${open ? 'ring-4 ring-sky-400/30' : 'hover:ring-4 hover:ring-slate-400/20'}`}
      >
        <span className="block rounded-full p-[2px] bg-white dark:bg-slate-900">
          <Avatar size="w-9 h-9 text-base" />
        </span>
      </button>

      {/* Hover tooltip (hidden while the menu is open) */}
      {!open && (
        <div className="pointer-events-none absolute right-0 top-full mt-2 z-40 w-max max-w-[260px] opacity-0 group-hover:opacity-100 transition-opacity delay-200 rounded-lg bg-slate-800 dark:bg-slate-700 text-white px-3 py-2 text-xs leading-snug shadow-lg">
          <p className="font-semibold">Account</p>
          <p className="truncate">{name || email}</p>
          {name && email && <p className="truncate text-slate-300">{email}</p>}
          {roleLabel && <p className="text-slate-300">{roleLabel}</p>}
        </div>
      )}

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-80 z-50 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-2xl shadow-black/25 overflow-hidden p-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-col items-center text-center px-4 pt-6 pb-4">
            <div className="rounded-full p-[3px] bg-gradient-to-br from-sky-400 to-emerald-400">
              <span className="block rounded-full p-[2px] bg-slate-50 dark:bg-slate-900"><Avatar size="w-20 h-20 text-3xl" /></span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white truncate max-w-full">{name || email}</p>
            {email && <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-full">{email}</p>}
            {roleLabel && (
              <span className="mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                {roleLabel}
              </span>
            )}
          </div>
          <div className="space-y-0.5 rounded-2xl overflow-hidden">
            {profilePath && (
              <NavLink
                to={profilePath}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <UserCircle className="w-5 h-5" /> My profile
              </NavLink>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
