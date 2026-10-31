// Disposable PostgreSQL (PGlite), never connects to Supabase. See docs/SYSTEMS_TRACKING.md.
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`)
// Reuse the local policy-test Storage catalog; this does not emulate Storage HTTP/bytes.
const bootstrap = await readFile('supabase/verification/postgres-bootstrap.sql', 'utf8')
await db.exec(bootstrap.slice(bootstrap.indexOf('create schema storage;')))
for (const file of (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
  await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
}
const owner = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const item = '10000000-0000-0000-0000-000000000001'
const anime = '10000000-0000-0000-0000-000000000002'
const list = '20000000-0000-0000-0000-000000000001'
await db.exec(`insert into auth.users values('${owner}'),('${other}');
set request.jwt.claim.sub='${owner}';
insert into public.watchlist_items(id,user_id,source,external_id,title,type,status,current_episode) values
('${item}','${owner}','tmdb','tv:100','Series','TV Series','Watching',8),
('${anime}','${owner}','anilist','200','Anime Season','Anime','Planned',0);
insert into public.custom_lists(id,user_id,name,slug) values('${list}','${owner}','Weekend','weekend');
set role authenticated;`)
await db.query('select public.save_season_progress($1,2,5,12)', [item])
assert.equal((await db.query('select current_episode from public.watchlist_items where id=$1', [item])).rows[0].current_episode, 8)
await assert.rejects(db.query('select public.save_season_progress($1,2,13,12)', [item]), /Invalid season progress/)
await assert.rejects(db.query('select public.save_season_progress($1,2,1,12)', [anime]), /AniList seasons/)
await db.query('select public.save_custom_list_items($1,$2::uuid[])', [list, [anime, item]])
assert.deepEqual((await db.query('select watchlist_item_id from public.custom_list_items order by position')).rows.map((row) => row.watchlist_item_id), [anime, item])
await assert.rejects(db.query('select public.save_custom_list_items($1,$2::uuid[])', [list, [item,item]]), /Invalid list selection/)
await db.query('select public.reorder_custom_lists($1::uuid[])', [[list]])
await db.exec(`reset role; set request.jwt.claim.sub='${owner}';
insert into public.watchlist_items(id,user_id,source,external_id,title,type,status,updated_at) values
('10000000-0000-0000-0000-000000000003','${owner}','tmdb','movie:300','Film','Movie','Planned','2026-01-01'),
('10000000-0000-0000-0000-000000000004','${owner}','anilist','400','Film anime','Anime','Planned','2026-01-02'); set role authenticated;`)
await db.query("select public.confirm_media_match('tmdb','movie:300','anilist','400')")
await db.query("select public.undo_media_merge('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003')")
assert.equal((await db.query("select count(*)::integer as n from public.watchlist_items where id in ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004') and merged_into_id is null")).rows[0].n, 2)
await db.query("select public.save_anime_season_match($1,2,'200')", [item])
assert.equal((await db.query('select season from public.anime_season_matches')).rows[0].season, 2)
await assert.rejects(db.query("select public.confirm_media_match('tmdb','tv:100','anilist','200')"), /season-level match/)
await db.query("select public.save_anime_season_match($1,2,null)", [item])
assert.equal((await db.query('select * from public.anime_season_matches')).rows.length, 0)
assert.equal((await db.query('select * from public.media_match_audit')).rows.length, 4)
await db.exec(`set request.jwt.claim.sub='${other}'`)
assert.equal((await db.query('select * from public.season_progress')).rows.length, 0)
await assert.rejects(db.query('select public.save_season_progress($1,1,1,12)', [item]), /Title not found/)
await assert.rejects(db.query('select public.save_custom_list_items($1,$2::uuid[])', [list, []]), /List not found/)
await db.exec('set role anon')
await assert.rejects(db.query('select public.save_season_progress($1,1,1,12)', [item]), /permission denied/)
await db.exec(`reset role; set request.jwt.claim.sub='${owner}';
select public.claim_profile_username('reader'); update public.profiles set is_public=true,show_library=true where user_id='${owner}'; set role anon;`)
const publicPage = (await db.query("select public.get_public_library('reader',1,0) as page")).rows[0].page
assert.equal(publicPage.hasMore, true)
assert.equal(publicPage.nextOffset, 1)
assert.equal(publicPage.items.length, 1)
await assert.rejects(db.query("select public.get_public_library('reader',null,0)"), /Invalid public library/)
await db.exec(`reset role; set request.jwt.claim.sub='${owner}';
update public.watchlist_items set private_notes='Private change' where id='${item}';
delete from public.watchlist_items where id='10000000-0000-0000-0000-000000000003'; set role authenticated;`)
assert.equal((await db.query("select count(*)::integer as n from public.watchlist_events where event_type='removed'")).rows[0].n, 1)
assert.equal((await db.query("select count(*)::integer as n from public.watchlist_events where new_value->>'notesChanged'='true'")).rows[0].n, 1)
const activity = (await db.query('select public.get_watch_activity(30) as activity')).rows[0].activity
assert.equal(activity.removed, 1)
assert.ok(activity.updates >= 1)
assert.equal(activity.trackedSeasons, 1)
assert.equal(activity.completedSeasons, 0)
assert.equal(activity.days, 30)
assert.equal(activity.daily.reduce((sum, day) => sum + day.events, 0), activity.totalEvents)
await assert.rejects(db.query('select public.get_watch_activity(0)'), /Invalid activity window/)
assert.equal((await db.query("select count(*)::integer as n from public.watchlist_events where old_value::text like '%Private change%' or new_value::text like '%Private change%'")).rows[0].n, 0)
await db.exec(`reset role;
insert into public.media_catalog(provider,external_id,title,payload,refreshed_at) values('tmdb','tv:100','Series Test','{"item":{"title":"Series Test"},"details":{}}',now()); set role anon;`)
assert.equal((await db.query("select * from public.search_media_catalog('Series',30)")).rows.length, 1)
await assert.rejects(db.query("insert into public.media_catalog(provider,external_id,title,payload) values('tmdb','tv:2','Poison','{}')"), /permission denied/)
const baseline = activity.totalEvents
await db.exec(`reset role;
insert into public.watchlist_events(user_id,watchlist_item_id,event_type,new_value,origin)
  select '${owner}','${item}','tracking_updated','{"status":"Watching"}','web' from generate_series(1,150);
set role authenticated;`)
assert.equal((await db.query('select public.get_watch_activity(30) as activity')).rows[0].activity.totalEvents, baseline + 150)
await db.exec(`set request.jwt.claim.sub='${other}'`)
assert.equal((await db.query('select public.get_watch_activity(30) as activity')).rows[0].activity.totalEvents, 0)
await db.exec(`set request.jwt.claim.sub='${owner}'; reset role;
update public.custom_lists set is_public=true where id='${list}'; set role anon;`)
const listed = (await db.query("select public.get_public_list('reader','weekend',1,0) as page")).rows[0].page
assert.equal(listed.items[0].externalId, '200')
assert.equal(listed.hasMore, true)
assert.equal(listed.items[0].privateNotes, undefined)
assert.equal((await db.query("select public.get_public_list('reader','weekend',1,1) as page")).rows[0].page.hasMore, false)
await db.exec(`reset role; delete from auth.users where id='${owner}';`)
assert.equal((await db.query('select * from public.watchlist_events')).rows.length, 0)
console.log('PASS: migrations, season bounds/provider rules, preserved title counters, atomic list order, duplicate rejection, undo right-hand winner, match auditing, indexed catalog, cross-owner RLS/RPC, anonymous denial')
await db.close()
