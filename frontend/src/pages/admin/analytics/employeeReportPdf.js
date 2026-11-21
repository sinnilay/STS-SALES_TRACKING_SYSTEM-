import { getStatusDisplay, getStatusMeta } from '../../../constants/stsPipeline';
import { fmtDate, fmtNum, periodLabel } from './analyticsUtils';

// Builds the per-employee performance report as a vector A4 PDF. jsPDF is loaded on demand
// so the analytics page doesn't pay for it until someone actually exports.

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // side margin
const CW = PAGE_W - M * 2; // content width
const TOP = 24; // content start on continuation pages (below the slim header)
const BOTTOM = PAGE_H - 18; // keep clear of the footer

const C = {
  navy: '#0f172a',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f8fafc',
  track: '#e2e8f0',
  blue: '#2a78d6',
  blueSoft: '#93c5fd',
  orange: '#eb6834',
  emerald: '#10b981',
  rose: '#e11d48',
  amber: '#f59e0b',
  indigo: '#6366f1',
  cyan: '#0891b2',
  violet: '#8b5cf6',
  slate: '#475569',
};
const GROUP_HEX = { success: '#10b981', negative: '#ef4444', positive: '#6366f1', neutral: '#94a3b8' };
const BUCKETS = [
  { id: 'fresh', label: 'Fresh / not called', color: '#cbd5e1' },
  { id: 'neutral', label: 'Follow-up / neutral', color: GROUP_HEX.neutral },
  { id: 'positive', label: 'Positive progress', color: GROUP_HEX.positive },
  { id: 'success', label: 'Converted', color: GROUP_HEX.success },
  { id: 'negative', label: 'Not interested / dead', color: GROUP_HEX.negative },
];
const bucketOf = (status) => (!status || status === 'New' || status === 'Assigned' ? 'fresh' : getStatusMeta(status).group);

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// The built-in PDF fonts only cover Latin-1 — swap common typographic characters and drop the rest.
const clean = (s) => String(s ?? '')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .replace(/₹/g, 'Rs. ')
  .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
  .trim();
const money = (n) => `Rs. ${fmtNum(Math.round(n || 0))}`;
const initials = (name = '') => clean(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee';

// Fetches an image and re-encodes it as a square PNG (cover = crop to fill, contain = letterbox).
// Returns null on any failure (CORS, 404, timeout) so the report falls back to initials.
const loadImage = async (url, fit = 'cover') => {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const scale = fit === 'cover' ? Math.max(size / bmp.width, size / bmp.height) : Math.min(size / bmp.width, size / bmp.height) * 0.86;
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

export const reportFileName = (employee, range) => {
  const span = range.from && range.to ? `${range.from}_to_${range.to}` : range.from ? `from-${range.from}` : 'all-time';
  return `${slug(employee.fullName || employee.email)}-performance-report-${span}.pdf`;
};

/**
 * @param {object} opts
 * @param {object} opts.data      GET /Admin/employee-analytics/{id} response
 * @param {object} opts.range     { period, from, to } from rangeFromParams
 * @param {object} opts.company   { name, logoUrl }
 * @param {object} opts.overdue   { items, total } — overdue follow-ups (first page)
 * @param {object} opts.untouched { items, total } — untouched records (first page)
 * @returns {Promise<Blob>}
 */
export async function buildEmployeeReportPdf({ data, range, company = {}, overdue, untouched }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const [logo, photo] = await Promise.all([
    loadImage(company.logoUrl, 'contain'),
    loadImage(data.employee.profilePictureUrl, 'cover'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const { employee: emp, holdings: h, activity: a, requests: req, recent } = data;
  const name = clean(emp.fullName || emp.email);
  const companyName = clean(company.name) || 'Company';
  const generatedAt = new Date();
  const periodText = range.period === 'all' || (!range.from && !range.to)
    ? 'All time'
    : range.from && range.to ? `${clean(fmtDate(range.from))} - ${clean(fmtDate(range.to))}` : clean(periodLabel(range));
  const allTime = range.period === 'all' || (!range.from && !range.to);
  const periodHuman = allTime ? 'all time' : clean(periodLabel(range));
  const inPeriod = allTime ? 'so far' : `in ${periodHuman}`;

  // ---------- drawing helpers ----------
  const fill = (hex) => doc.setFillColor(...rgb(hex));
  const stroke = (hex) => doc.setDrawColor(...rgb(hex));
  const color = (hex) => doc.setTextColor(...rgb(hex));
  const font = (size, style = 'normal', hex = C.body) => { doc.setFont('helvetica', style); doc.setFontSize(size); color(hex); };
  const fitText = (text, maxW) => {
    let t = clean(text);
    if (doc.getTextWidth(t) <= maxW) return t;
    while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxW) t = t.slice(0, -1);
    return `${t}...`;
  };
  const card = (x, y, w, hgt) => {
    fill('#ffffff');
    stroke(C.line);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, hgt, 2.2, 2.2, 'FD');
  };

  let y = 0;
  const newPage = () => { doc.addPage(); y = TOP; };
  const ensure = (needed) => { if (y + needed > BOTTOM) newPage(); };

  const section = (title, subtitle) => {
    ensure(16);
    y += 3;
    fill(C.blue);
    doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    font(12, 'bold', C.ink);
    doc.text(title, M + 4, y);
    if (subtitle) {
      const tw = doc.getTextWidth(title);
      font(8.5, 'normal', C.muted);
      doc.text(fitText(subtitle, CW - tw - 10), M + 4 + tw + 3, y);
    }
    y += 5;
  };

  const tile = (x, ty, w, hgt, { label, value, hint, accent, progress }) => {
    card(x, ty, w, hgt);
    fill(accent);
    doc.roundedRect(x, ty, 1.3, hgt, 0.6, 0.6, 'F');
    font(6.5, 'bold', C.muted);
    doc.text(fitText(label.toUpperCase(), w - 7), x + 4.5, ty + 5.6);
    font(15, 'bold', C.ink);
    doc.text(fitText(value, w - 7), x + 4.5, ty + 13.2);
    if (progress != null) {
      const bw = w - 9;
      fill(C.track);
      doc.roundedRect(x + 4.5, ty + hgt - 6.2, bw, 1.8, 0.9, 0.9, 'F');
      if (progress > 0) {
        fill(accent);
        doc.roundedRect(x + 4.5, ty + hgt - 6.2, Math.max(1.8, (bw * Math.min(progress, 100)) / 100), 1.8, 0.9, 0.9, 'F');
      }
    } else if (hint) {
      font(6.8, 'normal', C.muted);
      doc.text(fitText(hint, w - 7), x + 4.5, ty + hgt - 4);
    }
  };

  const tileRow = (items, cols, hgt) => {
    const gap = 3;
    const w = (CW - gap * (cols - 1)) / cols;
    for (let i = 0; i < items.length; i += cols) {
      ensure(hgt + gap);
      items.slice(i, i + cols).forEach((it, j) => tile(M + j * (w + gap), y, w, hgt, it));
      y += hgt + gap;
    }
  };

  // Horizontal bar list inside a card: label · count · % · bar.
  const barList = (x, by, w, title, rows, { total, accent = C.blue, max = 8, empty = 'Nothing to show' } = {}) => {
    const list = rows.slice(0, max);
    const rowH = 8.2;
    const hgt = 13 + Math.max(1, list.length) * rowH + 2;
    card(x, by, w, hgt);
    font(8.5, 'bold', C.ink);
    doc.text(title, x + 5, by + 7.5);
    if (list.length === 0) {
      font(8, 'normal', C.faint);
      doc.text(empty, x + 5, by + 16);
      return hgt;
    }
    const peak = Math.max(1, ...list.map((r) => r.count));
    list.forEach((r, i) => {
      const ry = by + 15 + i * rowH;
      const right = total ? `${fmtNum(r.count)}   ${Math.round((r.count / total) * 100)}%` : fmtNum(r.count);
      font(7.5, 'bold', C.ink);
      const rw = doc.getTextWidth(right);
      doc.text(right, x + w - 5, ry, { align: 'right' });
      font(7.5, 'normal', C.body);
      doc.text(fitText(r.label, w - 14 - rw), x + 5, ry);
      fill(C.track);
      doc.roundedRect(x + 5, ry + 1.6, w - 10, 1.5, 0.75, 0.75, 'F');
      fill(r.color || accent);
      doc.roundedRect(x + 5, ry + 1.6, Math.max(1.5, ((w - 10) * r.count) / peak), 1.5, 0.75, 0.75, 'F');
    });
    return hgt;
  };

  // Vertical bar chart (one or two series) with a light grid.
  const columnChart = (x, cy, w, hgt, title, legend, points, { labelEvery = 1, series = [{ key: 'v', color: C.blue }] } = {}) => {
    card(x, cy, w, hgt);
    font(8.5, 'bold', C.ink);
    doc.text(title, x + 5, cy + 7.5);
    if (legend) {
      let lx = x + w - 5;
      [...legend].reverse().forEach((l) => {
        font(7, 'normal', C.muted);
        const lw = doc.getTextWidth(l.label);
        doc.text(l.label, lx, cy + 7.5, { align: 'right' });
        fill(l.color);
        doc.circle(lx - lw - 2.2, cy + 6.4, 1, 'F');
        lx -= lw + 7;
      });
    }
    const px = x + 11;
    const pw = w - 16;
    const py = cy + 13;
    const ph = hgt - 23;
    const peak = Math.max(1, ...points.flatMap((p) => series.map((s) => p[s.key] || 0)));
    const step = Math.max(1, Math.ceil(peak / 4));
    const top = step * 4;
    doc.setLineWidth(0.15);
    for (let i = 0; i <= 4; i += 1) {
      const gy = py + ph - (ph * i) / 4;
      stroke(i === 0 ? '#cbd5e1' : '#eef2f7');
      doc.line(px, gy, px + pw, gy);
      font(6, 'normal', C.faint);
      doc.text(fmtNum(step * i), px - 1.8, gy + 1, { align: 'right' });
    }
    const slot = pw / Math.max(1, points.length);
    const groupW = Math.min(slot * 0.72, 9);
    const barW = groupW / series.length;
    points.forEach((p, i) => {
      const gx = px + slot * i + (slot - groupW) / 2;
      series.forEach((s, j) => {
        const v = p[s.key] || 0;
        if (v <= 0) return;
        const bh = (ph * v) / top;
        fill(s.color);
        doc.rect(gx + j * barW, py + ph - bh, Math.max(0.35, barW - (series.length > 1 ? 0.25 : 0)), bh, 'F');
      });
      if (i % labelEvery === 0) {
        font(5.8, 'normal', C.muted);
        doc.text(clean(p.label), px + slot * i + slot / 2, py + ph + 4, { align: 'center' });
      }
    });
  };

  // ---------- page 1 header ----------
  fill(C.navy);
  doc.rect(0, 0, PAGE_W, 44, 'F');
  fill('#1e293b');
  doc.circle(PAGE_W - 18, 4, 30, 'F');
  fill(C.blue);
  doc.rect(0, 44, PAGE_W, 1.4, 'F');

  fill('#ffffff');
  doc.roundedRect(M, 12, 20, 20, 3, 3, 'F');
  if (logo) {
    doc.addImage(logo, 'PNG', M + 1.5, 13.5, 17, 17);
  } else {
    font(14, 'bold', C.navy);
    doc.text(initials(companyName).slice(0, 1), M + 10, 24.8, { align: 'center' });
  }
  font(15, 'bold', '#ffffff');
  doc.text(fitText(companyName.toUpperCase(), 100), M + 25, 20.5);
  font(7.5, 'bold', C.blueSoft);
  doc.text('EMPLOYEE PERFORMANCE REPORT', M + 25, 27, { charSpace: 0.6 });

  font(6.5, 'bold', C.faint);
  doc.text('REPORTING PERIOD', PAGE_W - M, 17, { align: 'right', charSpace: 0.4 });
  font(10.5, 'bold', '#ffffff');
  doc.text(periodText, PAGE_W - M, 23.5, { align: 'right' });
  font(7, 'normal', C.faint);
  doc.text(`Generated ${clean(generatedAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}`, PAGE_W - M, 29.5, { align: 'right' });

  // ---------- profile card ----------
  y = 53;
  const profH = 31;
  fill(C.soft);
  stroke(C.line);
  doc.setLineWidth(0.25);
  doc.roundedRect(M, y, CW, profH, 2.5, 2.5, 'FD');
  const av = 21;
  if (photo) {
    doc.addImage(photo, 'PNG', M + 5, y + 5, av, av);
    stroke('#ffffff');
    doc.setLineWidth(0.8);
    doc.roundedRect(M + 5, y + 5, av, av, 2.5, 2.5, 'S');
  } else {
    fill(C.blue);
    doc.roundedRect(M + 5, y + 5, av, av, 3, 3, 'F');
    font(13, 'bold', '#ffffff');
    doc.text(initials(name), M + 5 + av / 2, y + 5 + av / 2 + 1.6, { align: 'center' });
  }
  const tx = M + 5 + av + 6;
  font(16, 'bold', C.ink);
  const nameText = fitText(name, CW - av - 45);
  doc.text(nameText, tx, y + 12);
  const nw = doc.getTextWidth(nameText);
  const pill = emp.isActive ? { t: 'ACTIVE', bg: '#d1fae5', fg: '#047857' } : { t: 'INACTIVE', bg: '#e2e8f0', fg: '#475569' };
  font(6.5, 'bold', pill.fg);
  const pw = doc.getTextWidth(pill.t) + 5;
  fill(pill.bg);
  doc.roundedRect(tx + nw + 3, y + 7.6, pw, 5, 2.5, 2.5, 'F');
  doc.text(pill.t, tx + nw + 3 + pw / 2, y + 11.1, { align: 'center' });

  font(9, 'normal', C.muted);
  doc.text(fitText([emp.employeeRole, emp.designation, emp.department].filter(Boolean).join('  |  ') || 'Employee', CW - av - 20), tx, y + 18);
  const contact = [
    emp.email,
    emp.mobileNo || emp.phoneNumber,
    emp.cityBranch,
    emp.joiningDate ? `Joined ${fmtDate(emp.joiningDate)}` : null,
    `Last update ${a.lastActivityAt ? fmtDate(a.lastActivityAt) : 'never'}`,
  ].filter(Boolean).join('   |   ');
  font(7.5, 'normal', C.body);
  doc.text(fitText(contact, CW - av - 20), tx, y + 24.5);
  y += profH + 6;

  // ---------- data held ----------
  section('Data held', 'Current allotment - what is on their plate right now');
  tileRow([
    { label: 'Records held', value: fmtNum(h.held), hint: `${fmtNum(h.primary)} own | ${fmtNum(h.shared)} shared`, accent: C.slate },
    { label: 'Touched', value: fmtNum(h.touched), hint: 'Worked at least once', accent: C.emerald },
    { label: 'Untouched', value: fmtNum(h.untouched), hint: 'No update from them yet', accent: C.rose },
    { label: 'Overdue', value: fmtNum(h.overdueFollowUps), hint: `${fmtNum(h.upcomingFollowUps)} more due in 7 days`, accent: C.amber },
    { label: 'Coverage', value: `${h.coverage}%`, progress: h.coverage, accent: C.blue },
  ], 5, 22);

  // Where held records stand — stacked bar + legend.
  const counts = {};
  (h.byStatus || []).forEach((s) => {
    const b = bucketOf(s.name === 'Unspecified' ? '' : s.name);
    counts[b] = (counts[b] || 0) + s.count;
  });
  const buckets = BUCKETS.map((b) => ({ ...b, count: counts[b.id] || 0 }));
  ensure(30);
  card(M, y, CW, 27);
  font(7, 'bold', C.muted);
  doc.text('WHERE THEIR HELD RECORDS STAND', M + 5, y + 6.5, { charSpace: 0.3 });
  font(7, 'normal', C.muted);
  doc.text(`${fmtNum(h.meetingsFixed)} with a meeting fixed  |  ${fmtNum(h.workedNotHeld)} worked but no longer held`, M + CW - 5, y + 6.5, { align: 'right' });
  const barX = M + 5;
  const barW = CW - 10;
  fill(C.track);
  doc.roundedRect(barX, y + 10, barW, 3.6, 1.8, 1.8, 'F');
  if (h.held > 0) {
    // Tiny buckets get a minimum sliver so they stay visible; widths are then rescaled to fit.
    const shown = buckets.filter((b) => b.count > 0);
    const widths = shown.map((b) => Math.max(1.4, (barW * b.count) / h.held));
    const scale = barW / widths.reduce((s, w) => s + w, 0);
    let bx = barX;
    shown.forEach((b, i) => {
      const bw = widths[i] * scale;
      fill(b.color);
      if (shown.length === 1) doc.roundedRect(bx, y + 10, barW, 3.6, 1.8, 1.8, 'F');
      else doc.rect(bx, y + 10, bw, 3.6, 'F');
      bx += bw;
    });
  }
  // Legend: dot · label · count, laid out at natural width and spread evenly across the card.
  const legend = buckets.map((b) => {
    font(7, 'normal');
    const labelW = doc.getTextWidth(b.label);
    font(7.5, 'bold');
    const countText = fmtNum(b.count);
    return { ...b, labelW, countText, w: 3.5 + labelW + 2 + doc.getTextWidth(countText) };
  });
  const legendGap = (CW - 10 - legend.reduce((s, l) => s + l.w, 0)) / (legend.length - 1);
  let lx = M + 5;
  legend.forEach((l) => {
    fill(l.color);
    doc.circle(lx + 1, y + 20.2, 1.1, 'F');
    font(7, 'normal', C.body);
    doc.text(l.label, lx + 3.5, y + 21.2);
    font(7.5, 'bold', C.ink);
    doc.text(l.countText, lx + 3.5 + l.labelW + 2, y + 21.2);
    lx += l.w + legendGap;
  });
  y += 27 + 5;

  // ---------- work done ----------
  section('Work done', `Everything they logged ${inPeriod}`);
  const totalReq = (req.pending || 0) + (req.approved || 0) + (req.rejected || 0);
  tileRow([
    { label: 'Status updates', value: fmtNum(a.updates), hint: `on ${fmtNum(a.recordsWorked)} records`, accent: C.blue },
    { label: 'Conversions', value: fmtNum(a.conversions), hint: `${a.conversionRate}% of records worked`, accent: C.indigo },
    { label: 'Revenue', value: money(a.revenue), hint: 'Value of conversions', accent: C.amber },
    { label: 'Active days', value: fmtNum(a.activeDays), hint: `${a.avgPerActiveDay} updates per active day`, accent: C.cyan },
    { label: 'New records added', value: fmtNum(a.recordsCreated), hint: 'STS created by them', accent: C.emerald },
    { label: 'Site visit photos', value: fmtNum(a.siteImages), hint: 'Uploaded in this period', accent: C.violet },
    { label: 'STS requests', value: fmtNum(totalReq), hint: `${req.pending} pending | ${req.approved} approved | ${req.rejected} rejected`, accent: C.slate },
    { label: 'Meetings fixed', value: fmtNum(h.meetingsFixed), hint: 'On records they hold', accent: C.rose },
  ], 4, 22);

  // Activity trend
  const monthly = a.trendGranularity === 'month';
  const trend = (a.trend || []).map((p) => {
    const d = new Date(`${p.date}T00:00:00`);
    return {
      label: monthly ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      updates: p.updates,
      conversions: p.conversions,
    };
  });
  ensure(60);
  if (trend.some((p) => p.updates > 0)) {
    columnChart(M, y, CW, 56, monthly ? 'Activity trend - updates per month' : 'Activity trend - updates per day',
      [{ label: 'Updates', color: C.blue }, { label: 'Conversions', color: C.orange }],
      trend,
      { labelEvery: Math.max(1, Math.ceil(trend.length / 10)), series: [{ key: 'updates', color: C.blue }, { key: 'conversions', color: C.orange }] });
  } else {
    card(M, y, CW, 22);
    font(8.5, 'bold', C.ink);
    doc.text('Activity trend', M + 5, y + 7.5);
    font(8, 'normal', C.faint);
    doc.text(`No status updates ${inPeriod}.`, M + 5, y + 15);
  }
  y += (trend.some((p) => p.updates > 0) ? 56 : 22) + 4;

  // Busiest days + call outcomes, side by side
  const half = (CW - 4) / 2;
  const outcomes = (a.byOutcome || []).map((o) => ({ label: getStatusMeta(o.name).label, count: o.count, color: GROUP_HEX[getStatusMeta(o.name).group] }));
  const outcomeH = 13 + Math.max(1, Math.min(8, outcomes.length)) * 8.2 + 2;
  const rowH = Math.max(58, outcomeH);
  ensure(rowH + 4);
  columnChart(M, y, half, rowH, 'Busiest days', null, (a.weekdays || []).map((d) => ({ label: d.day, v: d.updates })));
  barList(M + half + 4, y, half, `Call outcomes (${periodHuman})`, outcomes, { empty: 'No updates in this period' });
  y += rowH + 4;

  // Breakdowns
  const bySource = (h.bySource || []).map((s) => ({ label: s.name, count: s.count }));
  const byCity = (h.byCity || []).map((s) => ({ label: s.name, count: s.count }));
  const bdH = 13 + Math.max(1, Math.min(8, Math.max(bySource.length, byCity.length))) * 8.2 + 2;
  ensure(bdH + 4);
  barList(M, y, half, 'Held records by source', bySource, { total: h.held, empty: 'No records held' });
  barList(M + half + 4, y, half, 'Held records by city (top 8)', byCity, { total: h.held, empty: 'No records held' });
  y += bdH + 6;

  // ---------- tables ----------
  const table = (head, body, opts = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: M, right: M, top: TOP, bottom: PAGE_H - BOTTOM },
      theme: 'plain',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 7.5, textColor: rgb(C.body), cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: rgb(C.navy), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: rgb(C.soft) },
      bodyStyles: { lineColor: rgb(C.line), lineWidth: { bottom: 0.15 } },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 6;
  };
  // "CODE (Label)" for real status codes; legacy / fresh values ("New", "Assigned") just show their label.
  const statusCell = (status, other) => {
    const meta = getStatusMeta(status);
    return clean(meta.label === (status || 'New') ? meta.label : getStatusDisplay(status, other) || meta.label);
  };
  // Colour the status column by outcome group (neutral stays a readable slate, not light grey).
  const statusColorHook = (col) => (hook) => {
    if (hook.section === 'body' && hook.column.index === col) {
      const group = getStatusMeta(hook.row.raw?.__status).group;
      hook.cell.styles.textColor = rgb(group === 'neutral' ? C.slate : GROUP_HEX[group]);
      hook.cell.styles.fontStyle = 'bold';
    }
  };
  const recordRows = (items) => items.map((r, i) => {
    const row = [
      String(i + 1),
      `${clean(r.companyName)}${r.isPrimary ? '' : '  (shared)'}`,
      clean(r.companyID) || '-',
      clean(r.cityDistrict) || '-',
      statusCell(r.status),
      r.nextActionDate ? clean(fmtDate(r.nextActionDate)) : '-',
      fmtNum(r.myUpdates),
    ];
    row.__status = r.status;
    return row;
  });
  const recordColumns = {
    0: { cellWidth: 8, halign: 'center', textColor: rgb(C.faint) },
    1: { cellWidth: 50, fontStyle: 'bold', textColor: rgb(C.ink) },
    2: { cellWidth: 23 },
    3: { cellWidth: 24 },
    4: { cellWidth: 35 },
    5: { cellWidth: 24 },
    6: { cellWidth: 18, halign: 'right' },
  };
  const recordHead = ['#', 'Company', 'Profile ID', 'City', 'Status', 'Next follow-up', 'Updates'];

  if (overdue?.items?.length) {
    section('Overdue follow-ups', overdue.total > overdue.items.length ? `Oldest ${overdue.items.length} of ${fmtNum(overdue.total)} - follow-up date already passed` : 'Follow-up date already passed');
    table(recordHead, recordRows(overdue.items), {
      columnStyles: { ...recordColumns, 5: { ...recordColumns[5], textColor: rgb(C.rose), fontStyle: 'bold' } },
      didParseCell: statusColorHook(4),
    });
  }

  if (untouched?.items?.length) {
    section('Untouched records', untouched.total > untouched.items.length ? `Latest ${untouched.items.length} of ${fmtNum(untouched.total)} held records with no update from them` : 'Held records with no update from them');
    table(recordHead, recordRows(untouched.items), { columnStyles: recordColumns, didParseCell: statusColorHook(4) });
  }

  section('Recent activity', 'Their latest status updates (any period)');
  if (recent.length === 0) {
    font(8.5, 'normal', C.faint);
    doc.text(`${name} has not logged any status update yet.`, M + 4, y + 2);
    y += 8;
  } else {
    const rows = recent.map((r) => {
      const details = [
        r.convertedFor ? `${clean(r.convertedFor)}${r.convertedPrice != null ? ` - ${money(r.convertedPrice)}` : ''}` : null,
        clean(r.comment) || null,
      ].filter(Boolean).join('\n');
      const row = [
        clean(new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: 'numeric', minute: '2-digit' })),
        `${clean(r.companyName)}\n${clean(r.companyID)}`,
        clean(getStatusMeta(r.previousStatus).label),
        statusCell(r.newStatus, r.otherStatusText),
        details || '-',
      ];
      row.__status = r.newStatus;
      return row;
    });
    table(['When', 'Company', 'From', 'To', 'Details'], rows, {
      columnStyles: {
        0: { cellWidth: 31, textColor: rgb(C.muted) },
        1: { cellWidth: 44, fontStyle: 'bold', textColor: rgb(C.ink) },
        2: { cellWidth: 26, textColor: rgb(C.muted) },
        3: { cellWidth: 33 },
        4: { cellWidth: 'auto' },
      },
      didParseCell: statusColorHook(3),
    });
  }

  // ---------- running header + footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    if (p > 1) {
      fill(C.navy);
      doc.rect(0, 0, PAGE_W, 14, 'F');
      fill(C.blue);
      doc.rect(0, 14, PAGE_W, 0.8, 'F');
      font(8, 'bold', '#ffffff');
      doc.text(fitText(companyName.toUpperCase(), 90), M, 8.8);
      font(7.5, 'normal', '#cbd5e1');
      doc.text(fitText(`${name}  |  ${periodText}`, 90), PAGE_W - M, 8.8, { align: 'right' });
    }
    stroke(C.line);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    font(6.8, 'normal', C.faint);
    doc.text(fitText(`${companyName}  |  Employee performance report  |  Confidential`, 120), M, PAGE_H - 7.5);
    font(6.8, 'bold', C.muted);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
  }

  return doc.output('blob');
}
