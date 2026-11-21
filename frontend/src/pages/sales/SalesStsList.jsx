import React, { useState, useEffect, useMemo } from 'react';
import { Search, Eye, PencilLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeStsService } from '../../services/employeeStsService';
import { profileService } from '../../services/profileService';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import StatusPipelineModal from '../admin/sts/StatusPipelineModal';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import StsRecordsView, { RecordActionButton } from '../admin/sts/StsRecordsView';

const PAGE_SIZE = 25;

const SalesStsList = () => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [myEmployeeRole, setMyEmployeeRole] = useState(null);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const data = await employeeStsService.getAssignedSales();
      setSales(data);
    } catch (error) {
      toast.error('Failed to fetch your assigned records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    profileService.getMyProfile().then((p) => setMyEmployeeRole(p.employeeRole)).catch(() => {});
  }, []);

  const isFieldSales = myEmployeeRole === 'Field Sales';

  const filteredSales = useMemo(() => sales.filter((sale) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (sale.companyName && sale.companyName.toLowerCase().includes(term)) ||
        (sale.companyID && sale.companyID.toLowerCase().includes(term))
      );
    }
    return true;
  }), [sales, searchTerm]);

  // Render one page at a time — an employee can hold thousands of records.
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedSales = filteredSales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My STS Records</h2>
          {!isLoading && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-xs font-bold text-primary-700 dark:text-primary-400">
              Total Records: {sales.length.toLocaleString()}
              {filteredSales.length !== sales.length && (
                <span className="font-semibold text-primary-600/70 dark:text-primary-400/70">· Showing {filteredSales.length.toLocaleString()}</span>
              )}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Manage and update your assigned leads.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
            placeholder="Search by company name or ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12">
          <Spinner />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          {/* Same layout as the admin STS List: fixed table on wide screens, cards below —
              never a sideways scrollbar. */}
          <StsRecordsView
            rows={pagedSales}
            startIndex={(currentPage - 1) * PAGE_SIZE}
            onOpen={setSelectedRecordForDetails}
            renderActions={(row, withLabels) => (
              <>
                <RecordActionButton icon={Eye} label="View" tone="slate" withLabels={withLabels} onClick={() => setSelectedRecordForDetails(row)} />
                <RecordActionButton icon={PencilLine} label="Update Status" tone="indigo" withLabels={withLabels} onClick={() => setSelectedRecordForStatus(row)} />
              </>
            )}
          />
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredSales.length} onPageChange={setPage} />
        </div>
      )}

      {/* Status Pipeline Modal */}
      <Modal
        isOpen={!!selectedRecordForStatus}
        onClose={() => setSelectedRecordForStatus(null)}
        title="Log STS Update"
        maxWidthClass="max-w-xl"
      >
        {selectedRecordForStatus && (
          <StatusPipelineModal
            salesRecord={selectedRecordForStatus}
            onClose={() => setSelectedRecordForStatus(null)}
            onSuccess={() => {
              setSelectedRecordForStatus(null);
              fetchSales();
            }}
            onUpdateStatus={employeeStsService.updateSalesStatus}
          />
        )}
      </Modal>

      {/* Details Slide-over Drawer */}
      <StsDetailsDrawer
        isOpen={!!selectedRecordForDetails}
        onClose={() => setSelectedRecordForDetails(null)}
        salesRecord={selectedRecordForDetails}
        fetchHistory={employeeStsService.getSalesHistory}
      />
    </div>
  );
};

export default SalesStsList;
