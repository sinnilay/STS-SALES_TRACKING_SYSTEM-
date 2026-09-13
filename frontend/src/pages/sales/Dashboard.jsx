import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { employeeStsService } from '../../services/employeeStsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, Clock, Target, Activity } from 'lucide-react';
import Spinner from '../../components/Spinner';
import { getStatusMeta, isConverted, isNotInterested } from '../../constants/stsPipeline';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
    <div className={`p-4 rounded-xl ${colorClass}`}>
      <Icon className="w-8 h-8 text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const SalesDashboard = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const data = await employeeStsService.getAssignedSales();
        setSales(data);
      } catch (error) {
        console.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSales();
  }, []);

  if (isLoading) return <div className="py-12 flex justify-center"><Spinner /></div>;

  const totalAssigned = sales.length;
  const successful = sales.filter(s => isConverted(s.status)).length;
  const notInterested = sales.filter(s => isNotInterested(s.status)).length;
  const activeFollowups = totalAssigned - successful - notInterested;

  const successRate = totalAssigned > 0 ? Math.round((successful / totalAssigned) * 100) : 0;

  // Chart Data — grouped by call-outcome group rather than by individual STS code,
  // since there are ~19 codes now (too many bars to be readable individually).
  const statusCounts = sales.reduce((acc, curr) => {
    const group = getStatusMeta(curr.status).group;
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});

  const chartData = [
    { name: 'New / Untouched', count: statusCounts['neutral'] || 0, color: '#94a3b8' },
    { name: 'In Progress', count: statusCounts['positive'] || 0, color: '#6366f1' },
    { name: 'Converted', count: statusCounts['success'] || 0, color: '#22c55e' },
    { name: 'Not Interested', count: statusCounts['negative'] || 0, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.email?.split('@')[0]}!</h1>
        <p className="mt-2 text-gray-600 dark:text-slate-400">Here's what's happening with your pipeline today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Leads" value={totalAssigned} icon={Target} colorClass="bg-blue-500" />
        <StatCard title="Active Pipeline" value={activeFollowups} icon={Activity} colorClass="bg-orange-500" />
        <StatCard title="Closed Won" value={successful} icon={CheckCircle} colorClass="bg-green-500" />
        <StatCard title="Success Rate" value={`${successRate}%`} icon={Clock} colorClass="bg-indigo-500" />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Pipeline Status Overview</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
