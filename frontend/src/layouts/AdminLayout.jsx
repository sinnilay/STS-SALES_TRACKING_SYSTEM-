import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Users, BarChart3, LogOut, Menu, X, LayoutDashboard, Sun, Moon, ChevronDown, ChevronRight, Settings, Building2, Sparkles, ShieldCheck, Navigation, ChevronsLeft, ChevronsRight } from 'lucide-react';
import api from '../services/api';
import TrialExpiryBanner from '../components/TrialExpiryBanner';
import ProfileMenu from '../components/ProfileMenu';
import AppFooter from '../components/AppFooter';
import SupportDesk from '../components/SupportDesk';
import { profileService } from '../services/profileService';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  // Desktop sidebar can shrink to an icon rail; the choice is remembered per browser.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('adminSidebarCollapsed') === '1'; } catch { return false; }
  });
  // In the icon rail a group (Employees / STS) opens as a small flyout panel beside it.
  const [flyout, setFlyout] = useState(null); // { name, top }
  const [liveEnabledModules, setLiveEnabledModules] = useState(user?.enabledModules);
  const [companyName, setCompanyName] = useState(user?.companyName || 'Property Workspace');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
  // Company admin (created at company setup) is "Admin"; accounts added with System Role "Sub-Admin" are "Sub-Admin".
  const roleLabel = user?.isSubAdmin ? 'Sub-Admin' : 'Admin';
  const [myProfile, setMyProfile] = useState(null);

  useEffect(() => {
    profileService.getMyProfile().then(setMyProfile).catch(() => {});
  }, []);

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
    const isStsPage = location.pathname.includes('/admin/sts')
      || location.pathname.includes('/admin/employees/daily-report')
      || location.pathname.includes('/admin/employees/meetings');
    if (location.pathname.includes('/admin/employees') && !isStsPage) {
      setExpandedMenus(prev => ({ ...prev, 'Employees': true }));
    }
    if (isStsPage) {
      setExpandedMenus(prev => ({ ...prev, 'STS': true }));
    }
  }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
    setFlyout(null);
  }, [collapsed]);

  useEffect(() => { setFlyout(null); }, [location.pathname]);

  useEffect(() => {
    if (!flyout) return undefined;
    const close = (e) => { if (!e.target.closest('[data-flyout]')) setFlyout(null); };
    const onKey = (e) => { if (e.key === 'Escape') setFlyout(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [flyout]);

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
        { name: 'STS Request', path: '/admin/sts/requests' },
        { name: 'Employee Analytics', path: '/admin/sts/employee-analytics', matchPrefix: true },
        { name: 'Site Visit Gallery', path: '/admin/sts/site-images' },
        { name: 'Daily Sales Report', path: '/admin/employees/daily-report' },
        { name: 'Meetings', path: '/admin/employees/meetings' },
      ]
    });
  }

  if (isGpsEnabled) {
    navItems.push({ name: 'GPS Tracking', path: '/admin/gps', icon: Navigation });
  }

  navItems.push({ name: 'Settings', path: '/admin/settings', icon: Settings });

  const renderNavItems = (isMobile = false) => {
    const compact = !isMobile && collapsed;
    return (
    <nav className={`flex-1 ${isMobile ? 'space-y-2 mt-4' : `${compact ? 'px-3' : 'px-4'} py-4 space-y-2 overflow-y-auto`}`}>
      {navItems.map((item) => {
        if (compact) {
          const groupActive = item.children
            ? item.children.some((c) => location.pathname === c.path || (c.matchPrefix && location.pathname.startsWith(`${c.path}/`)))
            : false;
          if (item.children) {
            const open = flyout?.name === item.name;
            return (
              <button
                key={item.name}
                data-flyout
                title={item.name}
                onClick={(e) => {
                  const top = e.currentTarget.getBoundingClientRect().top;
                  setFlyout(open ? null : { name: item.name, top });
                }}
                className={`w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  open || groupActive ? 'bg-primary-500/15 text-primary-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
              </button>
            );
          }
          return (
            <NavLink
              key={item.name}
              to={item.path}
              end
              title={item.name}
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
            </NavLink>
          );
        }

        if (item.children) {
          const isExpanded = expandedMenus[item.name];
          return (
            <div key={item.name} className="space-y-1">
              <button
                onClick={() => toggleMenu(item.name)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 
                  text-slate-300 hover:bg-white/5 hover:text-white
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
                      end={!child.matchPrefix}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          child.disabled
                            ? 'text-slate-600 cursor-not-allowed opacity-60'
                            : isActive && !child.disabled
                              ? 'bg-primary-500/15 text-primary-300 font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
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
  };

  const flyoutItem = flyout ? navItems.find((i) => i.name === flyout.name) : null;

  return (
    <div className="min-h-screen flex bg-[#eef1f6] dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col ${collapsed ? 'w-20' : 'w-64'} bg-slate-900 dark:bg-slate-950 border-r border-slate-800 fixed inset-y-0 z-30 transition-all duration-300`}>
        <div className={`${collapsed ? 'px-3 py-5 flex-col gap-3' : 'p-6'} flex items-center justify-between`}>
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
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest">{roleLabel} Portal</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
          </button>
        </div>

        {renderNavItems(false)}
        
        <div className={`${collapsed ? 'p-3' : 'p-4'} border-t border-slate-800`}>
          <SupportDesk compact={collapsed} />
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Flyout for a group (Employees / STS) while the sidebar is collapsed */}
      {collapsed && flyoutItem && (
        <div
          data-flyout
          style={{ top: Math.max(8, flyout.top - 4) }}
          className="hidden md:block fixed left-[5.25rem] z-40 w-60 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-black/40 p-2"
        >
          <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{flyoutItem.name}</p>
          <div className="space-y-1">
            {flyoutItem.children.map((child) => (
              <NavLink
                key={child.name}
                to={child.path}
                end={!child.matchPrefix}
                onClick={() => setFlyout(null)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary-500/15 text-primary-300 font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {child.name}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${collapsed ? 'md:pl-20' : 'md:pl-64'} min-w-0 transition-all duration-300`}>
        <TrialExpiryBanner />
        {/* Mobile Navbar */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 sticky top-0 z-20 transition-colors duration-300">
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
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-white dark:text-slate-300 hover:bg-white/15 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-white dark:text-slate-300 hover:bg-white/15 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-10 bg-slate-900 pt-16 px-4 pb-4 overflow-y-auto">
            {/* Company identity card */}
            <div className="mb-4 px-4 py-3 rounded-2xl bg-slate-800/70 border border-slate-700/80">
              <h2 className="text-lg font-black uppercase tracking-tight text-white truncate" title={companyName}>{companyName || 'Workspace'}</h2>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Enterprise Portal</span>
              </p>
            </div>
            {renderNavItems(true)}
            <div className="pt-4 mt-4 border-t border-slate-800">
              <SupportDesk />
               <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 px-4 py-3 font-medium text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}

        {/* Ultra-Premium Executive Header Bar */}
        <header className="hidden md:grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t-[3px] border-t-indigo-600 border-b border-slate-200 dark:border-b-slate-800/80 sticky top-0 z-20 px-4 lg:px-8 py-3 lg:py-4 items-center transition-all shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          
          {/* Spacer keeps the banner centred now that the left info box is gone */}
          <div className="hidden lg:block" />

          {/* Company brand — large logo with the company name */}
          <div className="flex items-center gap-4 min-w-0 px-5 lg:px-7 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
            {companyLogoUrl ? (
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white border border-slate-200 dark:border-slate-600 shadow-md p-1.5 flex items-center justify-center overflow-hidden shrink-0">
                <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-2xl lg:text-3xl">{companyName?.charAt(0)?.toUpperCase() || 'W'}</span>
              </div>
            )}
            <div className="min-w-0 border-l border-slate-200 dark:border-slate-700 pl-4">
              <h2 className="text-xl lg:text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white truncate leading-tight" title={companyName}>
                {companyName || 'Workspace'}
              </h2>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Enterprise Portal</span>
              </p>
            </div>
          </div>

          {/* Right Status Badge */}
          <div className="flex items-center gap-3 justify-self-end">
            <ProfileMenu
              name={myProfile?.fullName}
              email={user?.email}
              roleLabel={roleLabel}
              avatarUrl={myProfile?.profilePictureUrl}
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

export default AdminLayout;
