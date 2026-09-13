import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, History, ArrowLeft, Sparkles, Search, CalendarDays, X } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { stsService } from '../../services/stsService';
import EmployeePicker from '../../components/EmployeePicker';
import MeetingBoard from '../sales/MeetingBoard';
import MeetingCard, { getMeetingDate, isSameDay } from '../sales/MeetingCard';
import StsDetailsDrawer from './sts/StsDetailsDrawer';
import { initials, avatarGradient } from '../../utils/avatar';

const WINDOW_DAYS = 7;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const toDateInputValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Admin's read-only view of one employee's meetings — pick the employee first (same
// picker as Daily Report), then flip between Current (last 7 days) and Past, exactly
// mirroring what that employee sees on their own Current/Past Meetings pages.
const EmployeeMeetings = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedPastDate, setSelectedPastDate] = useState('');

  const [selectedMeetingForDetails, setSelectedMeetingForDetails] = useState(null);
  const [detailsRecord, setDetailsRecord] = useState(null);

  useEffect(() => {
    employeeService.getAllEmployees()
      .then(setEmployees)
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setIsLoadingEmployees(false));
  }, []);

  const fetchMeetings = async (empId) => {
    setIsLoading(true);
    try {
      const data = await employeeService.getEmployeeMeetings(empId);
      setMeetings(data);
    } catch (error) {
      toast.error("Failed to load this employee's meetings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm('');
    setActiveTab('current');
    setSelectedDate(startOfDay(new Date()));
    setSelectedMonth(startOfMonth(new Date()));
    setSelectedPastDate('');
    fetchMeetings(emp.id);
  };

  const backToEmployeeList = () => {
    setSelectedEmployee(null);
    setMeetings([]);
  };

  // The meetings list only carries a lightweight projection — fetch the full record
  // (contact info, address, etc.) before showing it in the details drawer.
  const openRecordDetails = async (record) => {
    setSelectedMeetingForDetails(record);
    try {
      const full = await stsService.getSalesDataById(record.id);
      setDetailsRecord(full);
    } catch (error) {
      toast.error('Failed to load STS details');
      setSelectedMeetingForDetails(null);
    }
  };

  const closeRecordDetails = () => {
    setSelectedMeetingForDetails(null);
    setDetailsRecord(null);
  };

  const today = startOfDay(new Date());
  const currentWindowStart = new Date(today);
  currentWindowStart.setDate(currentWindowStart.getDate() - (WINDOW_DAYS - 1));
  const currentMonth = startOfMonth(today);
  const maxPickableDate = new Date(currentWindowStart);
  maxPickableDate.setDate(maxPickableDate.getDate() - 1);

  const meetingsForDay = useMemo(() => {
    return meetings
      .filter((s) => {
        const meetingDate = getMeetingDate(s);
        return meetingDate && isSameDay(meetingDate, selectedDate);
      })
      .filter((s) => searchTerm
        ? (s.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true)
      .sort((a, b) => getMeetingDate(b) - getMeetingDate(a));
  }, [meetings, selectedDate, searchTerm]);

  const meetingsForMonth = useMemo(() => {
    const pickedDay = selectedPastDate ? new Date(`${selectedPastDate}T00:00:00`) : null;
    return meetings
      .filter((s) => {
        const meetingDate = getMeetingDate(s);
        if (!meetingDate) return false;
        if (meetingDate >= currentWindowStart) return false;
        return pickedDay ? isSameDay(meetingDate, pickedDay) : sameMonth(meetingDate, selectedMonth);
      })
      .filter((s) => searchTerm
        ? (s.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true)
      .sort((a, b) => getMeetingDate(b) - getMeetingDate(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings, selectedMonth, selectedPastDate, searchTerm]);

  const dayDateLabel = isSameDay(selectedDate, today)
    ? 'Today'
    : isSameDay(selectedDate, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))
      ? 'Yesterday'
      : selectedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const dayFullDateLabel = selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shiftDay = (delta) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const monthDateLabel = selectedPastDate
    ? new Date(`${selectedPastDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const monthSubLabel = selectedPastDate ? 'Showing one specific date — clear it to browse by month again' : null;
  const shiftMonth = (delta) => {
    setSelectedPastDate('');
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  if (!selectedEmployee) {
    return (
      <EmployeePicker
        employees={employees}
        isLoading={isLoadingEmployees}
        onSelect={handleSelectEmployee}
        icon={CalendarClock}
        title="Employee Meetings"
        subtitle="Pick a team member to see every meeting they've fixed — current and past, online and offline."
      />
    );
  }

  const employeeName = selectedEmployee.fullName || selectedEmployee.email;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${avatarGradient(selectedEmployee.id)} text-white flex items-center justify-center font-black text-lg shadow-md`}>
              {initials(employeeName)}
            </div>
            <div>
              <button
                onClick={backToEmployeeList}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 mb-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Switch employee
              </button>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                {employeeName}&rsquo;s Meetings
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse shrink-0" />
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 max-w-2xl">
                {selectedEmployee.department ? `${selectedEmployee.department} · ` : ''}Every meeting {employeeName} has fixed, online or offline.
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === 'current'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <CalendarClock className="w-4 h-4" /> Current
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === 'past'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" /> Past
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'current' ? (
        <MeetingBoard
          icon={CalendarClock}
          dateLabel={dayDateLabel}
          subLabel={dayFullDateLabel}
          count={meetingsForDay.length}
          onPrev={() => shiftDay(-1)}
          onNext={() => shiftDay(1)}
          canGoPrev={selectedDate > new Date(currentWindowStart)}
          canGoNext={selectedDate < today}
          isLoading={isLoading}
          emptyIcon={CalendarClock}
          emptyTitle="No meetings this day"
          emptyMessage={`Nothing was fixed for this date. Use the arrows to check other days.`}
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
            <MeetingCard key={record.id} record={record} onView={() => openRecordDetails(record)} />
          ))}
        </MeetingBoard>
      ) : (
        <MeetingBoard
          icon={History}
          dateLabel={monthDateLabel}
          subLabel={monthSubLabel}
          count={meetingsForMonth.length}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          canGoNext={selectedMonth < currentMonth}
          isLoading={isLoading}
          emptyIcon={History}
          emptyTitle="No meetings found"
          emptyMessage={selectedPastDate ? 'Nothing was fixed on this exact date — clear it to browse the whole month.' : 'Nothing fixed in this month yet — try a different month with the arrows.'}
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
                  value={selectedPastDate}
                  onChange={(e) => setSelectedPastDate(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm transition-colors duration-300"
                />
              </div>
              {selectedPastDate && (
                <button
                  onClick={() => setSelectedPastDate('')}
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
            <MeetingCard key={record.id} record={record} onView={() => openRecordDetails(record)} />
          ))}
        </MeetingBoard>
      )}

      {/* Details Slide-over Drawer */}
      <StsDetailsDrawer
        isOpen={!!selectedMeetingForDetails}
        onClose={closeRecordDetails}
        salesRecord={detailsRecord}
        fetchHistory={stsService.getSalesHistory}
      />
    </div>
  );
};

export default EmployeeMeetings;
