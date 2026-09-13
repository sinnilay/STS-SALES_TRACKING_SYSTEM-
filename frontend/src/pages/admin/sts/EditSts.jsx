import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Pencil, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import Table from '../../../components/Table';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import { getStatusMeta } from '../../../constants/stsPipeline';
import EditStsForm from './EditStsForm';

const EditSts = () => {
  const { id: routeId } = useParams();
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await stsService.getAllSales();
      setRecords(data);
      if (routeId) {
        const match = data.find((r) => String(r.id) === String(routeId));
        if (match) setEditing(match);
      }
    } catch (error) {
      toast.error('Failed to load STS records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((r) =>
      [r.companyName, r.companyID, r.email, r.mobile1, r.phoneNumber, r.cityDistrict, r.contactPerson]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term))
    );
  }, [records, search]);

  const columns = [
    { header: '#', render: (row) => filtered.indexOf(row) + 1 },
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
        <p className="mt-2 text-xs text-gray-400">{filtered.length} of {records.length} records</p>
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : (
        <Table
          columns={columns}
          data={filtered}
          renderActions={(row) => (
            <button
              onClick={() => setEditing(row)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        />
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
