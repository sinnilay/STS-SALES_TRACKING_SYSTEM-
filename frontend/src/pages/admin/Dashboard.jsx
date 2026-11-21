import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart3, TrendingUp, Activity, UserPlus, FilePlus2, ClipboardList, ArrowUpRight, CalendarDays } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { stsService } from '../../services/stsService';
import { profileService } from '../../services/profileService';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalSales: 0,
    salesAmount: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isFounder, setIsFounder] = useState(false);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    profileService.getMyProfile()
      .then((p) => {
        setIsFounder((p?.role || p?.Role) === 'SubAdmin');
        setFirstName((p?.fullName || '').trim().split(' ')[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Counts come from the server — downloading every STS record just to count them
        // made the dashboard crawl once the table grew into the thousands.
        const [employees, salesStats] = await Promise.all([
          employeeService.getAllEmployees(),
          stsService.getSalesStats()
        ]);

        setStats({
          totalEmployees: employees.length,
          activeEmployees: employees.filter(e => e.isActive).length,
          totalSales: salesStats.totalRecords,
          salesAmount: Number(salesStats.totalAmount) || 0
        });
      } catch (error) {
        console.error("Error fetching dashboard stats", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      name: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-500/20',
      accent: 'bg-blue-500',
      tint: 'from-blue-50 via-white to-indigo-50 border-blue-100',
      label: 'text-blue-700/80',
      glow: 'bg-blue-300/40',
      hint: 'Registered staff'
    },
    {
      name: 'Active Employees',
      value: stats.activeEmployees,
      icon: Activity,
      gradient: 'from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-500/20',
      accent: 'bg-emerald-500',
      tint: 'from-emerald-50 via-white to-teal-50 border-emerald-100',
      label: 'text-emerald-700/80',
      glow: 'bg-emerald-300/40',
      hint: 'Currently enabled'
    },
    {
      name: 'Total Sales Records',
      value: stats.totalSales,
      icon: BarChart3,
      gradient: 'from-fuchsia-500 to-purple-600',
      shadow: 'shadow-purple-500/20',
      accent: 'bg-purple-500',
      tint: 'from-fuchsia-50 via-white to-purple-50 border-purple-100',
      label: 'text-purple-700/80',
      glow: 'bg-purple-300/40',
      hint: 'STS records in system'
    },
    {
      name: 'Total Revenue',
      value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.salesAmount),
      icon: TrendingUp,
      gradient: 'from-orange-400 to-rose-500',
      shadow: 'shadow-rose-500/20',
      accent: 'bg-rose-500',
      tint: 'from-orange-50 via-white to-rose-50 border-rose-100',
      label: 'text-rose-700/80',
      glow: 'bg-rose-300/40',
      hint: 'Value of all conversions'
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const inactiveEmployees = stats.totalEmployees - stats.activeEmployees;
  const activePct = stats.totalEmployees ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0;

  const quickActions = [
    { label: 'Add New Employee', desc: 'Register a staff member', to: '/admin/employees/add', icon: UserPlus, tone: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10', tile: 'bg-gradient-to-br from-blue-50/80 to-white border-blue-100 hover:border-blue-300' },
    { label: 'Add STS Record', desc: 'Create a new STS entry', to: '/admin/sts/add', icon: FilePlus2, tone: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10', tile: 'bg-gradient-to-br from-purple-50/80 to-white border-purple-100 hover:border-purple-300' },
    { label: 'Daily Sales Report', desc: 'Review team activity', to: '/admin/employees/daily-report', icon: ClipboardList, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10', tile: 'bg-gradient-to-br from-emerald-50/80 to-white border-emerald-100 hover:border-emerald-300' },
    { label: 'Employee List', desc: 'Manage all employees', to: '/admin/employees', icon: Users, tone: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10', tile: 'bg-gradient-to-br from-amber-50/80 to-white border-amber-100 hover:border-amber-300' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-6 sm:p-8 shadow-lg shadow-indigo-900/20 border border-indigo-900/40">
        <div className="absolute -top-16 -right-10 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 left-1/3 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }}></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
              <CalendarDays className="w-4 h-4" /> {today}
            </p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-indigo-100/80 max-w-2xl">
              Workspace {isFounder ? 'Sub-Admin' : 'Admin'} Console — monitor employee activity, oversee operations and keep every department running smoothly.
            </p>
          </div>
          <Link
            to="/admin/employees/add"
            className="inline-flex items-center justify-center gap-2 self-start lg:self-auto px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-md hover:bg-indigo-50 transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`group bg-gradient-to-br ${stat.tint} dark:bg-none dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-lg border dark:border-slate-700 p-3.5 sm:p-6 transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden`}
          >
            <div className={`absolute left-0 top-0 h-full w-1 ${stat.accent}`}></div>
            <div className={`pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl ${stat.glow} dark:hidden`}></div>
            <div className="relative flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${stat.label} dark:text-slate-400`}>{stat.name}</p>
                <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">{stat.value}</p>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-500 truncate">{stat.hint}</p>
              </div>
              <div className={`p-2.5 sm:p-3.5 rounded-xl text-white bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.shadow} shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Workforce status — real counts from the employee list */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Workforce Status</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active vs inactive employees</p>
          <div className="mt-6 flex items-end justify-between">
            <p className="text-4xl font-black text-slate-900 dark:text-white">{activePct}<span className="text-xl text-slate-400">%</span></p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 pb-1">active</p>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700" style={{ width: `${activePct}%` }}></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3">
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{stats.activeEmployees}</p>
              <p className="text-xs font-semibold text-emerald-700/70 dark:text-emerald-400/70">Active</p>
            </div>
            <div className="rounded-xl bg-slate-100 dark:bg-slate-700/50 p-3">
              <p className="text-xl font-black text-slate-700 dark:text-slate-200">{inactiveEmployees}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inactive</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Quick Actions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Jump straight to common tasks</p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className={`group flex items-center gap-3.5 p-3.5 rounded-xl border ${action.tile} dark:bg-none dark:border-slate-700 dark:hover:border-indigo-500/50 hover:shadow-sm dark:hover:bg-slate-700/40 transition-all`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-0 ${action.tone}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{action.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{action.desc}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
