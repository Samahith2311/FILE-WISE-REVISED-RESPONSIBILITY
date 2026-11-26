# Department files

Admin dashboard for tracking the department's accreditation (QAR / NBA) files. There are no physical files and no uploads. Each file has a checklist, and its completion is calculated from the checklist ticks.

Stack: Vite, React 19, TypeScript (strict), Tailwind CSS v4, framer-motion. There is no backend yet. Data is kept in the browser (localStorage) and shared live between tabs.

## Run it

Requires Node 20 or newer. Regenerating the seed also needs Python 3 with `python-docx`.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check (tsc -b) and production build into dist/
npm run check:scoring  # checks the scoring rules and the seed
npm run seed           # rebuild src/data/seed.json from scripts/allocation.docx
```

### Sign in (mock accounts)

| Username  | Password   | Role      |
|-----------|------------|-----------|
| `admin`   | `admin123` | Admin     |
| `viewer1` | `view123`  | View only |
| `viewer2` | `view123`  | View only |

Each browser tab keeps its own session. To see live updates, sign in as `admin` in one tab and as `viewer1` in another tab of the same browser. Admin edits appear in the viewer tab without a refresh.

To start over with the seed data, clear the site's localStorage (key `dept-files:state:v1`).

## What is where

```
scripts/
  allocation.docx        source allocation document (A, D and P tables)
  build_seed.py          docx -> src/data/seed.json
  check_scoring.ts       scoring and seed checks (npm run check:scoring)
src/
  types.ts               data model
  data/seed.json         generated seed: 33 D (incl. D13), 52 A, 31 P rows
  data/staff.ts          staff names for editor suggestions, criteria C1 to C9
  lib/scoring.ts         scoring rules and SCORE_BANDS (single source)
  repo/Repo.ts           Repo interface: every read and write goes through it
  repo/LocalRepo.ts      localStorage + BroadcastChannel implementation
  repo/index.ts          picks the repo implementation   <- Supabase swap point 1
  auth/AuthService.ts    auth interface
  auth/mockAuth.ts       hardcoded accounts (mock)
  auth/index.ts          picks the auth implementation   <- Supabase swap point 2
  store.tsx              React context: state, live subscription, period, actions
  components/            UI
```

## Data rules

- Item status: Completed = 1, Partial = 0.5, Not completed = 0, N/A is left out of the average. The default is Not completed.
- File % = average of its scorable items. A file whose items are all N/A, or that has no items, has no score (shown as `--`, grey).
- Domain % = average of its scored files.
- D13 "Academic files" holds A01 to A52. It has no checklist; its score is the average of the A files.
- Overall = average of the D and P domain scores, so the A files count once, through D13.
- Statuses are stored per item, academic year and semester, keyed `${itemId}|${ay}|${sem}`.
- Bands (`SCORE_BANDS` in `src/lib/scoring.ts`), applied to the rounded score: 95 and above Excellence, 80 to 94 Compliant, 70 to 79 Moderate gaps, below 70 Intensive intervention. **The top two bands are assumed. Confirm them against the QAR sheet.**
- The activity log keeps the latest 500 changes.
- "Add year" keeps every checklist and starts all statuses at Not completed for the new year.

## Seed data

`scripts/build_seed.py` reads the three tables in `scripts/allocation.docx`:

- D files in display order D01 to D12, then D13 (added by the script, since it is not a row in the docx), then D14 to D33.
- A01 to A52.
- P01 to P28, with the sub-parts P08.1 to P08.3 and P11.1 to P11.2 in place of P08 and P11. Each sub-part has `group` set to its parent (`P08`, `P11`).
- Dash-only cells become empty. "(proposed part title)" is removed from titles and kept as `proposedTitle: true`. "C9 — Santosh E (proposed)" becomes `presentedIn: { criteria: "C9", person: "Santosh E", proposed: true }`.
- Every file except D13 gets four starter checklist items, picked by keywords in its title (registers and stock; meetings, committees and circulars; policy and syllabus documents; reports and analysis; or a generic default). The admin edits them in the app.

The script stops with an error if the row counts are not 33 / 52 / 31.

## Moving to Supabase

There are exactly two swap points. No component imports `LocalRepo` or `mockAuth` for data or auth logic.

### 1. Replace LocalRepo: `src/repo/index.ts`

```ts
// before
export const repo: Repo = new LocalRepo()
// after
export const repo: Repo = new SupabaseRepo(supabase)
```

Write `src/repo/SupabaseRepo.ts` implementing the `Repo` interface in `src/repo/Repo.ts`:

- `load()`: select files, checklist items, statuses, academic years and the latest 500 activity rows, and return an `AppState`.
- `subscribe(listener)`: open a Supabase Realtime channel on those tables, and call `listener` with the refreshed state on every change. This replaces BroadcastChannel and gives viewers live updates on every device, not only in other tabs.
- `updateFile`, `setStatus`, `addItem`, `updateItem`, `deleteItem`, `addFile`, `deleteFile`, `addAcademicYear`: one write each, plus an `activity` insert. Doing both in a Postgres function (RPC) keeps them atomic and makes the 500-entry cap easy to enforce.

Suggested tables: `files`, `checklist_items`, `item_statuses (item_id, ay, sem, status, primary key (item_id, ay, sem))`, `academic_years`, `activity`, `profiles (user_id, name, role)`. Seed them once from `src/data/seed.json`.

### 2. Replace the mock auth: `src/auth/index.ts`

```ts
// before
export const auth: AuthService = new MockAuth()
// after
export const auth: AuthService = new SupabaseAuth(supabase)
```

Write `src/auth/supabaseAuth.ts` implementing `AuthService` with Supabase Auth, reading each user's role from `profiles`. Then delete `src/auth/mockAuth.ts` and the development-accounts hint in `src/components/LoginScreen.tsx`.

### Row-level security

The UI hides editing controls from viewers, and LocalRepo refuses writes from non-admins. In the browser, neither of these is a security boundary. With Supabase, enforce access in the database:

- read: any signed-in user (`auth.uid() is not null`)
- write (insert, update, delete): the admin only, for example `exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')`

## Notes

- The mock accounts are visible in the source and are for local development only. Do not deploy the app publicly before the Supabase swap.
- Use the QAR sheet view's Print button, or the browser's print command, to print. The header and navigation are hidden when printing.
