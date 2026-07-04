# iLab project review dashboard

## What's in this folder
- `index.html` — the dashboard page
- `config.js` — column mapping (which Dump.xlsx column feeds which field)
- `data-core.js` — filtering and metric calculations
- `app.js` — UI wiring (filters, charts, table, CSV export)

## One-time setup (GitHub Pages)
1. Create a repo (or use an existing one), commit these 4 files plus your current `Dump.xlsx` at the repo root.
2. Repo Settings → Pages → deploy from the `main` branch, root folder.
3. Open the published URL — the dashboard auto-loads `Dump.xlsx` from the same folder.

## Every Monday
1. Export a fresh `Dump.xlsx` from Pulse.
2. Replace the old `Dump.xlsx` in the repo with the new one, commit and push.
3. Refresh the dashboard page — that's it. No other file needs to change.

If you ever want to preview a file without committing it first, use the
"Upload data" button on the dashboard itself — it reads the file locally in
your browser, nothing is uploaded anywhere.

## Known data limitations (as of this build)
- **Budget finalization** has no source column anywhere in Dump.xlsx — shown
  as "No data" rather than 0%, since it isn't tracked at all yet.
- **Overdue milestones** are computed by matching each project's current
  `Milestone Name` to its Planned/Done date pair (e.g. "DCM Due" → DCM
  Planned/Done). Pipeline stages without a clear tracked equivalent
  (Production, Dispatch Due, the %-Payment stages, etc.) are not counted as
  overdue — not because they're never late, but because there's no reliable
  planned-date field for them yet.
- **Aging** is `Active Days` / `Hold Days` as tracked in Dump — i.e. how long
  the project overall has been active/on hold, not time in the current stage
  specifically (no stage-entry-date field exists in the source data).
- Design Manager assignment can differ slightly from what you're used to
  seeing in DM_Review.xlsx, since this dashboard reads live from Dump.xlsx
  directly (more current, no export-time drift).
