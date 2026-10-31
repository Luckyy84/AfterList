// Run: PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-systems-reliability.mjs
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}', email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
// Reuse the local policy-test Storage catalog; this does not emulate Storage HTTP/bytes.
const bootstrap = await readFile('supabase/verification/postgres-bootstrap.sql', 'utf8')
await db.exec(bootstrap.slice(bootstrap.indexOf('create schema storage;')))
for (const name of (await readdir('supabase/migrations')).sort()) {
 await db.exec(await readFile(`supabase/migrations/${name}`,'utf8'))
}
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002'
await db.exec(`insert into auth.users(id) values ('${a}'),('${b}'); set role authenticated; set request.jwt.claim.sub='${a}';`)
const item={source:'anilist',externalId:'1',title:'Test',type:'Anime',status:'Watching',updatedAt:'2026-01-01T00:00:00Z',currentEpisode:4,privateNotes:'private'}
const edit=async (value,removed=false) => (await db.query('select public.apply_browser_watchlist_edit($1::jsonb,$2::boolean) result',[JSON.stringify(value),removed])).rows[0].result
await edit(item)
await assert.rejects(edit({...item,externalId:'01'}),/Invalid edit/)
await assert.rejects(edit({...item,source:'tmdb',externalId:'movie:1:extra'}),/Invalid edit/)
await edit({...item,currentEpisode:1,updatedAt:'2025-01-01T00:00:00Z'})
assert.equal((await db.query('select current_episode from watchlist_items')).rows[0].current_episode,4)
const removedAt='2026-01-02T00:00:00Z'
await edit({...item,updatedAt:removedAt},true)
await edit(item)
assert.equal((await db.query('select * from watchlist_items')).rows.length,0)
assert.equal((await edit({...item,updatedAt:removedAt})).applied,false)
assert.equal((await edit({...item,updatedAt:'2026-01-03T00:00:00Z'})).applied,true,
 'a newer offline add must beat the browser removal timestamp, not its later replay time')
await edit({...item,updatedAt:'2026-01-04T00:00:00Z'},true)
await db.exec(`set request.jwt.claim.sub='${b}'`)
await edit({...item,user_id:a})
assert.equal((await db.query('select user_id from watchlist_items')).rows[0].user_id,b)
assert.equal((await db.query('select * from watchlist_tombstones')).rows.length,0)
await assert.rejects(db.query('select public.apply_browser_watchlist_edit($1::jsonb,false,$2::uuid)',[JSON.stringify(item),a]),/Account changed/)
await assert.rejects(db.query("select * from refresh_jobs"),/permission denied/)
await assert.rejects(db.query("select public.claim_refresh_job('2026-10-30')"),/permission denied/)
await assert.rejects(edit({...item,updatedAt:'infinity'}),/Invalid edit timestamp/)
await assert.rejects(edit({...item,updatedAt:new Date(Date.now()+600_000).toISOString()}),/Invalid edit timestamp/)
console.log('PASS: stale updates, removal ties, newer offline restore, owner isolation, role boundaries, timestamp validation')
await db.exec(`reset role; delete from auth.users where id='${b}'`)
assert.equal((await db.query('select * from watchlist_items')).rows.length,0)
console.log('PASS: account deletion cascades without orphan tombstones')
await db.exec('set role service_role')
const claim = async () => (await db.query("select public.claim_refresh_job('2026-10-30') result")).rows[0].result
const lease = await claim()
assert.ok(lease)
assert.equal(await claim(),null)
await db.query("select public.finish_refresh_job('2026-10-30',$1,false,2,1,1)",[lease])
const retryLease = await claim()
assert.ok(retryLease)
assert.notEqual(retryLease,lease)
await db.query("select public.finish_refresh_job('2026-10-30',$1,true,2,2,0)",[lease])
assert.equal((await db.query('select status from refresh_jobs')).rows[0].status,'running')
await db.query("select public.finish_refresh_job('2026-10-30',$1,true,2,2,0)",[retryLease])
assert.equal(await claim(),null)
console.log('PASS: durable job lease, retry, stale completion rejection, completed-job deduplication')
const retryDay='2026-10-31'
assert.equal((await db.query('select public.claim_refresh_job($1,false) result',[retryDay])).rows[0].result,null)
for(let attempt=1;attempt<=3;attempt++) {
 const token=(await db.query('select public.claim_refresh_job($1) result',[retryDay])).rows[0].result
 assert.ok(token)
 assert.equal((await db.query('select attempts from refresh_jobs where job_day=$1',[retryDay])).rows[0].attempts,attempt)
 if(attempt===1) {
  await db.exec('reset role')
  await db.query("update refresh_jobs set started_at=clock_timestamp()-interval '11 minutes' where job_day=$1",[retryDay])
  await db.exec('set role service_role')
 } else {
  await db.query('select public.finish_refresh_job($1,$2,false,1,0,1)',[retryDay,token])
 }
}
assert.equal((await db.query('select public.claim_refresh_job($1) result',[retryDay])).rows[0].result,null)
console.log('PASS: no off-hour job creation, expired lease recovery, retry exhaustion at three claims')
await db.close()
