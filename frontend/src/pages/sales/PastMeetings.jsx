import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { History, Search, CalendarDays, X } from 'lucide-react';
import { employeeStsService } from '../../services/employeeStsService';
import Modal from '../../components/Modal';
import StatusPipelineModal from '../admin/sts/StatusPipelineModal';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import MeetingCard, { getMeetingDate, isSameDay } from './MeetingCard';
import MeetingBoard from './MeetingBoard';
import SiteImagesModal from './SiteImagesModal';

const toDateInputValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const WINDOW_DAYS = 7;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const PastMeetings = () => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForImages, setSelectedRecordForImages] = useState(null);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const data = await employeeStsService.getAssignedSales();
      setSales(data);
    } catch (error) {
      toast.error('Failed to load your meeting history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSales(); }, []);

  const today = startOfDay(new Date());
  const currentWindowStart = new Date(today);
  currentWindowStart.setDate(currentWindowStart.getDate() - (WINDOW_DAYS - 1));
  const currentMonth = startOfMonth(today);
  const maxPickableDate = new Date(currentWindowStart);
  maxPickableDate.setDate(maxPickableDate.getDate() - 1);

  const meetingsForMonth = useMemo(() => {
    const pickedDay = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;
    return sales
      .filter((s) => {
        const meetingDate = getMeetingDate(s);
        if (!meetingDate) return false;
        // Keep "Past" and "Current" mutually exclusive — anything within the live 7-day window belongs there.
        if (meetingDate >= currentWindowStart) return false;
        return pickedDay ? isSameDay(meetingDate, pickedDay) : sameMonth(meetingDate, selectedMonth);
      })
      .filter((s) => searchTerm
        ? (s.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true)
      .sort((a, b) => getMeetingDate(b) - getMeetingDate(a));
  }, [sales, selectedMonth, selectedDate, searchTerm]);

  const dateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const subLabel = selectedDate ? 'Showing one specific date — clear it to browse by month again' : null;

  const shiftMonth = (delta) => {
    setSelectedDate('');
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Past Meetings
            <History className="w-7 h-7 text-primary-500" />
          </h2>
          <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
            Everything scheduled more than {WINDOW_DAYS} days ago. Browse a whole month with the arrows, jump
            straight to one date, or search by company name/ID.
          </p>
        </div>
      </div>

      <MeetingBoard
        icon={History}
        dateLabel={dateLabel}
        subLabel={subLabel}
        count={meetingsForMonth.length}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        canGoNext={selectedMonth < currentMonth}
        isLoading={isLoading}
        emptyIcon={History}
        emptyTitle="No meetings found"
        emptyMessage={selectedDate ? 'Nothing was scheduled on this exact date — clear it to browse the whole month.' : 'Nothing scheduled in this month yet — try a different month with the arrows.'}
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                className="block w-48 pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
                placeholder="Search by name/ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarDays className="h-4 w-4 text-gray-400 dark:text-slate-500" />
              </div>
              <input
                type="date"
                max={toDateInputValue(maxPickableDate)}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300"
              />
            </div>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
                title="Clear date, browse by month"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        }
      >
        {meetingsForMonth.map((record) => (
          <MeetingCard
            key={record.id}
            record={record}
            onView={() => setSelectedRecordForDetails(record)}
            onUpdateStatus={() => setSelectedRecordForStatus(record)}
            onViewImages={() => setSelectedRecordForImages(record)}
          />
        ))}
      </MeetingBoard>

      {/* Site Images Modal */}
      <Modal
        isOpen={!!selectedRecordForImages}
        onClose={() => setSelectedRecordForImages(null)}
        title="Site Images"
        maxWidthClass="max-w-lg"
      >
        {selectedRecordForImages && (
          <SiteImagesModal
            subtitle={`${selectedRecordForImages.companyName} (${selectedRecordForImages.companyID})`}
            fetchImages={() => employeeStsService.getSiteImages(selectedRecordForImages.id)}
            onUpload={(file, method) => employeeStsService.uploadSiteImage(selectedRecordForImages.id, file, method)}
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

export default PastMeetings;
