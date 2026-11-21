import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// The "big box": one titled, date-scoped panel with its own internal scroll — holds a dense
// grid of small meeting tiles instead of spreading them across the whole page as a table/list.
const MeetingBoard = ({ icon: Icon, dateLabel, subLabel, count, onPrev, onNext, canGoPrev = true, canGoNext = true, extra, isLoading, emptyIcon: EmptyIcon, emptyTitle, emptyMessage, children }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none overflow-hidden transition-colors duration-300">
      {/* Board header / date switcher */}
      <div className="relative overflow-hidden px-4 sm:px-6 py-5 sm:py-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 flex flex-wrap items-center justify-between gap-4">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 15% 30%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <div className="relative z-10 flex items-center gap-3 sm:gap-4 min-w-0">
          {Icon && (
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center shadow-lg shrink-0">
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-1">
              {onPrev && (
                <button
                  onClick={onPrev}
                  disabled={!canGoPrev}
                  className="p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">{dateLabel}</h3>
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canGoNext}
                  className="p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <span className="ml-1.5 inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/20">
                {count} meeting{count !== 1 ? 's' : ''}
              </span>
            </div>
            {subLabel && (
              <p className="text-xs font-semibold text-blue-100/80 mt-1">{subLabel}</p>
            )}
          </div>
        </div>
        {extra && <div className="relative z-10 max-w-full sm:shrink-0">{extra}</div>}
      </div>

      {/* Scrollable content */}
      <div className="p-3 sm:p-5 max-h-[65vh] overflow-y-auto bg-gray-50/40 dark:bg-slate-900/20">
        {isLoading ? (
          <div className="py-10 sm:py-16 flex justify-center text-gray-400 dark:text-slate-500 text-sm">Loading…</div>
        ) : count === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center">
            {EmptyIcon && (
              <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-700 shadow-sm mb-3">
                <EmptyIcon className="w-7 h-7 text-gray-400 dark:text-slate-500" />
              </div>
            )}
            <h4 className="font-bold text-gray-900 dark:text-white">{emptyTitle}</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xs">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingBoard;
