// Column mapping config, derived from Dump.xlsx header analysis + DM_Review.xlsx cross-reference
// All indices are 0-based against Dump.xlsx row 1 headers.
const COLS = {
  projectNo: 0,
  projectType: 1,
  branch: 5,
  designer: 7,
  designManager: 9,
  status: 17,
  stage: 18,
  milestoneName: 19,
  projectValue: 20,
  activeDays: 25,
  holdDays: 26,
  prebookSignedDone: 34,
  notes1Content: 119,
  notes2Content: 122,
  notes3Content: 125,
};

// Milestones with Planned/Done column pairs (for completion % and overdue calc)
const MILESTONES = [
  { key: 'dcm',        label: 'DCM',            planned: 35,  done: 36 },
  { key: 'cdp',        label: 'CDP',            planned: 37,  done: 38 },
  { key: 'designfee',  label: 'Design fee',     planned: 45,  done: 46 },
  { key: 'agreement',  label: 'Agreement',      planned: 47,  done: 48 },
  { key: 'introcall',  label: 'Intro call',     planned: 49,  done: 50 },
  { key: 'welcome',    label: 'Welcome call',   planned: 51,  done: 52 },
  { key: 'alignment',  label: '1st design pres.', planned: 39, done: 40 },
  { key: 'sitemeasure',label: 'Site measurement', planned: 104, done: 105 },
  { key: 'dem1',       label: 'DEM-1',          planned: 126, done: 127 },
  { key: 'dem1fee',    label: 'DEM-1 fee',      planned: 57,  done: 58 },
  { key: 'dem2',       label: 'DEM-2',          planned: 128, done: 129 },
  { key: 'crossmeasure',label: 'Cross measurement', planned: 59, done: 60 },
  { key: 'dem3',       label: 'DEM-3',          planned: 43,  done: 44 },
  { key: 'hoto',       label: 'HOTO',           planned: 65,  done: 66 },
  { key: 'qa3d',       label: '3D QA',          planned: 67,  done: 68 },
  { key: 'sitereadiness', label: 'Site readiness', planned: 100, done: 101 },
  { key: 'pko',        label: 'PKO signoff',    planned: 69,  done: 70 },
  // Budget finalization has NO source column in Dump at all - flagged as unavailable, not computed
];

const NO_DATA_MILESTONES = [
  { key: 'budget', label: 'Budget finalization' }
];
