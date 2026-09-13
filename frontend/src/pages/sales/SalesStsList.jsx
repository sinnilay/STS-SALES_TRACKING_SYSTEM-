import React, { useState, useEffect } from 'react';
import { Search, Eye, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeStsService } from '../../services/employeeStsService';
import { profileService } from '../../services/profileService';
import Table from '../../components/Table';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import StatusPipelineModal from '../admin/sts/StatusPipelineModal';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import ScheduleMeetingModal from './ScheduleMeetingModal';

const SalesStsList = () => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForMeeting, setSelectedRecordForMeeting] = useState(null);
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
  const canScheduleMeetings = myEmployeeRole === 'Field Sales' || myEmployeeRole === 'Tele Sales';

  // After a meeting is fixed, optionally chain straight into the status update form.
  const handleMeetingScheduled = (updateStatusToo) => {
    const scheduledRecord = selectedRecordForMeeting;
    setSelectedRecordForMeeting(null);
    fetchSales();
    if (updateStatusToo && scheduledRecord) {
      setSelectedRecordForStatus(scheduledRecord);
    }
  };

  const filteredSales = sales.filter((sale) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (sale.companyName && sale.companyName.toLowerCase().includes(term)) ||
        (sale.companyID && sale.companyID.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const columns = [
    { header: 'Comp ID', accessor: 'companyID' },
    { header: 'Company Name', accessor: 'companyName' },
    { header: 'City/District', accessor: 'cityDistrict' },
    { 
      header: 'Status', 
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.status || 'New'}
        </span>
      )
    },
    { 
      header: 'Fedded By', 
      render: (row) => row.employee ? row.employee.fullName || row.employee.email : 'N/A' 
    },
    { 
      header: 'Date Assigned', 
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My STS Records</h2>
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
            renderActions={(row) => (
              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {canScheduleMeetings && (
                  <button
                    onClick={() => setSelectedRecordForMeeting(row)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors font-medium text-sm ${
                      row.meetingScheduledAt
                        ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        : 'text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40'
                    }`}
                    title={row.meetingScheduledAt ? `${row.meetingMode || 'Meeting'} scheduled ${new Date(row.meetingScheduledAt).toLocaleString()} — click to reschedule` : 'Fix an online or offline meeting for this lead'}
                  >
                    <CalendarClock className="w-4 h-4" />
                    {row.meetingScheduledAt ? 'Meeting Scheduled' : 'Fix the Meeting'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedRecordForStatus(row)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 font-medium text-sm"
                  title="Update Status"
                >
                  <Eye className="w-4 h-4" />
                  Update Status
                </button>
              </div>
            )}
          />
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

      {/* Fix the Meeting Modal */}
      <Modal
        isOpen={!!selectedRecordForMeeting}
        onClose={() => setSelectedRecordForMeeting(null)}
        title="Fix the Meeting"
        maxWidthClass="max-w-md"
      >
        {selectedRecordForMeeting && (
          <ScheduleMeetingModal
            salesRecord={selectedRecordForMeeting}
            onClose={() => setSelectedRecordForMeeting(null)}
            onScheduled={handleMeetingScheduled}
          />
        )}
      </Modal>
    </div>
  );
};

export default SalesStsList;
