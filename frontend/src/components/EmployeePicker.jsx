import React, { useState, useMemo } from 'react';
import { Search, Sparkles, ChevronRight, Users, X, SlidersHorizontal } from 'lucide-react';
import Spinner from './Spinner';
import { initials, avatarGradient } from '../utils/avatar';

// Step-1 "pick an employee" screen — shared by every Admin page that scopes its
// content to one employee at a time (Daily Report, Meetings, …), so the picking
// experience stays identical everywhere it's used.
const EmployeePicker = ({ employees, isLoading, onSelect, icon: Icon = Users, title, subtitle, searchPlaceholder = 'Search employees by name, email, or department...' }) => {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [designation, setDesignation] = useState('');

  const uniqueSorted = (key) =>
    [...new Set(employees.map((e) => (e[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const departments = useMemo(() => uniqueSorted('department'), [employees]);
  const cities = useMemo(() => uniqueSorted('cityBranch'), [employees]);
  const designations = useMemo(() => uniqueSorted('designation'), [employees]);

  const hasFilters = !!(query.trim() || department || city.trim() || designation);

  // Nothing is listed until the admin searches or picks a filter — avoids
  // dumping the whole company on screen at once.
  const filtered = useMemo(() => {
    if (!hasFilters) return [];
    const q = query.trim().toLowerCase();
    return employees.filter((emp) =>
      (!department || (emp.department || '').trim() === department) &&
      (!city.trim() || (emp.cityBranch || '').toLowerCase().includes(city.trim().toLowerCase())) &&
      (!designation || (emp.designation || '').trim() === designation) &&
      (!q ||
        (emp.fullName || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q))
    );
  }, [employees, query, department, city, designation, hasFilters]);

  const clearAll = () => { setQuery(''); setDepartment(''); setCity(''); setDesignation(''); };

  const selectClass = 'w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm shadow-sm focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors duration-300';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-5 sm:p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start gap-4 flex-wrap">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white shadow-lg shadow-primary-500/20">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              {title}
              <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            </h2>
            <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm shadow-sm transition-colors duration-300"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div>
          <input
            type="text"
            list="employee-picker-cities"
            className={selectClass}
            placeholder="Type a city..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <datalist id="employee-picker-cities">
            {cities.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <select className={selectClass} value={designation} onChange={(e) => setDesignation(e.target.value)}>
          <option value="">All Designations</option>
          {designations.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          onClick={clearAll}
          disabled={!hasFilters}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <X className="w-4 h-4" /> Clear filters
        </button>
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : !hasFilters ? (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors duration-300">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 mb-4">
            <SlidersHorizontal className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose a filter to see employees</h3>
          <p className="text-gray-500 dark:text-slate-400 mt-1 max-w-sm">Select a department, city or designation — or search by name — to list matching employees.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors duration-300">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 mb-4">
            <Users className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No employees found</h3>
          <p className="text-gray-500 dark:text-slate-400 mt-1 max-w-sm">Try different filters or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <button
              key={emp.id}
              onClick={() => onSelect(emp)}
              className="group flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-500/40 transition-all duration-200 text-left"
            >
              <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${avatarGradient(emp.id)} text-white flex items-center justify-center font-black text-sm shadow-md`}>
                {initials(emp.fullName || emp.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 dark:text-white truncate">{emp.fullName || emp.email}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{emp.department || emp.email}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeePicker;
