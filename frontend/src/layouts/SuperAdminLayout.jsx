import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, LayoutDashboard, LogOut, Settings, ShieldCheck, Activity, Clock, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const SuperAdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await api.get('/SuperAdmin/trial-requests');
        if (Array.isArray(response.data)) {
          const pending = response.data.filter(r => r.status === 'Pending').length;
          setPendingCount(pending);
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/superadmin', icon: LayoutDashboard },
    { name: 'Manage Tenants', path: '/superadmin/companies', icon: Building2 },
    { name: 'Pending Trial Requests', path: '/superadmin/trial-requests', icon: Clock, badge: pendingCount },
    { name: 'System Settings', path: '/superadmin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar - Premium Dark Mode Style */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl relative z-20">
        
        {/* Branding */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">STS Pro</h1>
            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">Headquarters</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto hide-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-md">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center border-2 border-slate-700 font-bold text-sm shadow-inner">
              SA
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">Super Administrator</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                System Online
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-400 hover:text-white hover:bg-rose-500 transition-colors border border-rose-500/20 hover:border-rose-500/0"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Topbar */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-8 shadow-sm relative z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Overview</h2>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 relative z-0">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <Outlet />
          </div>
        </div>

      </main>
    </div>
  );
};

export default SuperAdminLayout;
