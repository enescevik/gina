begin;
select plan(7);
insert into auth.users(id) values ('00000000-0000-0000-0000-000000001601'),('00000000-0000-0000-0000-000000001602');
insert into public.families(id,name,created_by) values
 ('10000000-0000-0000-0000-000000001601','A','00000000-0000-0000-0000-000000001601'),
 ('10000000-0000-0000-0000-000000001602','B','00000000-0000-0000-0000-000000001602');
insert into public.family_members(family_id,user_id) values ('10000000-0000-0000-0000-000000001601','00000000-0000-0000-0000-000000001601');
insert into public.children(id,family_id,name) values
 ('20000000-0000-0000-0000-000000001601','10000000-0000-0000-0000-000000001601','Remove'),
 ('20000000-0000-0000-0000-000000001602','10000000-0000-0000-0000-000000001601','Keep'),
 ('20000000-0000-0000-0000-000000001603','10000000-0000-0000-0000-000000001602','Other');
insert into public.notes(family_id,author_child_id,body) values ('10000000-0000-0000-0000-000000001601','20000000-0000-0000-0000-000000001601','Child note');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000001601","role":"authenticated","gina":{"role":"parent","family_id":"10000000-0000-0000-0000-000000001601"}}',true);
set local role authenticated;
-- Q02-6 (20261106170000): doğrudan REST silmesi kapalı; silme önizleme + confirm_child_deletion ile.
select throws_ok($$delete from public.children where id='20000000-0000-0000-0000-000000001601'$$,'42501',null,'direct REST delete of own child is refused');
select lives_ok($$select public.confirm_child_deletion(gen_random_uuid(),'20000000-0000-0000-0000-000000001601',
  (public.deletion_preview('{"kind":"child","child_id":"20000000-0000-0000-0000-000000001601"}')->>'preview_token')::uuid)$$,'own child and authored note can be deleted through confirm_child_deletion');
select is((select count(*)::int from public.children),1,'sibling remains');
select is((select count(*)::int from public.notes),0,'child-authored note removed');
select throws_ok($$delete from public.children where id='20000000-0000-0000-0000-000000001603'$$,'42501',null,'foreign child delete refused');
reset role;
select is((select count(*)::int from public.children where id='20000000-0000-0000-0000-000000001603'),1,'other family child remains protected');
select is((select count(*)::int from public.children where id='20000000-0000-0000-0000-000000001601'),0,'deleted profile is absent');
select * from finish();
rollback;
