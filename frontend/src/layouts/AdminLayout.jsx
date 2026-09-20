import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Users, BarChart3, LogOut, Menu, X, LayoutDashboard, Sun, Moon, ChevronDown, ChevronRight, Settings, Building2, Sparkles, ShieldCheck, Navigation } from 'lucide-react';
import api from '../services/api';
import TrialExpiryBanner from '../components/TrialExpiryBanner';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [liveEnabledModules, setLiveEnabledModules] = useState(user?.enabledModules);
  const [companyName, setCompanyName] = useState(user?.companyName || 'Property Workspace');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);

  useEffect(() => {
    const fetchCompanyModules = async () => {
      try {
        const response = await api.get('/Admin/my-company');
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

    const handleCompanyUpdate = (e) => {
      if (e.detail?.logoUrl !== undefined) {
        setCompanyLogoUrl(e.detail.logoUrl || null);
      }
      if (e.detail?.companyName) {
        setCompanyName(e.detail.companyName);
      }
    };
    window.addEventListener('company-updated', handleCompanyUpdate);
    return () => window.removeEventListener('company-updated', handleCompanyUpdate);
  }, []);

  useEffect(() => {
    // Auto-expand menus based on current path
    if (location.pathname.includes('/admin/employees') && !location.pathname.includes('/admin/employees/daily-report')) {
      setExpandedMenus(prev => ({ ...prev, 'Employees': true }));
    }
    if (location.pathname.includes('/admin/sts') || location.pathname.includes('/admin/employees/daily-report')) {
      setExpandedMenus(prev => ({ ...prev, 'STS': true }));
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (name) => {
    setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const activeModulesStr = liveEnabledModules !== undefined && liveEnabledModules !== null
    ? liveEnabledModules
    : (user?.enabledModules !== undefined && user?.enabledModules !== null ? user.enabledModules : 'STS');

  const enabledModulesList = activeModulesStr.split(',').map(m => m.trim()).filter(Boolean);
  const isStsEnabled = enabledModulesList.includes('STS');
  const isGpsEnabled = enabledModulesList.includes('GPS');

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { 
      name: 'Employees', 
      icon: Users,
      children: [
        { name: 'New Employee', path: '/admin/employees/add' },
        { name: 'Employee List', path: '/admin/employees' },
        { name: 'Meetings', path: '/admin/employees/meetings' },
      ]
    },
  ];

  if (isStsEnabled) {
    navItems.push({
      name: 'STS',
      icon: BarChart3,
      children: [
        { name: 'Add STS', path: '/admin/sts/add' },
        { name: 'STS List', path: '/admin/sts' },
        { name: 'Employee STS Request', path: '/admin/sts/requests' },
        { name: 'Site Visit Gallery', path: '/admin/sts/site-images' },
        { name: 'Daily Sales Report', path: '/admin/employees/daily-report' },
      ]
    });
  }

  if (isGpsEnabled) {
    navItems.push({ name: 'GPS Tracking', path: '/admin/gps', icon: Navigation });
  }

  navItems.push({ name: 'Settings', path: '/admin/settings', icon: Settings });

  const renderNavItems = (isMobile = false) => (
    <nav className={`flex-1 ${isMobile ? 'space-y-2 mt-4' : 'px-4 py-4 space-y-2 overflow-y-auto'}`}>
      {navItems.map((item) => {
        if (item.children) {
          const isExpanded = expandedMenus[item.name];
          return (
            <div key={item.name} className="space-y-1">
              <button
                onClick={() => toggleMenu(item.name)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 
                  text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              {/* Dropdown Items */}
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[400px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="pl-9 pr-3 space-y-1">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.disabled ? '#' : child.path}
                      onClick={(e) => {
                        if (child.disabled) e.preventDefault();
                        if (isMobile && !child.disabled) setIsMobileMenuOpen(false);
                      }}
                      end
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          child.disabled
                            ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                            : isActive && !child.disabled
                              ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 font-semibold'
                              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/30'
                        }`
                      }
                    >
                      {child.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return (
          <NavLink
            key={item.name}
            to={item.path}
            end
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 fixed inset-y-0 z-10 transition-colors duration-300">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {companyLogoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-gray-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-sm shrink-0">
                <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)] shrink-0">
                <span className="text-white font-bold text-xl">{companyName?.charAt(0)?.toUpperCase() || 'W'}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-white tracking-tight truncate" title={companyName}>{companyName || 'Workspace'}</h1>
              <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Admin Portal</p>
            </div>
          </div>
        </div>
        
        {renderNavItems(false)}
        
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
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-bold shadow-md">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {user?.role || 'Admin'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
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
            <div className="flex items-center gap-2 min-w-0">
              {companyLogoUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200 dark:border-slate-700 flex items-center justify-center p-0.5 shadow-sm shrink-0">
                  <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-md shrink-0">
                  <span className="text-white font-bold text-sm">{companyName?.charAt(0)?.toUpperCase() || 'W'}</span>
                </div>
              )}
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[180px]">{companyName || 'Workspace'}</h1>
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
            {renderNavItems(true)}
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
               <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 px-4 py-3 font-medium text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Ultra-Premium Executive Header Bar */}
        <header className="hidden md:flex bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-20 px-8 py-4 justify-between items-center transition-all shadow-sm">
          
          {/* Left Info Box */}
          <div className="flex items-center gap-3">
            {companyLogoUrl ? (
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
                <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/20 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Enterprise Node</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">PRO</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Unified Operations & Analytics</p>
            </div>
          </div>

          {/* Centered Large Professional Company Banner */}
          <div className="flex items-center gap-3 px-8 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/90 to-indigo-50/90 dark:from-indigo-950/80 dark:via-purple-950/80 dark:to-indigo-950/80 border-2 border-indigo-200/80 dark:border-indigo-800/80 shadow-md shadow-indigo-500/5 transform hover:scale-[1.01] transition-transform">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName} className="h-6 max-w-[90px] object-contain shrink-0" />
            ) : (
              <Sparkles className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400 animate-pulse" />
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Welcome to</span>
              <span className="text-lg sm:text-xl font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-cyan-400 dark:via-indigo-300 dark:to-purple-400 drop-shadow-sm px-1">
                {companyName}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Enterprise Portal</span>
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

export default AdminLayout;
