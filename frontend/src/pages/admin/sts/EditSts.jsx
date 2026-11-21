import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Pencil, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import Table from '../../../components/Table';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import Pagination from '../../../components/Pagination';
import { getStatusMeta } from '../../../constants/stsPipeline';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import EditStsForm from './EditStsForm';

const PAGE_SIZE = 25;

const EditSts = () => {
  const { id: routeId } = useParams();
  // Only the current page is held in memory; searching and paging happen on the server.
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const debouncedSearch = useDebouncedValue(search.trim());

  // Ignore responses that arrive after a newer request was sent.
  const latestRequest = useRef(0);

  const fetchRecords = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsFetching(true);
    try {
      const data = await stsService.querySales({
        search: debouncedSearch || undefined,
        searchContacts: true,
        page,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== latestRequest.current) return;
      setRecords(data.items);
      setTotal(data.total);
      setGrandTotal(data.grandTotal);
      if (data.page !== page) setPage(data.page);
    } catch (error) {
      if (requestId === latestRequest.current) toast.error('Failed to load STS records');
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // A new search starts back on page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Deep link (/admin/sts/edit/:id) opens that record straight away.
  useEffect(() => {
    if (!routeId) return;
    stsService.getSalesDataById(routeId)
      .then(setEditing)
      .catch(() => toast.error('Failed to load the STS record'));
  }, [routeId]);

  const columns = [
    { header: '#', render: (row, index) => (page - 1) * PAGE_SIZE + index + 1 },
    { header: 'Profile ID', render: (row) => <span className="font-mono text-xs">{row.companyID}</span> },
    { header: 'Company Name', render: (row) => <span className="font-semibold text-gray-900 dark:text-white">{row.companyName}</span> },
    { header: 'Contact', render: (row) => (
      <div className="text-xs">
        <div>{row.contactPerson || '—'}</div>
        <div className="text-gray-400">{row.mobile1 || row.phoneNumber || '—'}</div>
      </div>
    ) },
    { header: 'City', render: (row) => row.cityDistrict || '—' },
    { header: 'Status', render: (row) => {
      const m = getStatusMeta(row.status);
      return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${m.badge}`}>{m.label}</span>;
    } },
    { header: 'Allotted To', render: (row) => row.allocatedTo?.fullName || row.teleExecutive?.fullName || row.marketingExecutive?.fullName || <span className="text-gray-400">Unassigned</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileEdit className="w-6 h-6 text-primary-500" /> Edit STS Records
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Search for an STS and update its full details.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="relative max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, profile ID, email, mobile, city, contact..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
          />
        </div>
        <p className="mt-2 text-xs text-gray-400">{total.toLocaleString()} of {grandTotal.toLocaleString()} records</p>
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <div className={`transition-opacity ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          <Table
            columns={columns}
            data={records}
            renderActions={(row) => (
              <button
                onClick={() => setEditing(row)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit — ${editing.companyName}` : 'Edit STS'}
        maxWidthClass="max-w-3xl"
      >
        {editing && (
          <EditStsForm
            record={editing}
            onClose={() => setEditing(null)}
            onSuccess={() => {
              setEditing(null);
              fetchRecords();
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default EditSts;
