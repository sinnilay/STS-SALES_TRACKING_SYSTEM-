import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

/**
 * Dropdown whose options each carry their own delete button (a native <select>
 * cannot render buttons inside options). Options without an `id` are built-ins
 * and cannot be deleted.
 *
 * options: [{ id?, name }]
 */
const DeletableSelect = ({ value, onChange, options, placeholder, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const itemClass = 'flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-slate-800';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50/60 dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 flex items-center justify-between text-left transition focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15"
      >
        <span className={value ? '' : 'text-gray-500'}>{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <ul className="absolute z-20 mt-1.5 w-full max-h-60 overflow-auto rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl shadow-black/10 text-sm text-gray-900 dark:text-slate-100">
          <li
            className={`${itemClass} text-gray-500`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {placeholder}
          </li>
          {options.map((o) => (
            <li
              key={o.id ?? o.name}
              className={itemClass}
              onClick={() => { onChange(o.name); setOpen(false); }}
            >
              <span>{o.name}</span>
              {o.id != null && (
                <button
                  type="button"
                  title={`Delete ${o.name}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(o); }}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DeletableSelect;
