import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, History } from 'lucide-react';
import CurrentMeetings from './CurrentMeetings';
import PastMeetings from './PastMeetings';

const VIEWS = [
  { key: 'current', label: 'Current', icon: CalendarClock },
  { key: 'past', label: 'Past', icon: History },
];

// One "My Meetings" page with a Current / Past switch — the view lives in the URL
// (?view=past) so a refresh or shared link lands on the same view.
const MyMeetings = () => {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'past' ? 'past' : 'current';

  return (
    <div className="space-y-6">
      <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams(key === 'current' ? {} : { view: key }, { replace: true })}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
              view === key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {view === 'past' ? <PastMeetings /> : <CurrentMeetings />}
    </div>
  );
};

export default MyMeetings;
