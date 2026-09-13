import React, { useState, useEffect } from 'react';
import { Users, BarChart3, TrendingUp, Activity, Sparkles } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { stsService } from '../../services/stsService';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalSales: 0,
    salesAmount: 0
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [employees, sales] = await Promise.all([
          employeeService.getAllEmployees(),
          stsService.getAllSales()
        ]);

        setStats({
          totalEmployees: employees.length,
          activeEmployees: employees.filter(e => e.isActive).length,
          totalSales: sales.length,
          salesAmount: sales.reduce((acc, curr) => acc + (curr.amount || 0), 0)
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
      shadow: 'shadow-blue-500/20'
    },
    { 
      name: 'Active Employees', 
      value: stats.activeEmployees, 
      icon: Activity, 
      gradient: 'from-emerald-400 to-emerald-600',
      shadow: 'shadow-emerald-500/20'
    },
    { 
      name: 'Total Sales Records', 
      value: stats.totalSales, 
      icon: BarChart3, 
      gradient: 'from-fuchsia-500 to-purple-600',
      shadow: 'shadow-purple-500/20'
    },
    { 
      name: 'Total Revenue', 
      value: `$${stats.salesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: TrendingUp, 
      gradient: 'from-orange-400 to-rose-500',
      shadow: 'shadow-rose-500/20'
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Workspace Admin Console
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
          </h2>
          <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
            Welcome to the STS unified enterprise dashboard. Seamlessly monitor employee activities, oversee administrative operations, and drive operational excellence across all departments in real-time.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div 
            key={idx} 
            className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:shadow-none dark:hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
          >
            {/* Subtle glow effect on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
            
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{stat.name}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-4 rounded-xl text-white bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.shadow} transform group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            
            {/* Decorative line at bottom */}
            <div className="absolute bottom-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className={`h-full w-full bg-gradient-to-r ${stat.gradient}`}></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Charts Placeholder Area */}
      <div className="mt-8 bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden group transition-colors duration-300">
        
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Detailed Analytics Upcoming</h3>
          <p className="text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            Comprehensive charts, performance graphs, and detailed data visualization will be available in Phase 2 of the dashboard rollout.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
