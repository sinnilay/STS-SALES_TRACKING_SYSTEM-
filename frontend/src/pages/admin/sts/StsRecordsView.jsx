import React from 'react';
import { Eye, Pencil, ClipboardList, Trash2, Inbox } from 'lucide-react';
import { getStatusMeta } from '../../../constants/stsPipeline';

// STS records laid out like the legacy ERP list (Sr No. · Profile Id · Company Name with
// address · Source · Created Date · Last Action · Status · Allotted To as "Sales Team: … /
// Telesales Team: …"), as a fixed-layout table on wide screens and as cards below that,
// so the page never needs a sideways scrollbar. Rows open the details drawer; the action
// buttons stop the click from bubbling.

const NA = <span className="text-rose-500 dark:text-rose-400">N/A</span>;

// DD/MM/YYYY, matching the legacy ERP.
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB') : null);

const formatPrice = (value) =>
  value != null ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : null;

// Address line under the company name: street, city, state, country + pincode. Imported
// records repeat the street in CompanyAddress and Address1, so duplicates are dropped.
const buildAddress = (row) => {
  const clean = (v) => (v || '').trim().replace(/[\s,.]+$/, '');
  const parts = [
    row.companyAddress,
    row.address1,
    row.address2,
    row.cityDistrict,
    row.state,
    [clean(row.country), clean(row.pincode)].filter(Boolean).join(' '),
  ].map(clean).filter(Boolean);
  const seen = new Set();
  return parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(', ');
};

const isAllocated = (row) => !!(row.allocatedTo || row.teleExecutive || row.marketingExecutive || row.coAssignees?.length);

// A record held by a Tele Sales employee (directly or as a co-assignee) counts as the
// telesales team; every other holder is the sales team.
const getTeams = (row) => {
  const holders = [row.allocatedTo, ...(row.coAssignees || [])].filter(Boolean);
  const tele = holders.filter((h) => h.employeeRole === 'Tele Sales').map((h) => h.fullName);
  const sales = holders.filter((h) => h.employeeRole !== 'Tele Sales').map((h) => h.fullName);
  return {
    sales: sales.join(', ') || null,
    telesales: tele.join(', ') || row.teleExecutive?.fullName || null,
  };
};

const KeyValue = ({ label, children }) => (
  <p className="text-xs leading-5 break-words">
    <span className="font-semibold text-slate-700 dark:text-slate-200">{label}:</span>{' '}
    <span className="text-slate-600 dark:text-slate-300">{children}</span>
  </p>
);

const AllottedTo = ({ row }) => {
  const { sales, telesales } = getTeams(row);
  return (
    <div className="space-y-0.5">
      <KeyValue label="Sales Team">{sales || NA}</KeyValue>
      <KeyValue label="Telesales Team">{telesales || NA}</KeyValue>
    </div>
  );
};

const StatusCell = ({ row }) => {
  const code = row.status || 'New';
  const meta = getStatusMeta(code);
  return (
    <div className="min-w-0 space-y-1">
      <span
        className={`inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md border text-xs font-bold ${meta.badge}`}
        title={meta.label}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
        <span className="truncate">{code}</span>
      </span>
      {meta.label && meta.label !== code && (
        <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 line-clamp-2" title={meta.label}>{meta.label}</p>
      )}
      {row.serviceTaken && (
        <p className="text-[11px] leading-4 text-emerald-700 dark:text-emerald-400 break-words">
          <span className="font-semibold">Service:</span> {row.serviceTaken}
          {row.servicePrice != null && <> · ₹{formatPrice(row.servicePrice)}</>}
          {row.serviceDate && <> · {formatDate(row.serviceDate)}</>}
        </p>
      )}
    </div>
  );
};

const CompanyCell = ({ row }) => {
  const address = buildAddress(row);
  return (
    <div className="min-w-0">
      <p className="font-semibold text-primary-700 dark:text-primary-400 leading-snug break-words">
        {row.companyName || '—'}
      </p>
      {address && (
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400 line-clamp-3 break-words" title={address}>
          {address}
        </p>
      )}
    </div>
  );
};

const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors';

const Actions = ({ row, onStatus, onEdit, onAllocate, onDelete, withLabels = false }) => {
  const allocated = isAllocated(row);
  const btn = withLabels
    ? 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors'
    : iconBtn;
  const label = (text) => withLabels && <span className="hidden sm:inline">{text}</span>;
  return (
    <div
      className={withLabels ? 'flex items-center gap-0.5' : 'grid grid-cols-2 gap-0.5'}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={() => onStatus(row)} title="Log STS update" aria-label="Log STS update"
        className={`${btn} text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10`}>
        <Eye className="w-4 h-4" />{label('Update')}
      </button>
      <button type="button" onClick={() => onEdit(row)} title="Edit details" aria-label="Edit details"
        className={`${btn} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10`}>
        <Pencil className="w-4 h-4" />{label('Edit')}
      </button>
      <button type="button" onClick={() => !allocated && onAllocate(row)} disabled={allocated}
        title={allocated ? 'Already allocated' : 'Assign'} aria-label={allocated ? 'Already allocated' : 'Assign'}
        className={`${btn} ${allocated
          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}>
        <ClipboardList className="w-4 h-4" />{label(allocated ? 'Allocated' : 'Assign')}
      </button>
      <button type="button" onClick={() => onDelete(row)} title="Delete record" aria-label="Delete record"
        className={`${btn} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}>
        <Trash2 className="w-4 h-4" />{label('Delete')}
      </button>
    </div>
  );
};

// One action button, icon-only in the table and icon + label on cards. Exported so other
// screens (e.g. the Sales portal) can build their own action sets in the same style.
const TONES = {
  indigo: 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10',
  blue: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10',
  emerald: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
  primary: 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10',
  slate: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
};
export const RecordActionButton = ({ icon: Icon, label, onClick, tone = 'slate', withLabels = false }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    title={label}
    aria-label={label}
    className={`${withLabels
      ? 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors'
      : iconBtn} ${TONES[tone]}`}
  >
    <Icon className="w-4 h-4" />
    {withLabels && <span>{label}</span>}
  </button>
);

// Checkbox for the optional bulk-selection column. Never opens the row.
const SelectBox = ({ selection, row }) => {
  const selectable = selection.isSelectable ? selection.isSelectable(row) : true;
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex p-1 ${selectable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      title={selectable ? 'Select' : 'Not selectable'}
    >
      <input
        type="checkbox"
        checked={selectable && selection.isSelected(row)}
        disabled={!selectable}
        onChange={() => selection.onToggle(row)}
        className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 disabled:opacity-30"
      />
    </label>
  );
};

// `renderActions(row, withLabels)` replaces the admin action set (Update/Edit/Assign/Delete).
// `selection` = { isSelected(row), isSelectable(row), onToggle(row), header?: node } adds a
// leading checkbox column (and a checkbox on each card).
const StsRecordsView = ({ rows, startIndex = 0, onOpen, onStatus, onEdit, onAllocate, onDelete, renderActions, selection }) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        <p className="font-semibold text-slate-700 dark:text-slate-200">No records found</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Try changing the search or filters.</p>
      </div>
    );
  }

  const actionProps = { onStatus, onEdit, onAllocate, onDelete };
  const actionsFor = (row, withLabels = false) => (renderActions
    ? (
      <div
        className={withLabels ? 'flex items-center gap-0.5' : 'grid grid-cols-2 gap-0.5'}
        onClick={(e) => e.stopPropagation()}
      >
        {renderActions(row, withLabels)}
      </div>
    )
    : <Actions row={row} {...actionProps} withLabels={withLabels} />);
  const isSelected = (row) => !!selection?.isSelected(row);
  const th = 'px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300';
  const td = 'px-3 py-3';

  return (
    <>
      {/* Wide screens (1360px+, room for every column): fixed-layout table that always fits. */}
      <table className="hidden min-[1360px]:table w-full table-fixed text-left text-sm">
        <colgroup>
          {selection && <col className="w-10" />}
          <col className="w-14" />
          <col className="w-[6.5rem]" />
          <col />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-32" />
          <col className="w-44" />
          <col className="w-[5.25rem]" />
        </colgroup>
        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <tr>
            {selection && <th className="pl-3 pr-0 py-3">{selection.header}</th>}
            <th className="pl-3 pr-1 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Sr No.</th>
            <th className={th}>Profile Id</th>
            <th className={th}>Company Name</th>
            <th className={th}>Source</th>
            <th className={th}>Created Date</th>
            <th className={th}>Last Action</th>
            <th className={th}>Status</th>
            <th className={th}>Allotted To</th>
            <th className={`${th} text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => onOpen(row)}
              className={`align-top cursor-pointer transition-colors ${isSelected(row)
                ? 'bg-primary-50 dark:bg-primary-500/10'
                : 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent dark:even:bg-slate-900/20'} hover:bg-primary-50/60 dark:hover:bg-slate-700/40`}
            >
              {selection && <td className="pl-2 pr-0 py-2"><SelectBox selection={selection} row={row} /></td>}
              <td className="pl-3 pr-1 py-3 text-slate-500 dark:text-slate-400">{startIndex + i + 1}</td>
              <td className={`${td} font-mono text-xs text-slate-700 dark:text-slate-200 break-all`}>{row.companyID}</td>
              <td className={td}><CompanyCell row={row} /></td>
              <td className={`${td} text-slate-700 dark:text-slate-200 break-words`}>{row.source || NA}</td>
              <td className={`${td} text-slate-700 dark:text-slate-200`}>{formatDate(row.createdAt) || NA}</td>
              <td className={`${td} text-slate-700 dark:text-slate-200`}>{formatDate(row.lastActionDate) || NA}</td>
              <td className={td}><StatusCell row={row} /></td>
              <td className={td}><AllottedTo row={row} /></td>
              <td className="px-2 py-2.5">
                <div className="flex justify-center">{actionsFor(row)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones, tablets and smaller laptops: one card per record, same key/value pairs. */}
      <div className="min-[1360px]:hidden grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 sm:p-4">
        {rows.map((row, i) => (
          <article
            key={row.id}
            onClick={() => onOpen(row)}
            className={`flex flex-col rounded-xl border shadow-sm transition-colors cursor-pointer ${isSelected(row)
              ? 'border-primary-400 dark:border-primary-500/60 bg-primary-50/50 dark:bg-primary-500/10'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-500/50'}`}
          >
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400">
                  #{startIndex + i + 1} · <span className="font-mono text-slate-600 dark:text-slate-300">{row.companyID}</span>
                </p>
                <div className="mt-1"><CompanyCell row={row} /></div>
              </div>
              {selection && <div className="shrink-0 -mr-1 -mt-1"><SelectBox selection={selection} row={row} /></div>}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 text-sm">
              {[
                ['Source', row.source || NA],
                ['Status', <StatusCell key="status" row={row} />],
                ['Created Date', formatDate(row.createdAt) || NA],
                ['Last Action', formatDate(row.lastActionDate) || NA],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-100 break-words">{value}</dd>
                </div>
              ))}
              <div className="col-span-2 min-w-0">
                <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Allotted To</dt>
                <dd className="mt-0.5"><AllottedTo row={row} /></dd>
              </div>
            </dl>

            <div className="mt-auto flex justify-end border-t border-slate-100 dark:border-slate-700/70 px-2 py-1.5">
              {actionsFor(row, true)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
};

export default StsRecordsView;
