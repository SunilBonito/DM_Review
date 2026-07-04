// ---- App state ----
let ALL_PROJECTS = [];
let FILTERS = { projectType: [], branch: [], designer: [], designManager: [], status: [], stage: [], milestoneName: [], dateFrom: null, dateTo: null };
let WORKLOAD_MODE = 'designManager';
let TABLE_SORT = { key: 'projectNo', dir: 1 };
let OVERDUE_SORT = { key: 'daysOverdue', dir: -1 };

// Maps the current "Milestone Name" field (a pipeline stage label) to the tracked
// milestone whose Planned/Done pair it corresponds to. Names not in this map have
// no reliable tracked equivalent (e.g. Production/Dispatch/Payment-% stages) and
// are simply skipped for the overdue calculation rather than guessed at.
const MILESTONE_NAME_MAP = {
  'DCM Due': 'dcm', 'CDP Due': 'cdp', '10% Payment': 'designfee', 'DEM1': 'dem1', 'DEM2': 'dem2', 'DEM3': 'dem3',
  'Design Finalization': 'dem1fee', 'CM': 'crossmeasure', 'Site Readiness 1': 'sitereadiness', 'Site Readiness 2': 'sitereadiness',
  'Hoto': 'hoto', '3D Sign off': 'pko'
};
const MILESTONE_BY_KEY = {};
MILESTONES.forEach(m => MILESTONE_BY_KEY[m.key] = m);

function computeCurrentMilestoneOverdue(p) {
  const mkey = MILESTONE_NAME_MAP[p.milestoneName];
  if (!mkey) return null;
  const m = MILESTONE_BY_KEY[mkey];
  const planned = p._raw[m.planned];
  const done = p._raw[m.done];
  if (planned instanceof Date && !(done instanceof Date) && planned < new Date()) {
    return { milestone: m.label, planned, daysOverdue: Math.floor((new Date() - planned) / 86400000) };
  }
  return null;
}

function trimField(v) {
  return typeof v === 'string' ? v.trim() : v;
}

// ---- Data loading ----
function ingestWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const projects = buildProjects(rows);
  projects.forEach(p => {
    p.projectType = trimField(p.projectType);
    p.branch = trimField(p.branch);
    p.designer = trimField(p.designer);
    p.designManager = trimField(p.designManager);
    p.status = trimField(p.status);
    p.stage = trimField(p.stage);
    p.milestoneName = trimField(p.milestoneName);
    p.currentOverdue = computeCurrentMilestoneOverdue(p);
  });
  ALL_PROJECTS = projects;
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('app-body').style.display = 'block';
  document.getElementById('data-meta').textContent = projects.length.toLocaleString() + ' projects loaded \u00b7 refresh by uploading a new Dump.xlsx';
  buildSidebar();
  renderAll();
}

function tryAutoLoad() {
  fetch('./Dump.xlsx').then(r => { if (!r.ok) throw new Error('not found'); return r.arrayBuffer(); })
    .then(buf => ingestWorkbook(buf))
    .catch(() => { /* no auto file available, wait for manual upload */ });
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = e => ingestWorkbook(e.target.result);
  reader.readAsArrayBuffer(file);
}

document.getElementById('file-input').addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
document.getElementById('btn-upload').addEventListener('click', () => document.getElementById('file-input').click());
const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('click', () => document.getElementById('file-input').click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// ---- Sidebar / filters ----
const FILTER_FIELDS = [
  { key: 'projectType', label: 'Project type' },
  { key: 'branch', label: 'Branch' },
  { key: 'designer', label: 'Designer' },
  { key: 'designManager', label: 'Design manager' },
  { key: 'status', label: 'Status' },
  { key: 'stage', label: 'Stage' },
  { key: 'milestoneName', label: 'Milestone name' },
];

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '<h3>Filters</h3>';
  FILTER_FIELDS.forEach(f => {
    const options = getUniqueValues(ALL_PROJECTS, f.key);
    const group = document.createElement('div');
    group.className = 'filter-group';
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.innerHTML = '<span>' + f.label + '</span>';
    group.appendChild(btn);
    const panel = document.createElement('div');
    panel.className = 'filter-panel';
    panel.style.display = 'none';

    const actions = document.createElement('div');
    actions.className = 'fp-actions';
    actions.innerHTML = '<span data-act="all">Select all</span><span data-act="none">Clear</span>';
    panel.appendChild(actions);
    actions.querySelector('[data-act=all]').onclick = () => { FILTERS[f.key] = options.slice(); refreshFilterUI(); onFilterChange(); };
    actions.querySelector('[data-act=none]').onclick = () => { FILTERS[f.key] = []; refreshFilterUI(); onFilterChange(); };

    options.forEach(opt => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt;
      cb.checked = FILTERS[f.key].includes(opt);
      cb.addEventListener('change', () => {
        if (cb.checked) FILTERS[f.key].push(opt);
        else FILTERS[f.key] = FILTERS[f.key].filter(v => v !== opt);
        updateFilterBtnLabel(btn, f.label, FILTERS[f.key].length);
        onFilterChange();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(String(opt)));
      panel.appendChild(label);
    });
    group.appendChild(panel);
    btn.addEventListener('click', () => {
      const isOpen = panel.style.display === 'block';
      document.querySelectorAll('.filter-panel').forEach(p => p.style.display = 'none');
      panel.style.display = isOpen ? 'none' : 'block';
    });
    sidebar.appendChild(group);
    updateFilterBtnLabel(btn, f.label, 0);
  });

  const dateGroup = document.createElement('div');
  dateGroup.className = 'filter-group';
  dateGroup.innerHTML = '<h3 style="margin-top:6px;">Prebook agreement signed</h3>' +
    '<div class="date-row"><label>From</label><input type="date" id="date-from"></div>' +
    '<div class="date-row"><label>To</label><input type="date" id="date-to"></div>';
  sidebar.appendChild(dateGroup);
  document.getElementById('date-from').addEventListener('change', e => { FILTERS.dateFrom = e.target.value ? new Date(e.target.value) : null; onFilterChange(); });
  document.getElementById('date-to').addEventListener('change', e => {
    if (e.target.value) { const d = new Date(e.target.value); d.setHours(23, 59, 59, 999); FILTERS.dateTo = d; } else FILTERS.dateTo = null;
    onFilterChange();
  });

  const clearAll = document.createElement('button');
  clearAll.className = 'clear-all';
  clearAll.textContent = 'Clear all filters';
  clearAll.addEventListener('click', () => {
    FILTER_FIELDS.forEach(f => FILTERS[f.key] = []);
    FILTERS.dateFrom = null; FILTERS.dateTo = null;
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    refreshFilterUI();
    onFilterChange();
  });
  sidebar.appendChild(clearAll);

  document.addEventListener('click', e => {
    if (!e.target.closest('.filter-group')) document.querySelectorAll('.filter-panel').forEach(p => p.style.display = 'none');
  });
}

function updateFilterBtnLabel(btn, label, count) {
  btn.innerHTML = '<span>' + label + (count ? ' <span class="count">' + count + '</span>' : '') + '</span>';
}

function refreshFilterUI() {
  document.querySelectorAll('.filter-group').forEach((group, i) => {
    if (i >= FILTER_FIELDS.length) return;
    const f = FILTER_FIELDS[i];
    const btn = group.querySelector('.filter-btn');
    updateFilterBtnLabel(btn, f.label, FILTERS[f.key].length);
    group.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = FILTERS[f.key].includes(cb.value); });
  });
}

function onFilterChange() { renderAll(); }

// ---- Rendering ----
function getFiltered() {
  return filterProjects(ALL_PROJECTS, FILTERS);
}

function renderAll() {
  const filtered = getFiltered();
  renderKPIs(filtered);
  renderOverdueBanner(filtered);
  renderAging(filtered);
  renderWorkload(filtered);
  renderStageFunnel(filtered);
  renderMilestoneChart(filtered);
  renderOverdueTable(filtered);
  renderProjectTable(filtered);
}

function fmtCr(v) { return '\u20b9' + (v / 10000000).toFixed(1) + ' Cr'; }
function fmtL(v) { return '\u20b9' + (v / 100000).toFixed(1) + ' L'; }

function renderKPIs(filtered) {
  const k = computeKPIs(filtered);
  const overdueCount = filtered.filter(p => p.currentOverdue).length;
  const el = document.getElementById('kpi-grid');
  el.innerHTML = '';
  const items = [
    { label: 'Total projects', value: k.total.toLocaleString() },
    { label: 'Active', value: k.active.toLocaleString() },
    { label: 'Hold', value: k.hold.toLocaleString() },
    { label: 'Lost', value: k.lost.toLocaleString() },
    { label: 'Overdue (current milestone)', value: overdueCount.toLocaleString(), danger: true },
    { label: 'Avg deal size', value: k.avgValue ? fmtL(k.avgValue) : '\u2013' },
  ];
  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'kpi' + (it.danger && overdueCount > 0 ? ' danger' : '');
    div.innerHTML = '<p class="label">' + it.label + '</p><p class="value">' + it.value + '</p>';
    el.appendChild(div);
  });
}

function renderOverdueBanner(filtered) {
  const el = document.getElementById('overdue-banner');
  const overdueProjects = filtered.filter(p => p.currentOverdue);
  const detailCard = document.getElementById('overdue-detail');
  if (!overdueProjects.length) { el.innerHTML = ''; detailCard.style.display = 'none'; return; }
  detailCard.style.display = 'block';
  el.innerHTML = '<div class="banner"><span><strong>' + overdueProjects.length + ' project' + (overdueProjects.length === 1 ? '' : 's') +
    '</strong> ha' + (overdueProjects.length === 1 ? 's' : 've') + ' an overdue current milestone (planned date passed, still not done)</span></div>';
}

function barChart(container, rows, opts) {
  opts = opts || {};
  container.innerHTML = '';
  if (!rows.length) { container.innerHTML = '<p class="footnote">No data for current filters.</p>'; return; }
  const max = Math.max(...rows.map(r => r.value)) || 1;
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const pct = Math.max(2, (r.value / max) * 100);
    row.innerHTML = '<span class="bar-label" title="' + r.label + '">' + r.label + '</span>' +
      '<div class="bar-track"><div class="bar-fill' + (r.cls ? ' ' + r.cls : '') + '" style="width:' + pct + '%"></div></div>' +
      '<span class="bar-val">' + r.display + '</span>';
    container.appendChild(row);
  });
}

function renderAging(filtered) {
  const data = computeAging(filtered);
  const rows = data.map(d => ({ label: d.stage, value: d.avgDays, display: d.avgDays.toFixed(1) + 'd' }));
  barChart(document.getElementById('aging-chart'), rows);
}

function renderWorkload(filtered) {
  const rows = computeWorkload(filtered, WORKLOAD_MODE).slice(0, 10)
    .map(r => ({ label: r.name, value: r.count, display: String(r.count) }));
  barChart(document.getElementById('workload-chart'), rows);
}
document.getElementById('wl-dm').addEventListener('click', () => {
  WORKLOAD_MODE = 'designManager';
  document.getElementById('wl-dm').classList.add('active');
  document.getElementById('wl-designer').classList.remove('active');
  renderWorkload(getFiltered());
});
document.getElementById('wl-designer').addEventListener('click', () => {
  WORKLOAD_MODE = 'designer';
  document.getElementById('wl-designer').classList.add('active');
  document.getElementById('wl-dm').classList.remove('active');
  renderWorkload(getFiltered());
});

function renderStageFunnel(filtered) {
  const rows = computeStageFunnel(filtered).map(d => ({ label: d.stage, value: d.count, display: String(d.count) }));
  barChart(document.getElementById('stage-chart'), rows);
}

function renderMilestoneChart(filtered) {
  const data = computeMilestoneCompletion(filtered);
  const rows = data.map(d => ({
    label: d.label,
    value: d.available ? d.pct : 3,
    display: d.available ? d.pct.toFixed(0) + '%' : 'No data',
    cls: d.available ? (d.pct < 25 ? 'warn' : '') : 'danger'
  }));
  barChart(document.getElementById('milestone-chart'), rows);
}

function renderOverdueTable(filtered) {
  const list = filtered.filter(p => p.currentOverdue).map(p => ({
    projectNo: p.projectNo, milestone: p.currentOverdue.milestone, daysOverdue: p.currentOverdue.daysOverdue,
    branch: p.branch, designer: p.designer, designManager: p.designManager
  }));
  list.sort((a, b) => (a[OVERDUE_SORT.key] > b[OVERDUE_SORT.key] ? 1 : -1) * OVERDUE_SORT.dir);
  const tbody = document.querySelector('#overdue-table tbody');
  tbody.innerHTML = list.map(r =>
    '<tr><td><span class="badge danger">' + r.daysOverdue + 'd</span></td><td>' + r.projectNo + '</td><td>' + r.milestone +
    '</td><td>' + r.branch + '</td><td>' + r.designer + '</td><td>' + r.designManager + '</td></tr>'
  ).join('');
}
document.querySelectorAll('#overdue-table th').forEach(th => th.addEventListener('click', () => {
  const k = th.dataset.k;
  OVERDUE_SORT.dir = OVERDUE_SORT.key === k ? -OVERDUE_SORT.dir : -1;
  OVERDUE_SORT.key = k;
  renderOverdueTable(getFiltered());
}));

function fmtDate(d) { return d instanceof Date ? d.toISOString().slice(0, 10) : ''; }

function renderProjectTable(filtered) {
  const rows = filtered.slice();
  rows.sort((a, b) => {
    let av = a[TABLE_SORT.key], bv = b[TABLE_SORT.key];
    if (av instanceof Date) av = av.getTime(); if (bv instanceof Date) bv = bv.getTime();
    if (av == null) av = ''; if (bv == null) bv = '';
    return (av > bv ? 1 : av < bv ? -1 : 0) * TABLE_SORT.dir;
  });
  document.getElementById('table-count-note').textContent = rows.length.toLocaleString() + ' projects match current filters';
  const tbody = document.querySelector('#project-table tbody');
  tbody.innerHTML = rows.map(p =>
    '<tr><td>' + p.projectNo + '</td><td>' + p.projectType + '</td><td>' + p.branch + '</td><td>' + p.designer +
    '</td><td>' + p.designManager + '</td><td>' + p.status + '</td><td>' + p.stage + '</td><td>' + p.milestoneName +
    '</td><td>' + (p.activeDays != null ? p.activeDays : '') + '</td><td>' + (p.holdDays != null ? p.holdDays : '') +
    '</td><td>' + fmtDate(p.prebookSignedDone) + '</td></tr>'
  ).join('');
}
document.querySelectorAll('#project-table th').forEach(th => th.addEventListener('click', () => {
  const k = th.dataset.k;
  TABLE_SORT.dir = TABLE_SORT.key === k ? -TABLE_SORT.dir : 1;
  TABLE_SORT.key = k;
  renderProjectTable(getFiltered());
}));

// ---- CSV export ----
function toCsvValue(v) {
  if (v == null) return '';
  const s = v instanceof Date ? fmtDate(v) : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}
document.getElementById('btn-export').addEventListener('click', () => {
  const filtered = getFiltered();
  const headers = ['Project No', 'Project Type', 'Branch', 'Designer', 'Design Manager', 'Status', 'Stage', 'Milestone Name', 'Active Days', 'Hold Days', 'Prebook Signed Date', 'Project Value', 'Overdue Milestone', 'Days Overdue'];
  const lines = [headers.map(toCsvValue).join(',')];
  filtered.forEach(p => {
    lines.push([
      p.projectNo, p.projectType, p.branch, p.designer, p.designManager, p.status, p.stage, p.milestoneName,
      p.activeDays, p.holdDays, p.prebookSignedDone, p.projectValue,
      p.currentOverdue ? p.currentOverdue.milestone : '', p.currentOverdue ? p.currentOverdue.daysOverdue : ''
    ].map(toCsvValue).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ilab-project-review-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ---- Init ----
tryAutoLoad();
