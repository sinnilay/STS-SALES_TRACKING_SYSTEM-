import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Pagination from '../../../components/Pagination';
import { Link } from 'react-router-dom';
import { Plus, Search, ClipboardList, Upload, Download, AlertTriangle, UserMinus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { State, City } from 'country-state-city';
import { stsService } from '../../../services/stsService';
import StsRecordsView from './StsRecordsView';
import Button from '../../../components/Button';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import AllocateModal from './AllocateModal';
import StatusPipelineModal from './StatusPipelineModal';
import ImportStsModal from './ImportStsModal';
import StsDetailsDrawer from './StsDetailsDrawer';
import EditStsForm from './EditStsForm';
import AssignRecordsForm from './AssignRecordsForm';
import DeAssignRecordsForm from './DeAssignRecordsForm';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const PAGE_SIZE = 25;

const selectClass = 'block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed';

const StsList = () => {
  // Only the current page is held in memory; filtering and paging happen on the server.
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileType, setProfileType] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeAssignModalOpen, setIsDeAssignModalOpen] = useState(false);
  const [selectedRecordForAllocate, setSelectedRecordForAllocate] = useState(null);
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebouncedValue(searchTerm.trim());

  // Full India state list; cities load for the selected state.
  const stateOptions = useMemo(() => State.getStatesOfCountry('IN'), []);
  const stateIso = stateOptions.find((st) => st.name === stateFilter)?.isoCode;
  const cityOptions = useMemo(
    () => (stateIso
      ? [...new Set(City.getCitiesOfState('IN', stateIso).map((c) => c.name))].sort((a, b) => a.localeCompare(b))
      : []),
    [stateIso]
  );

  const filters = useMemo(() => ({
    search: debouncedSearch || undefined,
    profileType: profileType || undefined,
    city: cityFilter || undefined,
    // State only narrows the city list; the server also matches records whose city is in
    // the state, since many imported records have a city but no state filled in.
    state: !cityFilter && stateFilter ? stateFilter : undefined,
    stateCities: !cityFilter && stateFilter ? cityOptions : undefined,
  }), [debouncedSearch, profileType, cityFilter, stateFilter, cityOptions]);

  // Ignore responses that arrive after a newer request was sent (fast typing / paging).
  const latestRequest = useRef(0);

  const fetchSales = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsFetching(true);
    try {
      const data = await stsService.querySales({ ...filters, page, pageSize: PAGE_SIZE });
      if (requestId !== latestRequest.current) return;
      setSales(data.items);
      setTotal(data.total);
      setGrandTotal(data.grandTotal);
      if (data.page !== page) setPage(data.page);
    } catch (error) {
      if (requestId === latestRequest.current) toast.error('Failed to fetch sales records');
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [filters, page]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // A new search starts back on page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await stsService.deleteSalesData(recordToDelete.id);
      toast.success('STS record deleted');
      setRecordToDelete(null);
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete STS record');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = !!(searchTerm || profileType || stateFilter || cityFilter);

  const clearFilters = () => {
    setSearchTerm('');
    setProfileType('');
    setStateFilter('');
    setCityFilter('');
    setPage(1);
  };

  const handleExport = async () => {
    if (total === 0) {
      toast.error('No records to export');
      return;
    }

    setIsExporting(true);
    let records;
    try {
      records = (await stsService.querySales({ ...filters, all: true })).items;
    } catch (error) {
      toast.error('Failed to export records');
      return;
    } finally {
      setIsExporting(false);
    }

    const rows = records.map((r) => ({
      'Profile ID': r.companyID || '',
      'Company Name': r.companyName || '',
      'Contact Person': r.contactPerson || '',
      'Designation': r.designation || '',
      'Owner Name': r.ownerName || '',
      'Phone Number': r.phoneNumber || '',
      'Mobile 1': r.mobile1 || '',
      'Mobile 2': r.mobile2 || '',
      'Fax': r.fax || '',
      'Email': r.email || '',
      'Website': r.website || '',
      'Address 1': r.address1 || '',
      'Address 2': r.address2 || '',
      'City': r.cityDistrict || '',
      'State': r.state || '',
      'Pincode': r.pincode || '',
      'Country': r.country || '',
      'Priority': r.priority || '',
      'Source': r.source || '',
      'Lead By': r.leadBy || '',
      'Business Description': r.businessDescription || '',
      'Opening Comments': r.openingComments || '',
      'Status': r.status || 'New',
      'Service Taken': r.serviceTaken || '',
      'Service Price': r.servicePrice != null ? r.servicePrice : '',
      'Service Date': r.serviceDate ? new Date(r.serviceDate).toLocaleDateString() : '',
      'Created Date': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
      'Last Action Date': r.lastActionDate ? new Date(r.lastActionDate).toLocaleDateString() : '',
      'Next Action Date': r.nextActionDate ? new Date(r.nextActionDate).toLocaleDateString() : '',
      'Created By': r.employee?.fullName || '',
      'Allocated To': r.allocatedTo?.fullName || '',
      'Allocated To Email': r.allocatedTo?.email || '',
      'Allocated To Department': r.allocatedTo?.department || '',
      'Tele Executive': r.teleExecutive?.fullName || '',
      'Marketing Executive': r.marketingExecutive?.fullName || '',
      'Allocation Comment': r.allocatorComment || '',
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sts-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} record${rows.length !== 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col min-[1360px]:flex-row justify-between items-start min-[1360px]:items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">STS Records</h2>
            {!isLoading && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-xs font-bold text-primary-700 dark:text-primary-400">
                Total Records: {grandTotal.toLocaleString()}
                {total !== grandTotal && (
                  <span className="font-semibold text-primary-600/70 dark:text-primary-400/70">· Showing {total.toLocaleString()}</span>
                )}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">View and manage all sales tracking records.</p>
        </div>
        <div className="grid grid-cols-2 w-full sm:w-auto sm:flex sm:flex-wrap gap-2 sm:gap-3 [&_button]:whitespace-nowrap">
          <Button variant="secondary" onClick={() => setIsAssignModalOpen(true)}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Assign
          </Button>
          <Button variant="secondary" onClick={() => setIsDeAssignModalOpen(true)}>
            <UserMinus className="w-4 h-4 mr-2" />
            De-Assign
          </Button>
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="secondary" onClick={handleExport} isLoading={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Link to="/admin/sts/add" className="col-span-2 sm:col-auto">
            <Button variant="primary" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative w-full xl:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
              placeholder="Search by company, profile ID or employee email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto xl:flex-1">
            <select
              className={selectClass}
              value={profileType}
              onChange={(e) => { setProfileType(e.target.value); setPage(1); }}
            >
              <option value="">All Profile IDs</option>
              <option value="NC">NC Profiles</option>
              <option value="EC">EC Profiles</option>
            </select>
            <select
              className={selectClass}
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setCityFilter(''); setPage(1); }}
            >
              <option value="">All States</option>
              {stateOptions.map((st) => (
                <option key={st.isoCode} value={st.name}>{st.name}</option>
              ))}
            </select>
            <select
              className={selectClass}
              value={cityFilter}
              disabled={!stateIso}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
            >
              <option value="">{stateIso ? 'All Cities' : 'Select a state first'}</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12">
          <Spinner />
        </div>
      ) : (
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-all duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          <StsRecordsView
            rows={sales}
            startIndex={(page - 1) * PAGE_SIZE}
            onOpen={setSelectedRecordForDetails}
            onStatus={setSelectedRecordForStatus}
            onEdit={setSelectedRecordForEdit}
            onAllocate={setSelectedRecordForAllocate}
            onDelete={setRecordToDelete}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Sales Records"
      >
        <ImportStsModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchSales();
          }}
        />
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign STS Records"
        maxWidthClass="max-w-5xl"
      >
        {isAssignModalOpen && (
          <AssignRecordsForm
            onClose={() => setIsAssignModalOpen(false)}
            onSuccess={() => {
              setIsAssignModalOpen(false);
              fetchSales();
            }}
          />
        )}
      </Modal>

      {/* Bulk De-Assign Modal */}
      <Modal
        isOpen={isDeAssignModalOpen}
        onClose={() => setIsDeAssignModalOpen(false)}
        title="De-Assign STS Records"
        maxWidthClass="max-w-5xl"
      >
        {isDeAssignModalOpen && (
          <DeAssignRecordsForm
            onClose={() => setIsDeAssignModalOpen(false)}
            onSuccess={() => {
              setIsDeAssignModalOpen(false);
              fetchSales();
            }}
          />
        )}
      </Modal>

      {/* Allocate Modal */}
      <Modal
        isOpen={!!selectedRecordForAllocate}
        onClose={() => setSelectedRecordForAllocate(null)}
        title={`Allocate Record: ${selectedRecordForAllocate?.companyName}`}
      >
        {selectedRecordForAllocate && (
          <AllocateModal
            salesRecord={selectedRecordForAllocate}
            onClose={() => setSelectedRecordForAllocate(null)}
            onSuccess={() => {
              setSelectedRecordForAllocate(null);
              fetchSales();
            }}
          />
        )}
      </Modal>

      {/* Edit Details Modal */}
      <Modal
        isOpen={!!selectedRecordForEdit}
        onClose={() => setSelectedRecordForEdit(null)}
        title={`Edit — ${selectedRecordForEdit?.companyName || ''}`}
        maxWidthClass="max-w-3xl"
      >
        {selectedRecordForEdit && (
          <EditStsForm
            record={selectedRecordForEdit}
            onClose={() => setSelectedRecordForEdit(null)}
            onSuccess={() => {
              setSelectedRecordForEdit(null);
              fetchSales();
            }}
          />
        )}
      </Modal>

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
            isAdmin
            onClose={() => setSelectedRecordForStatus(null)}
            onSuccess={() => {
              setSelectedRecordForStatus(null);
              fetchSales();
            }}
          />
        )}
      </Modal>

      {/* Details Slide-over Drawer */}
      <StsDetailsDrawer
        isOpen={!!selectedRecordForDetails}
        onClose={() => setSelectedRecordForDetails(null)}
        salesRecord={selectedRecordForDetails}
        fetchHistory={stsService.getSalesHistory}
        onUpdateStatus={stsService.updateSalesStatus}
        onUpdated={async () => {
          if (!selectedRecordForDetails) return;
          try {
            const record = await stsService.getSalesDataById(selectedRecordForDetails.id);
            setSelectedRecordForDetails(record);
          } catch (error) {
            toast.error('Failed to refresh STS details');
          }
          fetchSales();
        }}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!recordToDelete}
        onClose={() => !isDeleting && setRecordToDelete(null)}
        title="Delete STS Record"
        maxWidthClass="max-w-md"
      >
        {recordToDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                This will permanently delete <strong>{recordToDelete.companyName}</strong> ({recordToDelete.companyID}) along with its update history and site images. This cannot be undone.
              </span>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setRecordToDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                isLoading={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StsList;
