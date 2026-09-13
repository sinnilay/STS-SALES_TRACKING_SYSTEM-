import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Search } from 'lucide-react';
import { employeeStsService } from '../../services/employeeStsService';
import Modal from '../../components/Modal';
import StatusPipelineModal from '../admin/sts/StatusPipelineModal';
import StsDetailsDrawer from '../admin/sts/StsDetailsDrawer';
import MeetingCard, { getMeetingDate, isSameDay } from './MeetingCard';
import MeetingBoard from './MeetingBoard';
import SiteImagesModal from './SiteImagesModal';

const WINDOW_DAYS = 7;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const CurrentMeetings = () => {
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedRecordForStatus, setSelectedRecordForStatus] = useState(null);
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState(null);
  const [selectedRecordForImages, setSelectedRecordForImages] = useState(null);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const data = await employeeStsService.getAssignedSales();
      setSales(data);
    } catch (error) {
      toast.error('Failed to load your meetings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSales(); }, []);

  const today = startOfDay(new Date());
  const earliestDay = new Date(today);
  earliestDay.setDate(earliestDay.getDate() - (WINDOW_DAYS - 1));

  const meetingsForDay = useMemo(() => {
    return sales
      .filter((s) => {
        const meetingDate = getMeetingDate(s);
        return meetingDate && isSameDay(meetingDate, selectedDate);
      })
      .filter((s) => searchTerm
        ? (s.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true)
      .sort((a, b) => getMeetingDate(b) - getMeetingDate(a));
  }, [sales, selectedDate, searchTerm]);

  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const dateLabel = isSameDay(selectedDate, today)
    ? 'Today'
    : isSameDay(selectedDate, yesterday)
      ? 'Yesterday'
      : selectedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const fullDateLabel = selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const shiftDay = (delta) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Current Meetings
            <CalendarClock className="w-7 h-7 text-primary-500" />
          </h2>
          <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
            Meetings scheduled in the last {WINDOW_DAYS} days. Click the arrows to flip through each day, or search
            within it.
          </p>
        </div>
      </div>

      <MeetingBoard
        icon={CalendarClock}
        dateLabel={dateLabel}
        subLabel={fullDateLabel}
        count={meetingsForDay.length}
        onPrev={() => shiftDay(-1)}
        onNext={() => shiftDay(1)}
        canGoPrev={selectedDate > earliestDay}
        canGoNext={selectedDate < today}
        isLoading={isLoading}
        emptyIcon={CalendarClock}
        emptyTitle="No meetings this day"
        emptyMessage="Nothing was marked 'Meeting Scheduled' for this date. Use the arrows to check other days, or schedule one from My STS Records."
        extra={
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              className="block w-56 pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
              placeholder="Search this day..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      >
        {meetingsForDay.map((record) => (
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

export default CurrentMeetings;
