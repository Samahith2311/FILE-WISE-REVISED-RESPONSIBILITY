# Department files

Admin dashboard for tracking the department's accreditation (QAR / NBA) files. There are no physical files and no uploads. Each file has a checklist, and its completion is calculated from the checklist ticks.

**Live site:** [file-tracking-dashboard.vercel.app](https://file-tracking-dashboard.vercel.app/)

Hosted on Vercel (project `file-tracking-dashboard`) in Supabase mode. Every push to `main` redeploys it. Sign in with the email and password the department gave you; admins can edit, everyone else can only view. Accounts are created by the department, not through the site.

Stack: Vite, React 19, TypeScript (strict), Tailwind CSS v4, framer-motion, and optionally Supabase.

The app runs in one of two modes, set by `VITE_DATA_BACKEND` in `.env`:

| Mode | Data | Sign-in | Live updates |
|------|------|---------|--------------|
| `local` (default) | this browser's localStorage, works offline | mock accounts in `src/auth/mockAuth.ts` | other tabs of the same browser |
| `supabase` | Supabase Postgres | Supabase email and password | every signed-in browser, on any computer |

## Run it

Requires Node 20 or newer. Regenerating the seed also needs Python 3 with `python-docx`.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check (tsc -b) and production build into dist/
npm run check:scoring  # scoring, faculty and seed checks
npm run check:sql      # migrations, row-level security, RPCs and seed.sql on an in-memory Postgres
npm run seed           # rebuild src/data/seed.json from scripts/allocation.docx
npm run seed:sql       # rebuild supabase/seed.sql from src/data/seed.json
npm run import:local -- export.json   # turn a local-mode export into SQL (see below)
```

### Local mode accounts (mock)

| Username  | Password   | Role      |
|-----------|------------|-----------|
| `admin`   | `admin123` | Admin     |
| `viewer1` | `view123`  | View only |
| `viewer2` | `view123`  | View only |

Each browser tab keeps its own session. To see live updates, sign in as `admin` in one tab and as `viewer1` in another tab of the same browser. To start over with the seed data, clear the site's localStorage (key `dept-files:state:v1`).

The mock accounts are visible in the source. Do not put a local-mode build on the internet.

## Set up Supabase mode

Do these steps once. They need the Supabase dashboard (supabase.com).

1. **Create a project.** A free project is enough. Free projects pause after a week without activity. Open the dashboard and press Restore to wake one up; the data is kept.
2. **Create the tables.** Either:
   - with the CLI: `npx supabase login`, then `npx supabase link --project-ref <your project ref>`, then `npx supabase db push`; or
   - in the dashboard's SQL Editor: open each file in `supabase/migrations/` in name order, paste it, and run it.
3. **Load the data.** In the SQL Editor, paste and run `supabase/seed.sql`. It adds the 2026-27 year, the 31 faculty, C1 to C9, the 116 files and their checklists. Running it twice does no harm.
   To bring over edits made in local mode instead, see [Move local data to Supabase](#move-local-data-to-supabase).
4. **Turn off public sign-ups.** Go to Authentication, then Sign In / Providers, and switch off "Allow new users to sign up". Only the accounts you create can sign in.
5. **Create the three users.** Go to Authentication, then Users, then Add user, then Create new user. Enter an email and password, and tick Auto Confirm User. Do this for the admin and for both viewers.
6. **Give each user a profile.** The role comes only from this table, never from user metadata. In the SQL Editor, run this with your three email addresses:

   ```sql
   insert into public.profiles (user_id, display_name, role)
   select id, 'Department admin', 'admin' from auth.users where email = 'admin@your-college.edu'
   union all
   select id, 'Viewer one', 'viewer' from auth.users where email = 'viewer1@your-college.edu'
   union all
   select id, 'Viewer two', 'viewer' from auth.users where email = 'viewer2@your-college.edu';
   ```

   The display name is shown in the header and in the activity log. An account without a profile row cannot sign in.
7. **Set `.env`.** Copy `.env.example` to `.env`. Set `VITE_DATA_BACKEND=supabase`. Under Project Settings, then API Keys, copy the Project URL into `VITE_SUPABASE_URL` and the publishable (anon) key into `VITE_SUPABASE_PUBLISHABLE_KEY`.
   **Never use the service role or secret key in this app or in any committed file.** The publishable key is safe in the browser because row-level security protects the data.
8. **Restart** `npm run dev` and sign in with an email address. For the other computers, run `npm run build` with the same `.env` and host the `dist/` folder on any static host; the settings are built into the files.
9. **Run the advisors.** In the dashboard, go to Advisors and run the Security Advisor and the Performance Advisor. Fix anything they report. One warning is expected: `public.is_admin()` is a security definer function that signed-in users can call. This is by design. It is what the row-level security policies use, and it only tells callers whether they are the admin. To clear the warning, move it to a schema the API does not expose and update the policies.
10. **Check that viewers cannot write.** In the SQL Editor, use the role selector to run as the `authenticated` role, impersonating a viewer. Then run `insert into public.academic_years (ay) values ('2099-00');`. It must fail with "new row violates row-level security policy". `npm run check:sql` runs the same checks offline on every table and function.

To go back to local mode, set `VITE_DATA_BACKEND=local` and restart.

### Move local data to Supabase

1. In local mode, sign in as `admin` and press **Export data (JSON)** in the header.
2. Run `npm run import:local -- path/to/department-files-export-YYYY-MM-DD.json`. It writes a `.sql` file next to the export.
3. Run that SQL in the Supabase SQL Editor, after step 2 of the setup instead of `seed.sql`. **It replaces all file data in the database:** years, faculty, criteria, files, checklists, statuses and the activity log. Profiles and accounts are kept.

## Deploy on Vercel

Set up Supabase mode first (above). Then:

1. **Import the repo.** In Vercel, choose Add New, then Project, and import this GitHub repository. `vercel.json` already sets the framework (Vite), the build command (`npm run build`), the output folder (`dist`), the rewrite of every route to `index.html`, and the security headers.
2. **Set the environment variables.** Under Environment Variables, add:
   - `VITE_DATA_BACKEND` = `supabase`
   - `VITE_SUPABASE_URL` = the Project URL from Supabase (Project Settings, then API Keys)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable (anon) key

   **Never add the service role or secret key.** These values are built into files that every visitor downloads.
   On Vercel the build stops with an error if `VITE_DATA_BACKEND` is not `supabase`, if the URL or key is missing, or if the key is a secret key. Local mode and its mock accounts can never be deployed. Builds on your own computer are not checked.
3. **Deploy.** Press Deploy and wait for the URL. This project is live at `https://file-tracking-dashboard.vercel.app`.
4. **Tell Supabase the address.** In Supabase, go to Authentication, then URL Configuration, and set the Site URL to the Vercel URL.

Free Supabase projects pause after a week without activity, and the deployed app then cannot load data or sign in. Open the Supabase dashboard and press Restore to wake the project up; the data is kept.

The Content-Security-Policy allows only the app itself and `https://*.supabase.co` / `wss://*.supabase.co`. `npm run preview` sends the same headers, so you can test a build under them locally.

## How Supabase mode works

- **Swap points.** `src/repo/index.ts` and `src/auth/index.ts` pick `LocalRepo` and `MockAuth`, or `SupabaseRepo` and `SupabaseAuth`, from `VITE_DATA_BACKEND`. No component knows which one is in use.
- **Security.** Every table has row-level security. Signed-in users can read; only `public.is_admin()` (role `admin` in `profiles`) can insert, update or delete. Users can read only their own profile row and cannot change any role.
- **Bulk actions.** Renaming faculty, reassigning files, bulk criteria edits and adding a year are Postgres functions (`rename_faculty`, `reassign_faculty`, `bulk_update_file_criteria`, `add_academic_year`). Each runs as one transaction and writes one summary row to the activity log. Every other edit is a single request.
- **Activity log.** The database writes the log, not the app. Triggers on files, checklist items, statuses, faculty, criteria and years add one row per edit, in the same transaction as the edit. If the log row cannot be written, the edit is rolled back too. The wording is the same as in local mode. Bulk functions turn the triggers off for their own changes, and deleting a file logs only the file, not its items and statuses. SQL run without a signed-in user (the seed, the import, the SQL Editor) is not logged.
- **The log cannot be changed from the app.** Rows are added only by `private.log_activity`, in the `private` schema that the API does not expose, so it cannot be called through REST or `rpc()`. Signed-in users can read the log. Nobody, admin included, can insert, edit or delete log rows through the API. Do not add `private` to the exposed schemas under Project Settings, then API.
- **Live updates.** The tables are in the `supabase_realtime` publication. `SupabaseRepo` applies each `postgres_changes` event to its cached state. After every reconnect or channel error it reloads everything, so nothing is missed. The screen changes only after Supabase confirms a write; failures show the usual error message.
- **Sign-out** closes the realtime channel and drops the cached data.

## What is where

```
scripts/
  allocation.docx          source allocation document (A, D and P tables)
  build_seed.py            docx -> src/data/seed.json (files, checklists, faculty, criteria)
  build_seed_sql.ts        seed.json -> supabase/seed.sql
  import_local_export.ts   local export JSON -> SQL that replaces the database's file data
  sql_from_state.ts        shared SQL writer for the two scripts above
  check_scoring.ts         scoring, faculty and seed checks
  check_sql.mjs            migrations, RLS, RPC, activity-log and seed checks on PGlite
supabase/
  migrations/              schema, is_admin, RLS policies, RPCs, realtime publication, log triggers
  seed.sql                 generated starting data
src/
  types.ts                 data model
  data/seed.json           generated seed: 33 D (incl. D13), 52 A, 31 P rows, 31 faculty, C1 to C9
  lib/scoring.ts           scoring rules and SCORE_BANDS (single source)
  lib/faculty.ts           name matching, rename, reassign and bulk criteria rules
  lib/supabase.ts          backend setting and the Supabase client
  repo/Repo.ts             Repo interface: every read and write goes through it
  repo/LocalRepo.ts        localStorage + BroadcastChannel implementation
  repo/SupabaseRepo.ts     Supabase implementation with realtime
  repo/supabaseMap.ts      database rows <-> app types
  repo/shared.ts           validation and log wording used by both repos
  auth/                    AuthService, MockAuth, SupabaseAuth
  store.tsx                React context: state, live subscription, period, actions
  components/              UI
```

## Data rules

- Item status: Completed = 1, Partial = 0.5, Not completed = 0, N/A is left out of the average. The default is Not completed.
- File % = average of its scorable items. A file whose items are all N/A, or that has no items, has no score (shown as `--`, grey).
- Domain % = average of its scored files.
- D13 "Academic files" holds A01 to A52. It has no checklist; its score is the average of the A files.
- Overall = average of the D and P domain scores, so the A files count once, through D13.
- Statuses are stored per item, academic year and semester, keyed `${itemId}|${ay}|${sem}`.
- Bands (`SCORE_BANDS` in `src/lib/scoring.ts`), applied to the rounded score: 95 and above Excellence, 80 to 94 Compliant, 70 to 79 Moderate gaps, below 70 Intensive intervention. **The top two bands are assumed. Confirm them against the QAR sheet.**
- The activity log shows the latest 500 changes.
- "Add year" keeps every checklist and starts all statuses at Not completed for the new year.
- People are free text in files ("Bhavya H S, Shalini M K"). Names match ignoring titles (Prof., Dr., Mr., Ms.), case and notes such as "(proposed)", so "Mr. Sharath" and "Sharath" are one person. Renaming a faculty member updates every file and criterion that names them. Reassigning moves only the ticked files and can record the old maintainer as the previous maintainer.

## Seed data

`scripts/build_seed.py` reads the three tables in `scripts/allocation.docx`:

- D files in display order D01 to D12, then D13 (added by the script, since it is not a row in the docx), then D14 to D33.
- A01 to A52.
- P01 to P28, with the sub-parts P08.1 to P08.3 and P11.1 to P11.2 in place of P08 and P11. Each sub-part has `group` set to its parent (`P08`, `P11`).
- Dash-only cells become empty. "(proposed part title)" is removed from titles and kept as `proposedTitle: true`. "C9 — Santosh E (proposed)" becomes `presentedIn: { criteria: "C9", person: "Santosh E", proposed: true }`.
- Every file except D13 gets four starter checklist items, picked by keywords in its title. The admin edits them in the app.
- Faculty: the 31 staff from the staff list, with fixed ids. Criteria: C1 to C9 with NBA SAR titles (**check them against the department's SAR**), and each coordinator set to the person who presents most files under that criterion.

The script stops with an error if the row counts are not 33 / 52 / 31.

## Notes

- Use the QAR sheet view's Print button, or the browser's print command, to print. The header and navigation are hidden when printing.
