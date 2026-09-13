import React, { useState, useEffect } from 'react';
import { Building2, Users, CreditCard, Activity, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeTrials: 0,
    expiringSoon: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    // In a real app, fetch these from /api/SuperAdmin/dashboard-stats
    // For now we will just simulate them or fetch companies and calculate
    const fetchStats = async () => {
      try {
        const response = await api.get('/SuperAdmin/companies');
        const companies = response.data;
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        setStats({
          totalCompanies: companies.length,
          activeTrials: companies.filter(c => c.isTrial).length,
          expiringSoon: companies.filter(c => new Date(c.subscriptionExpiry) <= thirtyDaysFromNow).length,
          totalRevenue: 0 // placeholder
        });
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };
    
    if (token) fetchStats();
  }, [token]);

  const statCards = [
    {
      title: 'Total Tenants',
      value: stats.totalCompanies,
      icon: Building2,
      color: 'from-blue-500 to-cyan-400',
      shadow: 'shadow-blue-500/20'
    },
    {
      title: 'Active Trials',
      value: stats.activeTrials,
      icon: Activity,
      color: 'from-purple-500 to-indigo-400',
      shadow: 'shadow-purple-500/20'
    },
    {
      title: 'Expiring Soon (30d)',
      value: stats.expiringSoon,
      icon: ShieldAlert,
      color: 'from-rose-500 to-orange-400',
      shadow: 'shadow-rose-500/20'
    },
    {
      title: 'Monthly Recurring',
      value: '$0.00', // Mock data
      icon: CreditCard,
      color: 'from-emerald-500 to-teal-400',
      shadow: 'shadow-emerald-500/20'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">Welcome to the Headquarters, Super Admin.</h1>
          <p className="text-slate-300 max-w-2xl text-lg">
            Global Property Management, Workspace Subscriptions & Core Control Module. You are currently in the highest clearance level.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className={`bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.title}</p>
                <h3 className="text-4xl font-black text-slate-800">{stat.value}</h3>
              </div>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg ${stat.shadow}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout for extra info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Trial Expirations Panel */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-800">Trial Expirations</h3>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full uppercase tracking-wider">Onboarding</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
            <ShieldAlert className="w-12 h-12 mb-3 text-slate-300" />
            <p className="font-semibold">No trials expiring in next 15 days.</p>
          </div>
        </div>

        {/* Quick Links Panel */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h3 className="text-lg font-black text-slate-800 mb-6">Quick Administrative Tools</h3>
          
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-500 border border-slate-100 group-hover:border-indigo-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-slate-800 text-sm">Provision New Tenant</h4>
                  <p className="text-xs text-slate-500 font-medium">Create workspace operators</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </button>

            <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-purple-50 border border-slate-100 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-purple-500 border border-slate-100 group-hover:border-purple-200">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-slate-800 text-sm">Manage Identity</h4>
                  <p className="text-xs text-slate-500 font-medium">Sub-Admin Control</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
