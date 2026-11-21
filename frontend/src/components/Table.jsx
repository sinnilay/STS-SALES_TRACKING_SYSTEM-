import React from 'react';

const cellValue = (col, row, rowIndex) => {
  const value = col.render ? col.render(row, rowIndex) : row[col.accessor];
  return value === undefined || value === null || value === '' ? '—' : value;
};

const Table = ({ columns, data, keyField = 'id', renderActions, onRowClick }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full p-5 sm:p-8 text-center bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors duration-300">
        <p className="text-gray-500 dark:text-slate-400">No records found.</p>
      </div>
    );
  }

  // On phones a wide table forces sideways scrolling, so each row becomes a card instead.
  // The first column (usually ID) is shown as a small tag; the second (usually Name) is the card title.
  const [firstCol, secondCol, ...restCols] = columns;
  const titleCol = secondCol || firstCol;
  const tagCol = secondCol ? firstCol : null;
  const detailCols = secondCol ? restCols : [];

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => (
          <div
            key={row[keyField]}
            onClick={() => onRowClick && onRowClick(row)}
            className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 transition-colors ${onRowClick ? 'cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900 dark:text-white break-words">{cellValue(titleCol, row, rowIndex)}</p>
              </div>
              {tagCol && (
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                  {tagCol.header} {cellValue(tagCol, row, rowIndex)}
                </span>
              )}
            </div>

            {detailCols.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {detailCols.map((col, idx) => (
                  <div key={idx} className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{col.header}</dt>
                    <dd className="text-sm font-medium text-slate-700 dark:text-slate-200 break-words">{cellValue(col, row, rowIndex)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {renderActions && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/70">
                {renderActions(row)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tablet / desktop: regular table */}
      <div className="hidden md:block overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 transition-colors duration-300">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-medium">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-3 py-3 sm:px-6 sm:py-4">
                  {col.header}
                </th>
              ))}
              {renderActions && (
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-right">Actions</th>
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
                  <td key={idx} className="px-3 py-3 sm:px-6 sm:py-4 text-gray-700 dark:text-slate-300">
                    {col.render ? col.render(row, rowIndex) : row[col.accessor]}
                  </td>
                ))}
                {renderActions && (
                  <td className="px-3 py-3 sm:px-6 sm:py-4 text-right [&_*]:shrink-0">
                    {/* w-max makes the cell as wide as its buttons, so a narrow screen scrolls the
                        table sideways instead of letting the buttons spill over the previous column. */}
                    <div className="w-max ml-auto">{renderActions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Table;
