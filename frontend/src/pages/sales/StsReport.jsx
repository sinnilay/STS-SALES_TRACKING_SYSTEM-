import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ClipboardList, Search, RefreshCw, Eye, ArrowRightLeft, Filter,
  Activity, CheckCircle2, XCircle, LayoutList, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { employeeStsService } from '../../services/employeeStsService';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import AllotToFieldSalesModal from './AllotToFieldSalesModal';
import QuickSelectBar from '../admin/sts/QuickSelectBar';
import StsRecordsView, { RecordActionButton } from '../admin/sts/StsRecordsView';
import { STS_STATUS_OPTIONS, isConverted, isNotInterested } from '../../constants/stsPipeline';

const StatCard = ({ name, value, icon: Icon, gradient, shadow }) => (
  <div className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:shadow-none dark:hover:shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-10 transition-opacity duration-300`}></div>
    <div className="flex items-center justify-between relative z-10">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{name}</p>
        <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
      </div>
      <div className={`p-4 rounded-xl text-white bg-gradient-to-br ${gradient} shadow-lg ${shadow} transform group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const PAGE_SIZE = 25;

const StsReport = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForAllot, setSelectedRecordForAllot] = useState(null);
  // Bulk allot: ids of ticked records (only ones the user currently holds can be ticked).
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkAllotOpen, setIsBulkAllotOpen] = useState(false);
  // "Allot Multiple" mode — the selection bar and row checkboxes only show while it's on.
  const [isMultiMode, setIsMultiMode] = useState(false);

  const fetchSales = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true); else setIsRefreshing(true);
    try {
      const data = await employeeStsService.getStsReport();
      setSales(data);
      // Keep an open details drawer in sync with the freshly loaded row (e.g. after a status update).
      setSelectedRecordForDetails((prev) => (prev ? data.find((d) => d.id === prev.id) || prev : prev));
    } catch (error) {
      toast.error('Failed to load the STS report');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchSales(); }, []);

  // Held by me directly or as a co-assignee alongside someone else.
  const isMine = (row) => Number(row.allocatedTo?.id) === Number(user?.id)
    || (row.coAssignees || []).some((c) => Number(c.id) === Number(user?.id));

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

  // Render one page at a time — the report can hold thousands of records.
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedSales = filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ---- Bulk selection ----
  // Only records the user currently holds can be allotted onward.
  const allottableSales = useMemo(() => filteredSales.filter(isMine), [filteredSales, user?.id]);

  // Drop ticks on records that are no longer the user's after a reload.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(sales.filter(isMine).map((s) => s.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sales]);

  const toggleRow = (row) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
    return next;
  });

  const pageAllottable = pagedSales.filter(isMine);
  const pageAllSelected = pageAllottable.length > 0 && pageAllottable.every((r) => selectedIds.has(r.id));
  const togglePage = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    pageAllottable.forEach((r) => (pageAllSelected ? next.delete(r.id) : next.add(r.id)));
    return next;
  });

  const allSelected = allottableSales.length > 0 && allottableSales.every((s) => selectedIds.has(s.id));
  // Toggle: ticks every allottable record, or unticks them all if they're already ticked.
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(allottableSales.map((s) => s.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitMultiMode = () => { setIsMultiMode(false); clearSelection(); };
  const selectFirst = (n) => setSelectedIds(new Set(allottableSales.slice(0, n).map((s) => s.id)));

  // When the selection is exactly the first N allottable records, N (highlights the quick-select chip).
  const quickActiveCount = useMemo(() => {
    const size = selectedIds.size;
    if (size === 0 || size > allottableSales.length) return null;
    for (let i = 0; i < size; i++) if (!selectedIds.has(allottableSales[i].id)) return null;
    return size;
  }, [selectedIds, allottableSales]);

  const selectedRecords = sales.filter((s) => selectedIds.has(s.id));

  const selection = {
    isSelected: (row) => selectedIds.has(row.id),
    isSelectable: isMine,
    onToggle: toggleRow,
    header: (
      <input
        type="checkbox"
        title="Select all allottable records on this page"
        checked={pageAllSelected}
        disabled={pageAllottable.length === 0}
        onChange={togglePage}
        className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 disabled:opacity-30 cursor-pointer"
      />
    ),
  };

  const hasActiveFilters = searchTerm || statusFilter;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-5 sm:p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              STS Report
              <ClipboardList className="w-7 h-7 text-primary-500" />
            </h2>
            {!isLoading && (
            <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-xs font-bold text-primary-700 dark:text-primary-400">
              Total Records: {sales.length.toLocaleString()}
              {filteredSales.length !== sales.length && (
                <span className="font-semibold text-primary-600/70 dark:text-primary-400/70">· Showing {filteredSales.length.toLocaleString()}</span>
              )}
            </span>
          )}
            <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
              Every STS record on your book whose status has been updated — self-added or assigned by Admin.
              Untouched (New) records appear here once you update their status. When a client asks for a site visit,
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
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); clearSelection(); }}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); clearSelection(); }}
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300 appearance-none"
            >
              <option value="">All Statuses</option>
              {STS_STATUS_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.id} ({s.label})</option>)}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter(''); clearSelection(); }}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Clear
            </button>
          )}

          {allottableSales.length > 0 && (
            <button
              type="button"
              onClick={() => (isMultiMode ? exitMultiMode() : setIsMultiMode(true))}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${isMultiMode
                ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
            >
              {isMultiMode ? <X className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
              {isMultiMode ? 'Cancel Multiple' : 'Allot Multiple'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          {/* Bulk allot toolbar */}
          {isMultiMode && allottableSales.length > 0 && (
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="inline-flex items-center gap-2 px-3 py-1 rounded-full border font-semibold cursor-pointer transition-colors border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-primary-500">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                  />
                  Select all ({allottableSales.length})
                </label>
                <QuickSelectBar
                  total={allottableSales.length}
                  activeCount={quickActiveCount}
                  onSelectFirst={selectFirst}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-50 dark:bg-primary-500/10 px-4 py-2.5">
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                  {selectedIds.size > 0
                    ? `${selectedIds.size.toLocaleString()} record${selectedIds.size === 1 ? '' : 's'} selected`
                    : 'Tick records below, use Select all, or type how many to select.'}
                </span>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsBulkAllotOpen(true)}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Allot Selected ({selectedIds.size})
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Same layout as the admin STS List: fixed table on wide screens, cards below —
              never a sideways scrollbar. */}
          <StsRecordsView
            rows={pagedSales}
            startIndex={(currentPage - 1) * PAGE_SIZE}
            onOpen={setSelectedRecordForDetails}
            selection={isMultiMode && allottableSales.length > 0 ? selection : undefined}
            renderActions={(row, withLabels) => (
              <>
                <RecordActionButton icon={Eye} label="View" tone="slate" withLabels={withLabels} onClick={() => setSelectedRecordForDetails(row)} />
                {isMine(row) && (
                  <RecordActionButton icon={ArrowRightLeft} label="Allot" tone="primary" withLabels={withLabels} onClick={() => setSelectedRecordForAllot(row)} />
                )}
              </>
            )}
          />
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredSales.length} onPageChange={setPage} />
        </div>
      )}

      {/* Details Drawer */}
      <StsDetailsDrawer
        isOpen={!!selectedRecordForDetails}
        onClose={() => setSelectedRecordForDetails(null)}
        salesRecord={selectedRecordForDetails}
        fetchHistory={employeeStsService.getSalesHistory}
        onUpdateStatus={employeeStsService.updateSalesStatus}
        onUpdated={() => fetchSales(false)}
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

      {/* Bulk Allot to Field Sales Modal */}
      <Modal
        isOpen={isBulkAllotOpen}
        onClose={() => setIsBulkAllotOpen(false)}
        title={`Allot ${selectedRecords.length} Records to Field Sales`}
        maxWidthClass="max-w-lg"
      >
        {isBulkAllotOpen && selectedRecords.length > 0 && (
          <AllotToFieldSalesModal
            salesRecords={selectedRecords}
            onClose={() => setIsBulkAllotOpen(false)}
            onSuccess={() => {
              setIsBulkAllotOpen(false);
              exitMultiMode();
              fetchSales(false);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default StsReport;
