import React from 'react';

const Table = ({ columns, data, keyField = 'id', renderActions, onRowClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full p-8 text-center bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors duration-300">
        <p className="text-gray-500 dark:text-slate-400">No records found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 transition-colors duration-300">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-medium">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-6 py-4">
                {col.header}
              </th>
            ))}
            {renderActions && (
              <th className="px-6 py-4 text-right">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
          {data.map((row, rowIndex) => (
            <tr
              key={row[keyField]}
              onClick={() => onRowClick && onRowClick(row)}
              className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
            >
              {columns.map((col, idx) => (
                <td key={idx} className="px-6 py-4 text-gray-700 dark:text-slate-300">
                  {col.render ? col.render(row, rowIndex) : row[col.accessor]}
                </td>
              ))}
              {renderActions && (
                <td className="px-6 py-4 text-right">
                  {renderActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
