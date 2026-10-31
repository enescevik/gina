begin;
select plan(5);
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
select lives_ok($$delete from public.children where id='20000000-0000-0000-0000-000000001601'$$,'own child and authored note can be deleted');
select is((select count(*)::int from public.children),1,'sibling remains');
select is((select count(*)::int from public.notes),0,'child-authored note removed');
delete from public.children where id='20000000-0000-0000-0000-000000001603';
reset role;
select is((select count(*)::int from public.children where id='20000000-0000-0000-0000-000000001603'),1,'other family child remains protected');
select is((select count(*)::int from public.children where id='20000000-0000-0000-0000-000000001601'),0,'deleted profile is absent');
select * from finish();
rollback;
