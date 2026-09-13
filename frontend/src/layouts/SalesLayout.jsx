import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, LogOut, Menu, X, Sun, Moon, BarChart3, Building2, Sparkles, ShieldCheck, UserCircle, ClipboardList, CalendarClock, History, FileText } from 'lucide-react';
import api from '../services/api';
import TrialExpiryBanner from '../components/TrialExpiryBanner';
import GpsBroadcaster from '../components/GpsBroadcaster';
import { profileService } from '../services/profileService';

const SalesLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [liveEnabledModules, setLiveEnabledModules] = useState(user?.enabledModules);
  const [companyName, setCompanyName] = useState(user?.companyName || 'Property Workspace');
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    profileService.getMyProfile().then(setMyProfile).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchCompanyModules = async () => {
      try {
        const response = await api.get('/Employee/my-company');
        if (response.data) {
          const modules = response.data.enabledModules !== undefined ? response.data.enabledModules : response.data.EnabledModules;
          if (modules !== undefined && modules !== null) {
            setLiveEnabledModules(modules);
          }
          const cName = response.data.name || response.data.Name;
          if (cName) {
            setCompanyName(cName);
          }
        }
      } catch (e) {
        // Fallback to user context
      }
    };
    fetchCompanyModules();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let userPermissions = [];
  try {
    userPermissions = user?.permissions ? JSON.parse(user.permissions) : [];
  } catch (e) {
    userPermissions = [];
  }

  const activeModulesStr = liveEnabledModules !== undefined && liveEnabledModules !== null
    ? liveEnabledModules
    : (user?.enabledModules !== undefined && user?.enabledModules !== null ? user.enabledModules : 'STS');

  const enabledModulesList = activeModulesStr.split(',').map(m => m.trim()).filter(Boolean);
  const isStsEnabled = enabledModulesList.includes('STS');
  const isGpsEnabled = enabledModulesList.includes('GPS');

  const navItems = [
    { name: 'Dashboard', path: '/sales', icon: LayoutDashboard },
  ];

  if (isStsEnabled) {
    navItems.push({ name: 'My STS Records', path: '/sales/sts', icon: BarChart3 });
    if (userPermissions.includes('addSts')) {
      navItems.push({ name: 'Add STS', path: '/sales/sts/add', icon: BarChart3 });
    }
    if (myProfile?.employeeRole === 'Tele Sales') {
      navItems.push({ name: 'STS Report', path: '/sales/sts/report', icon: ClipboardList });
    }
    if (myProfile?.employeeRole === 'Field Sales' || myProfile?.employeeRole === 'Tele Sales') {
      navItems.push({ name: 'Current Meetings', path: '/sales/meetings/current', icon: CalendarClock });
      navItems.push({ name: 'Past Meetings', path: '/sales/meetings/past', icon: History });
    }
    navItems.push({ name: 'My DSR', path: '/sales/dsr', icon: FileText });
  }

  navItems.push({ name: 'My Profile', path: '/sales/profile', icon: UserCircle });

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {isGpsEnabled && <GpsBroadcaster />}
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 fixed inset-y-0 z-10 transition-colors duration-300">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain dark:brightness-150" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Sales Portal</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4 px-3">
            <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Theme</span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <NavLink to="/sales/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-bold shadow-md overflow-hidden">
              {myProfile?.profilePictureUrl ? (
                <img src={myProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.email?.charAt(0).toUpperCase() || 'S'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {myProfile?.fullName || user?.role || 'Sales'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all duration-300">
        <TrialExpiryBanner />
        {/* Mobile Navbar */}
        <header className="md:hidden bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain dark:brightness-150" />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sales</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-10 bg-white dark:bg-slate-800 pt-16 px-4 pb-4 overflow-y-auto">
            <nav className="space-y-2 mt-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
                 <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 px-4 py-3 font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Ultra-Premium Executive Header Bar */}
        <header className="hidden md:flex bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-20 px-8 py-4 justify-between items-center transition-all shadow-sm">
          
          {/* Left Info Box */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-white/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Sales Operational Node</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">LIVE</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Pipeline Performance & Tracking</p>
            </div>
          </div>

          {/* Centered Large Professional Company Banner */}
          <div className="flex items-center gap-3 px-8 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-blue-50/90 dark:from-blue-950/80 dark:via-indigo-950/80 dark:to-blue-950/80 border-2 border-blue-200/80 dark:border-blue-800/80 shadow-md shadow-blue-500/5 transform hover:scale-[1.01] transition-transform">
            <Sparkles className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Welcome to</span>
              <span className="text-lg sm:text-xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 dark:from-cyan-400 dark:via-blue-300 dark:to-indigo-400 drop-shadow-sm px-1">
                {companyName}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Sales Portal</span>
            </div>
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 dark:text-emerald-400" />
          </div>

          {/* Right Status Badge */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SYSTEM ONLINE
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SalesLayout;
