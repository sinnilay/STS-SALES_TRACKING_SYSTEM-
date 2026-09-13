import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, ClipboardList, Upload, Download, Pencil, Trash2, AlertTriangle, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { stsService } from '../../../services/stsService';
import Table from '../../../components/Table';
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

const StsList = () => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeAssignModalOpen, setIsDeAssignModalOpen] = useState(false);
  const [selectedRecordForAllocate, setSelectedRecordForAllocate] = useState(null);
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const data = await stsService.getAllSales();
      setSales(data);
    } catch (error) {
      toast.error('Failed to fetch sales records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

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

  const filteredSales = sales.filter((sale) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (sale.companyName && sale.companyName.toLowerCase().includes(term)) ||
        (sale.employee?.fullName && sale.employee.fullName.toLowerCase().includes(term)) ||
        (sale.employee?.email && sale.employee.email.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const handleExport = () => {
    if (filteredSales.length === 0) {
      toast.error('No records to export');
      return;
    }

    const rows = filteredSales.map((r) => ({
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

  const columns = [
    { 
      header: 'Sr No.', 
      render: (row, index) => index + 1 
    },
    { header: 'Profile ID', accessor: 'companyID' },
    { 
      header: 'Company Name', 
      render: (row) => (
        <a href="#" className="text-blue-600 hover:underline">{row.companyName}</a>
      )
    },
    { header: 'Source', render: (row) => row.source || 'N/A' },
    { 
      header: 'Created Date', 
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    },
    { 
      header: 'Last Action', 
      render: (row) => row.lastActionDate ? new Date(row.lastActionDate).toLocaleDateString() : 'N/A'
    },
    { 
      header: 'Status', 
      render: (row) => (
        <span className="text-blue-600 font-medium">
          {row.status || 'New'}
        </span>
      )
    },
    {
      header: 'Allotted To',
      render: (row) => {
        const isAllocatedToTelecaller = row.allocatedTo?.employeeRole === 'Tele Sales';
        const salesTeamName = row.allocatedTo && !isAllocatedToTelecaller ? row.allocatedTo.fullName : 'N/A';
        const telecallerTeamName = isAllocatedToTelecaller
          ? row.allocatedTo.fullName
          : (row.teleExecutive ? row.teleExecutive.fullName : 'N/A');
        return (
          <div className="text-xs space-y-1">
            <div><span className="font-semibold text-gray-500">Sales Team:</span> {salesTeamName}</div>
            <div><span className="font-semibold text-gray-500">Telecaller Team:</span> {telecallerTeamName}</div>
          </div>
        );
      }
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">STS Records</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">View and manage all sales tracking records.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
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
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Link to="/admin/sts/add">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
            placeholder="Search by title or employee email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12">
          <Spinner />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <Table
            columns={columns}
            data={filteredSales}
            onRowClick={(row) => setSelectedRecordForDetails(row)}
            renderActions={(row) => {
              const isAllocated = !!(row.allocatedTo || row.teleExecutive || row.marketingExecutive);
              return (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedRecordForStatus(row)}
                    className="p-1.5 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                    title="View Status"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedRecordForEdit(row)}
                    className="p-1.5 rounded-lg transition-colors text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    title="Edit Details"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <div className="relative group/allocate">
                    <button
                      onClick={() => !isAllocated && setSelectedRecordForAllocate(row)}
                      disabled={isAllocated}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isAllocated
                          ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                          : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      }`}
                    >
                      <ClipboardList className="w-5 h-5" />
                    </button>
                    <div className="pointer-events-none absolute right-0 bottom-full mb-1.5 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/allocate:opacity-100">
                      {isAllocated ? 'Already Allocated' : 'Assign Action'}
                    </div>
                  </div>
                  <button
                    onClick={() => setRecordToDelete(row)}
                    className="p-1.5 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete Record"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            }}
          />
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
        maxWidthClass="max-w-4xl"
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
