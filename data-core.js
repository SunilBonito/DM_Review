// Core data transform logic - pure functions, no DOM/browser dependency, so testable in Node.

function buildProjects(rows) {
  // rows: array of arrays, rows[0] is header, data starts rows[1]
  const today = new Date();
  const projects = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[COLS.projectNo] == null) continue;

    const overdue = [];
    for (const m of MILESTONES) {
      const planned = r[m.planned];
      const done = r[m.done];
      if (planned instanceof Date && !(done instanceof Date)) {
        if (planned < today) {
          const daysOverdue = Math.floor((today - planned) / 86400000);
          overdue.push({ milestone: m.label, planned, daysOverdue });
        }
      }
    }

    const latestNote = r[COLS.notes3Content] || r[COLS.notes2Content] || r[COLS.notes1Content] || null;

    projects.push({
      projectNo: r[COLS.projectNo],
      projectType: r[COLS.projectType] || 'Unspecified',
      branch: r[COLS.branch] || 'Unspecified',
      designer: r[COLS.designer] || 'Unassigned',
      designManager: r[COLS.designManager] || 'Unassigned',
      status: r[COLS.status] || 'Unspecified',
      stage: r[COLS.stage] || 'Unspecified',
      milestoneName: r[COLS.milestoneName] || 'Unspecified',
      projectValue: typeof r[COLS.projectValue] === 'number' ? r[COLS.projectValue] : null,
      activeDays: typeof r[COLS.activeDays] === 'number' ? r[COLS.activeDays] : null,
      holdDays: typeof r[COLS.holdDays] === 'number' ? r[COLS.holdDays] : null,
      prebookSignedDone: r[COLS.prebookSignedDone] instanceof Date ? r[COLS.prebookSignedDone] : null,
      latestNote: latestNote,
      overdue: overdue,
      overdueCount: overdue.length,
      _raw: r,
    });
  }
  return projects;
}

function getUniqueValues(projects, field) {
  const set = new Set();
  for (const p of projects) set.add(p[field]);
  return Array.from(set).sort();
}

function matchesFilters(p, filters) {
  const { projectType, branch, designer, designManager, status, stage, milestoneName, dateFrom, dateTo } = filters;
  if (projectType && projectType.length && !projectType.includes(p.projectType)) return false;
  if (branch && branch.length && !branch.includes(p.branch)) return false;
  if (designer && designer.length && !designer.includes(p.designer)) return false;
  if (designManager && designManager.length && !designManager.includes(p.designManager)) return false;
  if (status && status.length && !status.includes(p.status)) return false;
  if (stage && stage.length && !stage.includes(p.stage)) return false;
  if (milestoneName && milestoneName.length && !milestoneName.includes(p.milestoneName)) return false;
  if (dateFrom) {
    if (!p.prebookSignedDone || p.prebookSignedDone < dateFrom) return false;
  }
  if (dateTo) {
    if (!p.prebookSignedDone || p.prebookSignedDone > dateTo) return false;
  }
  return true;
}

function filterProjects(projects, filters) {
  return projects.filter(p => matchesFilters(p, filters));
}

function computeKPIs(filtered) {
  const total = filtered.length;
  let active = 0, hold = 0, lost = 0, completed = 0, overdueProjects = 0, totalValue = 0, valueCount = 0;
  for (const p of filtered) {
    const s = (p.status || '').toLowerCase();
    if (s === 'active') active++;
    else if (s === 'hold') hold++;
    else if (s === 'lost') lost++;
    else if (s === 'completed' || s === 'complete') completed++;
    if (p.overdueCount > 0) overdueProjects++;
    if (typeof p.projectValue === 'number') { totalValue += p.projectValue; valueCount++; }
  }
  return { total, active, hold, lost, completed, overdueProjects, totalValue, avgValue: valueCount ? totalValue / valueCount : 0 };
}

function computeStageFunnel(filtered) {
  const order = ['Prospect', 'Preproduction', 'Design', 'Production', 'Installation', 'Handover', 'Complete'];
  const counts = {};
  for (const p of filtered) counts[p.stage] = (counts[p.stage] || 0) + 1;
  const known = order.filter(s => counts[s] !== undefined).map(s => ({ stage: s, count: counts[s] }));
  const rest = Object.keys(counts).filter(s => !order.includes(s)).map(s => ({ stage: s, count: counts[s] }));
  return known.concat(rest);
}

function computeWorkload(filtered, field) {
  const counts = {};
  for (const p of filtered) {
    const k = p[field];
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function computeAging(filtered) {
  const buckets = { 'Prospect': [], 'Preproduction': [], 'Design': [], 'Production': [], 'Installation': [], 'Handover': [], 'Complete': [] };
  for (const p of filtered) {
    if (typeof p.activeDays === 'number') {
      if (!buckets[p.stage]) buckets[p.stage] = [];
      buckets[p.stage].push(p.activeDays);
    }
  }
  return Object.entries(buckets)
    .filter(([, arr]) => arr.length)
    .map(([stage, arr]) => ({ stage, avgDays: arr.reduce((a, b) => a + b, 0) / arr.length, count: arr.length }));
}

function computeMilestoneCompletion(filtered) {
  const total = filtered.length || 1;
  return MILESTONES.map(m => {
    let done = 0;
    for (const p of filtered) {
      if (p._raw[m.done] instanceof Date) done++;
    }
    return { key: m.key, label: m.label, pct: (done / total) * 100, done, total: filtered.length, available: true };
  }).concat(NO_DATA_MILESTONES.map(m => ({ key: m.key, label: m.label, pct: 0, done: 0, total: filtered.length, available: false })));
}

function computeOverdueList(filtered) {
  const list = [];
  for (const p of filtered) {
    for (const o of p.overdue) {
      list.push({ projectNo: p.projectNo, milestone: o.milestone, planned: o.planned, daysOverdue: o.daysOverdue, designer: p.designer, designManager: p.designManager, branch: p.branch });
    }
  }
  return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

if (typeof module !== 'undefined') {
  module.exports = { buildProjects, getUniqueValues, filterProjects, computeKPIs, computeStageFunnel, computeWorkload, computeAging, computeMilestoneCompletion, computeOverdueList };
}
