import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, LogOut, Menu, X, Sun, Moon, BarChart3, Building2, Sparkles, ShieldCheck, UserCircle, ClipboardList, CalendarClock, History, FileText, ChevronsLeft, ChevronsRight } from 'lucide-react';
import api from '../services/api';
import TrialExpiryBanner from '../components/TrialExpiryBanner';
import ProfileMenu from '../components/ProfileMenu';
import AppFooter from '../components/AppFooter';
import SupportDesk from '../components/SupportDesk';
import GpsBroadcaster from '../components/GpsBroadcaster';
import { profileService } from '../services/profileService';

const SalesLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('salesSidebarCollapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('salesSidebarCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);
  const [liveEnabledModules, setLiveEnabledModules] = useState(user?.enabledModules);
  const [companyName, setCompanyName] = useState(user?.companyName || 'Property Workspace');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
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
          const logo = response.data.logoUrl || response.data.LogoUrl;
          if (logo !== undefined) {
            setCompanyLogoUrl(logo || null);
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
      navItems.push({ name: 'My Meetings', path: '/sales/meetings', icon: CalendarClock });
    }
    navItems.push({ name: 'My DSR', path: '/sales/dsr', icon: FileText });
  }

  navItems.push({ name: 'My Profile', path: '/sales/profile', icon: UserCircle });

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {isGpsEnabled && <GpsBroadcaster />}
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col ${collapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 fixed inset-y-0 z-10 transition-all duration-300`}>
        <div className={`${collapsed ? 'px-3 py-5 flex-col gap-3' : 'p-6'} flex items-center justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            {companyLogoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-gray-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-sm shrink-0">
                <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain dark:brightness-150 shrink-0" />
            )}
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight truncate" title={companyName}>{companyName || 'Sales Portal'}</h1>
                <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest">Sales Portal</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className={`flex-1 ${collapsed ? 'px-3' : 'px-4'} py-4 space-y-2 overflow-y-auto`}>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end
              title={collapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && item.name}
            </NavLink>
          ))}
        </nav>
        
        <div className={`${collapsed ? 'p-3' : 'p-4'} border-t border-gray-200 dark:border-slate-700`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-3'} mb-4`}>
            {!collapsed && <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Theme</span>}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <SupportDesk compact={collapsed} />
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${collapsed ? 'md:pl-20' : 'md:pl-64'} min-w-0 transition-all duration-300`}>
        <TrialExpiryBanner />
        {/* Mobile Navbar */}
        <header className="md:hidden bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {companyLogoUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-sm shrink-0">
                  <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <img src="/logo.png" alt="Logo" className="h-7 w-auto object-contain dark:brightness-150 shrink-0" />
              )}
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[180px]">{companyName || 'Sales'}</h1>
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
                 <SupportDesk />
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
          
          {/* Spacer keeps the company banner centered */}
          <div className="w-40" />

          {/* Centered Large Professional Company Banner */}
          <div className="flex items-center gap-3 px-8 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-blue-50/90 dark:from-blue-950/80 dark:via-indigo-950/80 dark:to-blue-950/80 border-2 border-blue-200/80 dark:border-blue-800/80 shadow-md shadow-blue-500/5 transform hover:scale-[1.01] transition-transform">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName} className="h-6 max-w-[90px] object-contain shrink-0" />
            ) : (
              <Sparkles className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400 animate-pulse" />
            )}
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
            <ProfileMenu
              name={myProfile?.fullName}
              email={user?.email}
              roleLabel={myProfile?.employeeRole || 'Employee'}
              avatarUrl={myProfile?.profilePictureUrl}
              profilePath="/sales/profile"
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  );
};

export default SalesLayout;
