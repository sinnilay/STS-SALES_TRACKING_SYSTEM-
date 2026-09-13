import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ClipboardList, Search, RefreshCw, Eye, ArrowRightLeft, Filter,
  Activity, CheckCircle2, XCircle, LayoutList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { employeeStsService } from '../../services/employeeStsService';
import Table from '../../components/Table';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import AllotToFieldSalesModal from './AllotToFieldSalesModal';
import { STS_STATUS_OPTIONS, getStatusMeta, isConverted, isNotInterested } from '../../constants/stsPipeline';

const StatusPill = ({ status }) => {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${meta.badge}`} title={meta.label}>
      {status || 'New'}
    </span>
  );
};

const StatCard = ({ name, value, icon: Icon, gradient, shadow }) => (
  <div className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:shadow-none dark:hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{name}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
      </div>
      <div className={`p-4 rounded-xl text-white bg-gradient-to-br ${gradient} shadow-lg ${shadow} transform group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const StsReport = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForAllot, setSelectedRecordForAllot] = useState(null);

  const fetchSales = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true); else setIsRefreshing(true);
    try {
      const data = await employeeStsService.getStsReport();
      setSales(data);
    } catch (error) {
      toast.error('Failed to load the STS report');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchSales(); }, []);

  const stats = useMemo(() => {
    const converted = sales.filter((s) => isConverted(s.status)).length;
    const notInterested = sales.filter((s) => isNotInterested(s.status)).length;
    const active = sales.length - converted - notInterested;
    return { total: sales.length, active, converted, notInterested };
  }, [sales]);

  const filteredSales = useMemo(() => sales.filter((s) => {
    const matchesSearch = searchTerm
      ? (s.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    const matchesStatus = statusFilter ? s.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  }), [sales, searchTerm, statusFilter]);

  const columns = [
    { header: 'Comp ID', render: (row) => <span className="font-mono text-xs text-gray-500 dark:text-slate-400">{row.companyID}</span> },
    { header: 'Company Name', render: (row) => <span className="font-semibold text-gray-900 dark:text-white">{row.companyName}</span> },
    { header: 'City/District', accessor: 'cityDistrict' },
    { header: 'Priority', render: (row) => row.priority || '—' },
    {
      header: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={row.status} />
          {Number(row.allocatedTo?.id) !== Number(user?.id) && row.allocatedTo?.fullName && (
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              With {row.allocatedTo.fullName}
            </span>
          )}
        </div>
      )
    },
    { header: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { header: 'Last Action', render: (row) => row.lastActionDate ? new Date(row.lastActionDate).toLocaleDateString() : '—' },
  ];

  const hasActiveFilters = searchTerm || statusFilter;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              STS Report
              <ClipboardList className="w-7 h-7 text-primary-500" />
            </h2>
            <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
              Every STS record on your book — self-added or assigned by Admin. When a client asks for a site visit,
              allot the record straight to a Field Sales executive from here.
            </p>
          </div>
          <button
            onClick={() => fetchSales(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard name="Total Records" value={stats.total} icon={LayoutList} gradient="from-blue-500 to-indigo-600" shadow="shadow-blue-500/20" />
        <StatCard name="Active Pipeline" value={stats.active} icon={Activity} gradient="from-orange-400 to-rose-500" shadow="shadow-orange-500/20" />
        <StatCard name="Converted" value={stats.converted} icon={CheckCircle2} gradient="from-emerald-400 to-emerald-600" shadow="shadow-emerald-500/20" />
        <StatCard name="Not Interested" value={stats.notInterested} icon={XCircle} gradient="from-rose-500 to-red-600" shadow="shadow-rose-500/20" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
              placeholder="Search by company name or STS ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300 appearance-none"
            >
              <option value="">All Statuses</option>
              {STS_STATUS_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.id} ({s.label})</option>)}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter(''); }}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <Table
            columns={columns}
            data={filteredSales}
            onRowClick={(row) => setSelectedRecordForDetails(row)}
            renderActions={(row) => (
              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedRecordForDetails(row)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 font-medium text-sm"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                {Number(row.allocatedTo?.id) === Number(user?.id) && (
                  <button
                    onClick={() => setSelectedRecordForAllot(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 font-medium text-sm"
                    title="Allot to Field Sales"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Allot
                  </button>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* Details Drawer */}
      <StsDetailsDrawer
        isOpen={!!selectedRecordForDetails}
        onClose={() => setSelectedRecordForDetails(null)}
        salesRecord={selectedRecordForDetails}
        fetchHistory={employeeStsService.getSalesHistory}
      />

      {/* Allot to Field Sales Modal */}
      <Modal
        isOpen={!!selectedRecordForAllot}
        onClose={() => setSelectedRecordForAllot(null)}
        title="Allot to Field Sales"
        maxWidthClass="max-w-lg"
      >
        {selectedRecordForAllot && (
          <AllotToFieldSalesModal
            salesRecord={selectedRecordForAllot}
            onClose={() => setSelectedRecordForAllot(null)}
            onSuccess={() => {
              setSelectedRecordForAllot(null);
              fetchSales(false);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default StsReport;
