create table public.guided_input_options (
 id text primary key check(id ~ '^[a-z][a-z0-9_-]{2,79}$'),
 kind text not null check(kind in('bag','homework','study','course','subject','topic','step')),
 label_tr text not null check(length(trim(label_tr)) between 1 and 80 and label_tr=trim(label_tr)),
 label_en text not null check(length(trim(label_en)) between 1 and 80 and label_en=trim(label_en)),
 subject text not null default '' check(length(subject)<=80),
 min_grade int not null default 1 check(min_grade between 1 and 12),
 max_grade int not null default 12 check(max_grade between 1 and 12 and max_grade>=min_grade),
 position int not null default 0 check(position between 0 and 1000),
 active boolean not null default true,
 revision int not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.guided_input_options enable row level security;
revoke all on public.guided_input_options from public,anon,authenticated;
grant select on public.guided_input_options to authenticated;
grant all on public.guided_input_options to service_role;
create policy guided_options_admin_read on public.guided_input_options for select to authenticated using(gina.is_admin_strict());
create function public.get_guided_input_options(p_child uuid,p_kind text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare grade int;begin
 perform gina.school_bag_access(p_child);
 select c.grade into grade from public.children c where c.id=p_child and c.family_id=gina.family_id();
 return (select coalesce(jsonb_agg(to_jsonb(o) order by o.position,o.id),'[]') from public.guided_input_options o where active and kind=p_kind and (grade is null or grade between min_grade and max_grade));
end;$$;
create function public.admin_save_guided_input(p_id text,p_revision int,p_value jsonb) returns int language plpgsql security definer set search_path='' as $$
declare old public.guided_input_options;v public.guided_input_options;
begin
 perform gina.assert_admin();
 if p_revision is null or p_revision<0 or p_value is null or jsonb_typeof(p_value)<>'object' or not(p_value ?& array['kind','label_tr','label_en','subject','min_grade','max_grade','position','active']) or p_value-array['kind','label_tr','label_en','subject','min_grade','max_grade','position','active']<>'{}' then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id,105));
 select * into old from public.guided_input_options where id=p_id for update;
 if coalesce(old.revision,0)<>p_revision then raise exception 'catalog_changed';end if;
 v:=jsonb_populate_record(null::public.guided_input_options,p_value);
 if old.id is not null and old.kind<>v.kind then raise exception 'catalog_kind_immutable';end if;
 insert into public.guided_input_options(id,kind,label_tr,label_en,subject,min_grade,max_grade,position,active,revision)
 values(p_id,v.kind,v.label_tr,v.label_en,v.subject,v.min_grade,v.max_grade,v.position,v.active,p_revision+1)
 on conflict(id) do update set label_tr=excluded.label_tr,label_en=excluded.label_en,subject=excluded.subject,min_grade=excluded.min_grade,max_grade=excluded.max_grade,position=excluded.position,active=excluded.active,revision=excluded.revision,updated_at=now();
 insert into public.audit_log(actor_id,action,target_table,target_id,reason) values(auth.uid(),'guided_input.saved','guided_input_options',p_id,'revision='||(p_revision+1));
 return p_revision+1;
end;$$;
revoke all on function public.get_guided_input_options(uuid,text),public.admin_save_guided_input(text,int,jsonb) from public,anon;
grant execute on function public.get_guided_input_options(uuid,text),public.admin_save_guided_input(text,int,jsonb) to authenticated;
insert into public.guided_input_options(id,kind,label_tr,label_en,position) values
('bag-pencil','bag','Kalemlik','Pencil case',10),('bag-water','bag','Su matarası','Water bottle',20),('bag-notebook','bag','Defter','Notebook',30),('bag-book','bag','Ders kitabı','Textbook',40),('bag-homework','bag','Ödev dosyası','Homework folder',50),('bag-lunch','bag','Beslenme çantası','Lunch box',60),('bag-sports','bag','Spor kıyafeti','Sports clothes',70),('bag-art','bag','Resim malzemeleri','Art supplies',80),
('homework-practice','homework','Alıştırmaları tamamla','Complete the exercises',10),('homework-read','homework','Verilen metni oku','Read the assigned text',20),('homework-project','homework','Proje üzerinde çalış','Work on the project',30),
('study-review','study','Konuyu tekrar et','Review the topic',10),('study-questions','study','Soru çöz','Practise questions',20),('study-notes','study','Notlarını gözden geçir','Review your notes',30),
('course-lesson','course','Ders çalışması','Lesson session',10),('course-music','course','Müzik çalışması','Music practice',20),('course-sport','course','Spor çalışması','Sports practice',30),
('subject-math','subject','Matematik','Mathematics',10),('subject-turkish','subject','Türkçe','Turkish',20),('subject-science','subject','Fen Bilimleri','Science',30),('subject-social','subject','Sosyal Bilgiler','Social Studies',40),('subject-life','subject','Hayat Bilgisi','Life Studies',50),('subject-english','subject','İngilizce','English',60),('subject-physics','subject','Fizik','Physics',70),('subject-chemistry','subject','Kimya','Chemistry',80),('subject-biology','subject','Biyoloji','Biology',90),('subject-history','subject','Tarih','History',100),('subject-geography','subject','Coğrafya','Geography',110),('subject-literature','subject','Türk Dili ve Edebiyatı','Turkish Language and Literature',120),
('step-read','step','Yönergeyi oku','Read the instructions',10),('step-materials','step','Malzemelerini hazırla','Prepare your materials',20),('step-solve','step','Soruları çöz','Answer the questions',30),('step-check','step','Cevaplarını kontrol et','Check your answers',40);
update public.guided_input_options set min_grade=3,max_grade=8 where id='subject-science';
update public.guided_input_options set min_grade=4,max_grade=7 where id='subject-social';
update public.guided_input_options set max_grade=3 where id='subject-life';
update public.guided_input_options set max_grade=8 where id='subject-turkish';
update public.guided_input_options set min_grade=2 where id='subject-english';
update public.guided_input_options set min_grade=9 where id in('subject-physics','subject-chemistry','subject-biology','subject-history','subject-geography','subject-literature');
-- Stable optional catalog IDs are stored alongside the user's original label snapshot.
-- Existing records and pending commands without IDs remain valid.

create or replace function public.save_school_bag(p_request_id uuid,p_child_id uuid,p_day date,p_revision integer,p_program_revision integer,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text:=gina.school_bag_access(p_child_id);today date;payload jsonb;result jsonb;revision integer;program_revision integer;item jsonb;begin
 if p_day is null or not isfinite(p_day) or p_revision is null or p_revision<0 or p_program_revision is null or p_program_revision<0
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'bag_invalid';end if;
 if jsonb_array_length(p_items)>30 or octet_length(p_items::text)>15000 then raise exception 'bag_invalid';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if item ? 'catalog_id' and item->'catalog_id'<>'null' and not exists(select 1 from public.guided_input_options where id=item->>'catalog_id' and kind='bag') then raise exception 'bag_invalid';end if;
  if jsonb_typeof(item)<>'object' or not(item ?& array['id','label','checked']) or item-array['id','label','checked','catalog_id']<>'{}'::jsonb
  or jsonb_typeof(item->'id')<>'string' or item->>'id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(item->'label')<>'string' or length(trim(item->>'label')) not between 1 and 80 or trim(item->>'label')<>item->>'label'
  or jsonb_typeof(item->'checked')<>'boolean' then raise exception 'bag_invalid';end if;
 end loop;
 if (select count(distinct i->>'id') from jsonb_array_elements(p_items)i)<>jsonb_array_length(p_items)
 or (select count(distinct i->>'label') from jsonb_array_elements(p_items)i)<>jsonb_array_length(p_items) then raise exception 'bag_invalid';end if;
 payload:=jsonb_build_object('action','school.bag','child',p_child_id,'day',p_day,'revision',p_revision,'program',p_program_revision,'items',p_items);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 -- Same lock as timetable saves: no stale program acknowledgement between check and write.
 perform 1 from public.children where id=p_child_id and family_id=gina.family_id() for update;
 if not found then raise exception 'bag_forbidden' using errcode='42501';end if;
 today:=(now() at time zone tz)::date;
 if p_day<today or p_day>today+7 then raise exception 'bag_date';end if;
 select coalesce((select t.revision from public.school_timetables t where t.child_id=p_child_id),0) into program_revision;
 if p_program_revision<>program_revision then raise exception 'bag_program_changed';end if;
 select coalesce((select b.revision from gina.school_bags b where b.child_id=p_child_id and b.day=p_day),0) into revision;
 if p_revision<>revision then raise exception 'bag_changed';end if;
 insert into gina.school_bags(child_id,day,revision,program_revision,items,lessons_snapshot,updated_by)
 values(p_child_id,p_day,revision+1,program_revision,p_items,public.get_school_bag(p_child_id,p_day)->'lessons',auth.uid())
 on conflict(child_id,day) do update set revision=excluded.revision,program_revision=excluded.program_revision,items=excluded.items,lessons_snapshot=excluded.lessons_snapshot,updated_by=excluded.updated_by,updated_at=now();
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'day',p_day,'revision',revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;

create or replace function public.save_learning_plan(p_request_id uuid,p_child_id uuid,p_id uuid,p_revision integer,p_content jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text:=gina.learning_plan_access(p_child_id);today date:=(now() at time zone tz)::date;
 payload jsonb;result jsonb;old gina.learning_plan;step jsonb;source uuid;start_day date;due_day date;begin
 if p_id is null or p_revision is null or p_revision<0 or p_content is null or jsonb_typeof(p_content)<>'object' then raise exception 'plan_invalid';end if;
 if octet_length(p_content::text)>10000 or not(p_content ?& array['kind','title','subject','topic','planned_on','due_on','time','steps','done','archived','source_id'])
 or p_content-array['kind','title','subject','topic','planned_on','due_on','time','steps','done','archived','source_id','catalog_id','subject_id']<>'{}' then raise exception 'plan_invalid';end if;
 if p_content->>'kind' not in ('homework','study','course') or jsonb_typeof(p_content->'kind')<>'string'
 or jsonb_typeof(p_content->'title')<>'string' or length(trim(p_content->>'title')) not between 1 and 120
 or trim(p_content->>'title')<>p_content->>'title'
 or jsonb_typeof(p_content->'subject')<>'string' or length(p_content->>'subject')>80 or trim(p_content->>'subject')<>p_content->>'subject'
 or jsonb_typeof(p_content->'topic')<>'string' or length(p_content->>'topic')>200 or trim(p_content->>'topic')<>p_content->>'topic'
 or jsonb_typeof(p_content->'done')<>'boolean' or jsonb_typeof(p_content->'archived')<>'boolean'
 or jsonb_typeof(p_content->'planned_on')<>'string' or p_content->>'planned_on'!~ '^\d{4}-\d{2}-\d{2}$'
 or (p_content->'due_on'<>'null' and (jsonb_typeof(p_content->'due_on')<>'string' or p_content->>'due_on'!~ '^\d{4}-\d{2}-\d{2}$'))
 or (p_content->'time'<>'null' and (jsonb_typeof(p_content->'time')<>'string' or p_content->>'time'!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
 or (p_content->'source_id'<>'null' and (jsonb_typeof(p_content->'source_id')<>'string' or p_content->>'source_id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
 or jsonb_typeof(p_content->'steps')<>'array' then raise exception 'plan_invalid';end if;
 if p_content ? 'catalog_id' and p_content->'catalog_id'<>'null' and not exists(select 1 from public.guided_input_options where id=p_content->>'catalog_id' and kind=p_content->>'kind') then raise exception 'plan_invalid';end if;
 if p_content ? 'subject_id' and p_content->'subject_id'<>'null' and not exists(select 1 from public.guided_input_options where id=p_content->>'subject_id' and kind='subject') then raise exception 'plan_invalid';end if;
 start_day:=(p_content->>'planned_on')::date;due_day:=(p_content->>'due_on')::date;source:=(p_content->>'source_id')::uuid;
 if not isfinite(start_day) or (due_day is not null and (not isfinite(due_day) or due_day<start_day)) then raise exception 'plan_invalid';end if;
 if jsonb_array_length(p_content->'steps')>12 then raise exception 'plan_invalid';end if;
 for step in select * from jsonb_array_elements(p_content->'steps') loop
  if jsonb_typeof(step)<>'object' or not(step ?& array['id','label','checked']) or step-array['id','label','checked']<>'{}'
  or jsonb_typeof(step->'id')<>'string' or step->>'id'!~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(step->'label')<>'string' or length(trim(step->>'label')) not between 1 and 120 or trim(step->>'label')<>step->>'label'
  or jsonb_typeof(step->'checked')<>'boolean' then raise exception 'plan_invalid';end if;
 end loop;
 if (select count(distinct s->>'id') from jsonb_array_elements(p_content->'steps')s)<>jsonb_array_length(p_content->'steps') then raise exception 'plan_invalid';end if;
 payload:=jsonb_build_object('action','learning.plan','child',p_child_id,'id',p_id,'revision',p_revision,'content',p_content);
 -- Reauthorize before recovering a receipt. Parent and active device never cross families.
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id and family_id=gina.family_id() for update;
 if not found then raise exception 'plan_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,89));
 select * into old from gina.learning_plan where id=p_id for update;
 if old.id is not null and old.child_id<>p_child_id then raise exception 'plan_forbidden' using errcode='42501';end if;
 if coalesce(old.revision,0)<>p_revision then raise exception 'plan_changed';end if;
 if not gina.is_parent() then
  if old.id is null or (old.content->>'archived')::boolean or
   p_content-array['steps','done','source_id']<>old.content-array['steps','done','source_id'] or source is distinct from old.source_id
   or (select coalesce(jsonb_agg(s-'checked' order by ord),'[]') from jsonb_array_elements(p_content->'steps') with ordinality a(s,ord))
      <>(select coalesce(jsonb_agg(s-'checked' order by ord),'[]') from jsonb_array_elements(old.content->'steps') with ordinality a(s,ord))
  then raise exception 'plan_parent_required' using errcode='42501';end if;
 end if;
 -- Old unfinished work remains editable. Only newly selected dates are bounded.
 if (old.id is null or old.content->>'planned_on'<>p_content->>'planned_on') and (start_day<today-30 or start_day>today+365) then raise exception 'plan_date';end if;
 if due_day is not null and (old.id is null or old.content->>'due_on' is distinct from p_content->>'due_on') and due_day>today+365 then raise exception 'plan_date';end if;
 if old.id is null and (p_content->>'done')::boolean then raise exception 'plan_invalid';end if;
 if old.id is null and (p_content->>'archived')::boolean then raise exception 'plan_invalid';end if;
 if (old.id is null or ((old.content->>'done')::boolean or (old.content->>'archived')::boolean)) and not (p_content->>'done')::boolean and not (p_content->>'archived')::boolean
 and (select count(*) from gina.learning_plan where child_id=p_child_id and not (content->>'done')::boolean and not (content->>'archived')::boolean)>=100 then raise exception 'plan_limit';end if;
 if source is not null and source is distinct from old.source_id then
  perform 1 from public.learning_sources where id=source and family_id=gina.family_id() and kind='document' and status='ready' for update;
  if not found then raise exception 'source_not_ready';end if;
 end if;
 insert into gina.learning_plan(id,child_id,revision,content,source_id,done_at,updated_by)
 values(p_id,p_child_id,p_revision+1,p_content-'source_id',source,
  case when (p_content->>'done')::boolean then coalesce(old.done_at,now()) else null end,auth.uid())
 on conflict(id) do update set revision=excluded.revision,content=excluded.content,source_id=excluded.source_id,done_at=excluded.done_at,updated_by=excluded.updated_by,updated_at=now();
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'id',p_id,'revision',p_revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,gina.family_id());return result;
end;$$;
revoke all on function public.get_learning_plan(uuid,date,date),public.save_learning_plan(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.get_learning_plan(uuid,date,date),public.save_learning_plan(uuid,uuid,uuid,integer,jsonb) to authenticated;
