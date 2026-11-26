/**
 * Offline check of supabase/migrations and supabase/seed.sql on real Postgres (PGlite),
 * with small stand-ins for Supabase's auth schema, roles and realtime publication.
 * Checks row-level security (a viewer's writes are refused by the database), the RPCs
 * and the seed. It does not replace running the advisors on the real project.
 * Run: npm run check:sql
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const dir = process.argv[2] ?? join(root, 'supabase/migrations')
const db = new PGlite()

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`)

for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
    console.log('applied', f)
  } catch (e) {
    console.error('FAILED', f, e.message)
    process.exit(1)
  }
}

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const VIEWER = '00000000-0000-0000-0000-00000000000b'
await db.exec(`
  insert into auth.users values ('${ADMIN}'), ('${VIEWER}');
  insert into public.profiles values ('${ADMIN}', 'Department admin', 'admin'), ('${VIEWER}', 'Viewer one', 'viewer');
  insert into public.academic_years (ay) values ('2026-27');
  insert into public.faculty (name) values ('Akshatha M'), ('Gagan P'), ('Mr. Sharath');
  insert into public.criteria values ('C7', 'Facilities', 'Akshatha M'), ('C9', 'Support', 'Santosh E');
  insert into public.files (id, code, domain, sort_order, title, maintainer, presented_criteria, presented_person, related_criteria, container) values
    ('A13', 'A13', 'A', 13000, 'Internal assessment records', 'Akshatha M', 'C3', 'Malashree M S', '{}', null),
    ('A14', 'A14', 'A', 14000, 'Final CIE marks', 'Akshatha M', 'C3', 'Malashree M S', '{}', null),
    ('D03', 'D03', 'D', 3000, 'Inward register', 'Mr. Sharath', 'C9', 'Santosh E', '{C9}', null),
    ('D13', 'D13', 'D', 13000, 'Academic files', 'Lokesh T P', '', '', '{}', 'A'),
    ('D32', 'D32', 'D', 32000, 'Board of Examiners', 'Akshatha M (proposed)', 'C3', 'Malashree M S', '{C9}', null);
  insert into public.checklist_items (id, file_id, sort_order, label) values ('A13-i1', 'A13', 1, 'Data collected');
`)

async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
const one = async (sql) => (await db.query(sql)).rows[0]
let n = 0
const ok = (name) => console.log(`  ok  ${++n} ${name}`)
async function rejects(sql, code) {
  try {
    await db.exec(sql)
  } catch (e) {
    if (code) assert.equal(e.code, code, `${sql}: expected ${code}, got ${e.code} ${e.message}`)
    return e
  }
  assert.fail(`expected an error from: ${sql}`)
}

// name helpers match src/lib/faculty.ts cases
assert.equal((await one(`select public.replace_person('Mr. Sharath', 'Sharath', 'Sagar') r`)).r, 'Sagar')
assert.equal((await one(`select public.replace_person('Akshatha M (proposed)', 'Akshatha M', 'Gagan P') r`)).r, 'Gagan P (proposed)')
assert.equal((await one(`select public.replace_person('Bhavya H S, Shalini M K', 'Bhavya H S', 'Shalini M K') r`)).r, 'Shalini M K')
assert.equal((await one(`select public.replace_person('C7 Team', 'Akshatha M', 'Gagan P') r`)).r, 'C7 Team')
assert.equal((await one(`select public.name_key('Dr. Akshath M J (proposed)') r`)).r, 'akshath m j')
ok('name helpers match the JS rules')

// viewer is refused by the database
await as(VIEWER, async () => {
  await rejects(`insert into public.files (id, code, domain, sort_order, title) values ('A99','A99','A',99000,'x')`, '42501')
  const upd = await db.query(`update public.files set title = 'hacked' where id = 'A13' returning id`)
  assert.equal(upd.rows.length, 0)
  await rejects(`insert into public.item_status (item_id, ay, sem, status) values ('A13-i1','2026-27','Odd','completed')`, '42501')
  await rejects(`select public.rename_faculty((select id from public.faculty where name='Gagan P'), 'X')`, '42501')
  await rejects(`select public.reassign_faculty('[{"fileId":"A13","from":"Akshatha M","to":"X"}]', true)`, '42501')
  await rejects(`select public.bulk_update_file_criteria(array['A13'], '{"criteria":"C1"}')`, '42501')
  await rejects(`select public.add_academic_year('2027-28')`, '42501')
  const del = await db.query(`delete from public.files returning id`)
  assert.equal(del.rows.length, 0)
  const prof = await db.query(`select * from public.profiles`)
  assert.equal(prof.rows.length, 1)
  assert.equal(prof.rows[0].role, 'viewer')
  const role = await db.query(`update public.profiles set role = 'admin' returning user_id`)
  assert.equal(role.rows.length, 0)
  assert.equal((await one(`select count(*)::int c from public.files`)).c, 5)
})
assert.equal((await one(`select title from public.files where id='A13'`)).title, 'Internal assessment records')
assert.equal((await one(`select role from public.profiles where user_id='${VIEWER}'`)).role, 'viewer')
ok('viewer writes and RPCs are refused; viewer reads files and only its own profile')

await db.exec(`set role anon;`)
assert.equal((await db.query(`select * from public.files`)).rows.length, 0)
await rejects(`select public.is_admin()`, '42501')
await db.exec(`reset role;`)
ok('anon sees nothing and cannot call functions')

// admin RPCs
await as(ADMIN, async () => {
  await db.exec(`insert into public.item_status (item_id, ay, sem, status) values ('A13-i1','2026-27','Odd','completed')
    on conflict (item_id, ay, sem) do update set status = excluded.status`)
  await db.exec(`insert into public.item_status (item_id, ay, sem, status) values ('A13-i1','2026-27','Odd','partial')
    on conflict (item_id, ay, sem) do update set status = excluded.status`)
  assert.equal((await one(`select status from public.item_status`)).status, 'partial')

  await db.exec(`select public.rename_faculty((select id from public.faculty where name='Akshatha M'), 'Akshatha M R')`)
  assert.equal((await one(`select maintainer from public.files where id='D32'`)).maintainer, 'Akshatha M R (proposed)')
  assert.equal((await one(`select coordinator from public.criteria where id='C7'`)).coordinator, 'Akshatha M R')
  let log = await one(`select who, what, file_codes from public.activity_log order by id desc limit 1`)
  assert.equal(log.who, 'Department admin')
  assert.equal(log.what, 'Renamed faculty Akshatha M to Akshatha M R (3 files updated)')
  assert.deepEqual(log.file_codes, ['D32', 'A13', 'A14'])
  await rejects(`select public.rename_faculty((select id from public.faculty where name='Gagan P'), 'sharath')`, '23505')

  await db.exec(`select public.reassign_faculty('[{"fileId":"A13","from":"Akshatha M R","to":"Gagan P"},{"fileId":"D03","from":"Akshatha M R","to":"Gagan P"}]', true)`)
  const a13 = await one(`select maintainer, previous_maintainer from public.files where id='A13'`)
  assert.deepEqual([a13.maintainer, a13.previous_maintainer], ['Gagan P', 'Akshatha M R'])
  assert.equal((await one(`select maintainer from public.files where id='D03'`)).maintainer, 'Mr. Sharath')
  log = await one(`select what, file_codes from public.activity_log order by id desc limit 1`)
  assert.equal(log.what, 'Reassigned 1 files: Akshatha M R to Gagan P (previous maintainer recorded)')
  await rejects(`select public.reassign_faculty('[{"fileId":"D03","from":"Nobody","to":"Gagan P"}]', false)`, 'P0002')

  await db.exec(`select public.bulk_update_file_criteria(array['D03','D32','D13'], '{"criteria":"C7","addRelated":["C2","C1"],"removeRelated":["C9"]}')`)
  const d03 = await one(`select presented_criteria, presented_person, related_criteria from public.files where id='D03'`)
  assert.deepEqual([d03.presented_criteria, d03.presented_person, d03.related_criteria], ['C7', 'Santosh E', ['C1', 'C2']])
  assert.equal((await one(`select presented_criteria from public.files where id='D13'`)).presented_criteria, '')
  log = await one(`select what, file_codes from public.activity_log order by id desc limit 1`)
  assert.deepEqual([log.what, log.file_codes], ['Updated criteria on 2 files', ['D03', 'D32']])
  // all or nothing: an invalid criterion fails the whole call
  await rejects(`select public.bulk_update_file_criteria(array['D03','D32'], '{"criteria":"C99"}')`, '23514')
  assert.equal((await one(`select presented_criteria from public.files where id='D32'`)).presented_criteria, 'C7')

  await db.exec(`select public.add_academic_year('2027-28')`)
  assert.equal((await one(`select count(*)::int c from public.academic_years`)).c, 2)
  await rejects(`select public.add_academic_year('2027-28')`, '23505')
  await rejects(`select public.add_academic_year('27-28')`, '22023')

  // cascade: deleting a file removes its items and statuses
  await db.exec(`delete from public.files where id='A13'`)
  assert.equal((await one(`select count(*)::int c from public.item_status`)).c, 0)
})
ok('admin upsert, rename, reassign, bulk criteria (atomic), add year, cascades')

const pub = await db.query(`select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1`)
assert.equal(pub.rows.length, 7)
ok('7 tables in supabase_realtime')

// The seed loads on top (twice, to prove it is re-runnable) and keeps the docx order.
const seed = readFileSync(join(root, 'supabase/seed.sql'), 'utf8')
await db.exec(`delete from public.activity_log; delete from public.files; delete from public.faculty; delete from public.criteria;`)
await db.exec(seed)
await db.exec(seed)
const counts = await one(`select
  (select count(*)::int from public.files where domain = 'D') d, (select count(*)::int from public.files where domain = 'A') a,
  (select count(*)::int from public.files where domain = 'P') p, (select count(*)::int from public.checklist_items) i,
  (select count(*)::int from public.faculty) fa, (select count(*)::int from public.criteria) c,
  (select string_agg(code, ',' order by sort_order) from public.files where domain = 'D') dorder`)
assert.deepEqual([counts.d, counts.a, counts.p, counts.i, counts.fa, counts.c], [33, 52, 31, 460, 31, 9])
assert.ok(counts.dorder.startsWith('D01,D02') && counts.dorder.includes('D12,D13,D14'))
ok('seed.sql loads twice: 33 D, 52 A, 31 P, 460 items, 31 faculty, 9 criteria')
console.log('All SQL checks passed.')
