-- C02 — ders kimliği sunucu bağı, tarihli plan okumaları, geleceğe planlı eğitim geçişi ve 14 gün geri alma.
-- Kaynak kararlar: docs/DECISIONS.md "F01 ve S04 kararları" (6 Kasım 2026):
--  * Ders eşleşmesi her zaman veli onaylıdır; sunucu hiçbir adı kendiliğinden bağlamaz.
--  * Geleceğe planlı eğitim geçişi L04 üzerine onaylı, uygulandıktan sonra 14 gün geri alınabilir.
-- Yazılan/kaynaktaki ders adı (ör. "MAT") hiçbir yerde değiştirilmez; katalog kimliği yanına eklenir.
-- Gerçekleşmiş görev, yıldız, ödül, sınav/not kanıtı bu dosyadaki hiçbir işlemle yeniden yazılmaz.

-- ---------------------------------------------------------------------------
-- 1) Çocuk başına ders adı → katalog kimliği (veli onaylı)
-- ---------------------------------------------------------------------------
create table gina.child_subject_links (
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 alias_normalized text not null check(alias_normalized ~ '^[a-z0-9]{1,120}$'),
 -- Provenance: velinin onayladığı anda belgede/tabloda yazan metin, olduğu gibi.
 original_title text not null check(length(btrim(original_title)) between 1 and 120),
 -- Katalog kaydı silinirse bağ da düşer; derslerin kendi adı (lessons[].title) etkilenmez.
 subject_id text not null references public.guided_input_options(id) on delete cascade,
 source text not null check(source in('manual','device_import')),
 revision integer not null default 1 check(revision>=1),
 linked_by uuid references auth.users(id) on delete set null,
 linked_at timestamptz not null default now(),
 primary key(child_id,alias_normalized)
);
create index child_subject_links_family on gina.child_subject_links(family_id);
create index child_subject_links_subject on gina.child_subject_links(subject_id);
create table gina.child_subject_link_changes (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 alias_normalized text not null,
 original_title text not null,
 -- Kimlikler metin olarak tutulur: katalog kaydı silinse de denetim izi kalır.
 before_subject_id text,
 after_subject_id text,
 source text not null,
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index child_subject_link_changes_child on gina.child_subject_link_changes(child_id,created_at desc);
revoke all on gina.child_subject_links,gina.child_subject_link_changes from public,anon,authenticated,service_role;
alter table gina.child_subject_links enable row level security;
alter table gina.child_subject_link_changes enable row level security;

create function gina.subject_links_json(p_child uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'alias_normalized',k.alias_normalized,'title',k.original_title,'subject_id',k.subject_id,
  'label_tr',o.label_tr,'label_en',o.label_en,'active',o.active,'source',k.source,'revision',k.revision,'linked_at',k.linked_at
 ) order by k.alias_normalized),'[]'::jsonb)
 from gina.child_subject_links k join public.guided_input_options o on o.id=k.subject_id and o.kind='subject'
 where k.child_id=p_child $$;

-- Saklanan ders nesnelerine bağlı kimliği sunucu yazar (istemciden gelen değere güvenilmez). Eski istemci
-- `subject_id` göndermese de aynı ad aynı kimliği alır; bağı olmayan dersten eski kimlik temizlenir.
create function gina.stamp_lesson_subjects(p_child uuid,p_lessons jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(case when k.subject_id is null then l-'subject_id' else l||jsonb_build_object('subject_id',k.subject_id) end order by o),'[]'::jsonb)
 from jsonb_array_elements(coalesce(p_lessons,'[]'::jsonb)) with ordinality x(l,o)
 left join gina.child_subject_links k on k.child_id=p_child and k.alias_normalized=gina.normalize_subject_alias(l->>'title') $$;
create function gina.school_timetable_stamp_subjects() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if jsonb_typeof(new.lessons)='array' then new.lessons:=gina.stamp_lesson_subjects(new.child_id,new.lessons);end if;
 return new;
end;$$;
create trigger school_timetable_stamp_subjects before insert or update of lessons on public.school_timetables
 for each row execute function gina.school_timetable_stamp_subjects();

-- Okuma tarafı: ders satırına kimlik + güncel katalog başlığı. Önce dersin o günkü sürümünde damgalı kimlik,
-- yoksa güncel bağ. Katalog kaydı yoksa kimlik null döner, ders adı aynen kalır.
create function gina.annotate_lessons(p_child uuid,p_lessons jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(l||jsonb_build_object(
   'subject_id',o.id,'subject_label_tr',o.label_tr,'subject_label_en',o.label_en,
   'subject_source',case when o.id is null then null when l->>'subject_id' is not null and l->>'subject_id'=o.id then 'lesson' else 'link' end
  ) order by ord),'[]'::jsonb)
 from jsonb_array_elements(coalesce(p_lessons,'[]'::jsonb)) with ordinality x(l,ord)
 left join gina.child_subject_links k on k.child_id=p_child and k.alias_normalized=gina.normalize_subject_alias(l->>'title')
 left join public.guided_input_options o on o.kind='subject'
  and o.id=coalesce(case when exists(select 1 from public.guided_input_options z where z.id=l->>'subject_id' and z.kind='subject') then l->>'subject_id' end,k.subject_id) $$;
revoke all on function gina.subject_links_json(uuid),gina.stamp_lesson_subjects(uuid,jsonb),gina.school_timetable_stamp_subjects(),gina.annotate_lessons(uuid,jsonb) from public,anon,authenticated,service_role;

-- Veli veya o çocuğun cihazı okur; başka aile/kardeş cihazı okuyamaz.
create function public.child_subject_links(p_child_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or gina.family_id() is null or (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id)) is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=gina.family_id())
 then raise exception 'subject_forbidden' using errcode='42501';end if;
 return jsonb_build_object('child_id',p_child_id,'links',gina.subject_links_json(p_child_id));
end;$$;

-- p_links: [{title, subject_id|null, expected|null}]. `expected` = istemcinin gördüğü mevcut kimlik (iki oturum).
-- Aynı kimliğe yeniden bağlamak değişiklik değildir (iki cihazdan aynı onay tek bağ). p_source='device_import':
-- cihazda kalmış eski yerel eşlemeler, veli ekranda açıkça onayladıktan sonra aynı kurallarla aktarılır.
create function public.set_child_subject_links(p_request_id uuid,p_child_id uuid,p_links jsonb,p_source text default 'manual') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();payload jsonb;result jsonb;item jsonb;n text;cur text;want text;seen text[]:=array[]::text[];changed int:=0;
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'subject_forbidden' using errcode='42501';end if;
 if p_request_id is null or p_source is null or p_source not in('manual','device_import') or p_links is null or jsonb_typeof(p_links)<>'array'
 or jsonb_array_length(p_links) not between 1 and 60 then raise exception 'subject_link_invalid';end if;
 for item in select * from jsonb_array_elements(p_links) loop
  if jsonb_typeof(item)<>'object' or not(item ? 'title') or item-array['title','subject_id','expected']<>'{}'::jsonb
  or jsonb_typeof(item->'title')<>'string' or length(btrim(item->>'title')) not between 1 and 120
  or coalesce(jsonb_typeof(item->'subject_id'),'null') not in('string','null')
  or coalesce(jsonb_typeof(item->'expected'),'null') not in('string','null')
  then raise exception 'subject_link_invalid';end if;
  n:=gina.normalize_subject_alias(item->>'title');
  if n='' or length(n)>120 or n=any(seen) then raise exception 'subject_link_invalid';end if;
  seen:=array_append(seen,n);
 end loop;
 payload:=jsonb_build_object('action','subject.links','child',p_child_id,'links',p_links,'source',p_source);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 -- Aynı çocuk satırı kilidi: program kaydı/içe aktarma/çocuk silme ile sıralanır.
 perform 1 from public.children where id=p_child_id and family_id=f for update;
 if exists(select 1 from public.children where id=p_child_id and archived_at is not null) then raise exception 'child_archived';end if;
 for item in select * from jsonb_array_elements(p_links) loop
  n:=gina.normalize_subject_alias(item->>'title');
  want:=nullif(item->>'subject_id','');
  select subject_id into cur from gina.child_subject_links where child_id=p_child_id and alias_normalized=n;
  if cur is not distinct from want then continue;end if;
  if cur is distinct from nullif(item->>'expected','') then raise exception 'subject_link_changed';end if;
  if want is not null and not exists(select 1 from public.guided_input_options where id=want and kind='subject' and active) then raise exception 'subject_unknown';end if;
  if want is null then
   delete from gina.child_subject_links where child_id=p_child_id and alias_normalized=n;
  else
   insert into gina.child_subject_links(child_id,family_id,alias_normalized,original_title,subject_id,source,linked_by)
   values(p_child_id,f,n,btrim(item->>'title'),want,p_source,auth.uid())
   on conflict(child_id,alias_normalized) do update set subject_id=excluded.subject_id,original_title=excluded.original_title,
    source=excluded.source,revision=gina.child_subject_links.revision+1,linked_by=excluded.linked_by,linked_at=now();
  end if;
  insert into gina.child_subject_link_changes(child_id,family_id,alias_normalized,original_title,before_subject_id,after_subject_id,source,actor)
  values(p_child_id,f,n,btrim(item->>'title'),cur,want,p_source,auth.uid());
  changed:=changed+1;
 end loop;
 result:=jsonb_build_object('child_id',p_child_id,'changed',changed,'links',gina.subject_links_json(p_child_id));
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- Program kaydı sözleşmesi: ders nesnesi isteğe bağlı `subject_id` taşıyabilir (string|null). Değer sunucudaki
-- veli onaylı bağla aynı olmalı; aksi `timetable_subject_unconfirmed`. Asıl değeri tetikleyici yazar.
create or replace function public.save_school_timetable_request(
 p_request_id uuid,p_child_id uuid,p_revision integer,p_lessons jsonb,p_settings jsonb,p_effective_from date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();payload jsonb;result jsonb;entry jsonb;revision integer;eff date;linked text;
begin
 if auth.uid() is null or f is null or
  (gina.is_parent() or (gina.is_device() and p_child_id=gina.child_id())) is not true
  or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'timetable_forbidden' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_lessons is null or jsonb_typeof(p_lessons)<>'array'
 or p_settings is null or jsonb_typeof(p_settings)<>'object' then raise exception 'timetable_invalid';end if;
 if jsonb_array_length(p_lessons)>112 or octet_length(p_lessons::text)>100000
 or not(p_settings ?& array['start','duration','break']) or p_settings-array['start','duration','break']<>'{}'::jsonb
 or jsonb_typeof(p_settings->'start')<>'string' or jsonb_typeof(p_settings->'duration')<>'number'
 or jsonb_typeof(p_settings->'break')<>'number' then raise exception 'timetable_invalid';end if;
 for entry in select * from jsonb_array_elements(p_lessons) loop
  if jsonb_typeof(entry)<>'object' or not(entry ?& array['id','day','title','start','end'])
  or entry-array['id','day','title','start','end','subject_id']<>'{}'::jsonb or jsonb_typeof(entry->'id')<>'string'
  or jsonb_typeof(entry->'day')<>'number' or jsonb_typeof(entry->'title')<>'string'
  or jsonb_typeof(entry->'start')<>'string' or jsonb_typeof(entry->'end')<>'string'
  or coalesce(jsonb_typeof(entry->'subject_id'),'null') not in('string','null')
  then raise exception 'timetable_invalid';end if;
  if entry->>'subject_id' is not null then
   select subject_id into linked from gina.child_subject_links where child_id=p_child_id and alias_normalized=gina.normalize_subject_alias(entry->>'title');
   if linked is distinct from entry->>'subject_id' then raise exception 'timetable_subject_unconfirmed';end if;
  end if;
 end loop;
 eff:=gina.plan_effective_from(f,p_effective_from);
 payload:=jsonb_build_object('action','timetable.save','child',p_child_id,'revision',p_revision,'lessons',p_lessons,'settings',p_settings)
  ||case when p_effective_from is null then '{}'::jsonb else jsonb_build_object('effective_from',p_effective_from) end;
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 revision:=public.save_school_timetable(p_child_id,p_revision,p_lessons,p_settings,eff);
 result:=jsonb_build_object('request',p_request_id,'child_id',p_child_id,'revision',revision,'effective_from',eff);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- ---------------------------------------------------------------------------
-- 2) Geleceğe planlı eğitim geçişi (L01 change_child_education üzerine)
-- ---------------------------------------------------------------------------
create table gina.child_education_schedules (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 action text not null check(action in('new_year','transfer')),
 academic_year integer not null check(academic_year between 2000 and 2100),
 grade smallint check(grade between 0 and 12),
 school text check(length(school)<=120),
 starts_on date not null,
 keep_timetable boolean not null,
 status text not null default 'scheduled' check(status in('scheduled','applied','cancelled','failed')),
 failure text check(length(failure)<=120),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 applied_at timestamptz,
 applied_period_id uuid references gina.child_education_periods(id) on delete set null,
 cancelled_at timestamptz,
 undone_at timestamptz
);
create unique index child_education_schedule_open on gina.child_education_schedules(child_id) where status='scheduled';
create index child_education_schedules_child on gina.child_education_schedules(child_id,created_at desc);
revoke all on gina.child_education_schedules from public,anon,authenticated,service_role;
alter table gina.child_education_schedules enable row level security;

create function gina.education_parent_guard(p_child uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or f is null or gina.is_parent() is not true
 or not exists(select 1 from public.children where id=p_child and family_id=f)
 then raise exception 'education_forbidden' using errcode='42501';end if;
 return f;
end;$$;

create function public.schedule_child_education_change(
 p_request_id uuid,p_child_id uuid,p_revision integer,p_action text,p_academic_year integer,p_grade integer,p_school text,p_starts_on date,p_keep_timetable boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);payload jsonb;result jsonb;today date;v_revision int;old gina.child_education_periods;
 v_school text:=nullif(btrim(p_school),'');s gina.child_education_schedules;
begin
 if p_request_id is null or p_revision is null or p_revision<0 or p_action is null or p_action not in('new_year','transfer')
 or p_academic_year is null or p_academic_year not between 2000 and 2100 or (p_grade is not null and p_grade not between 0 and 12)
 or length(v_school)>120 or p_starts_on is null or not isfinite(p_starts_on) or p_keep_timetable is null then raise exception 'education_invalid';end if;
 payload:=jsonb_build_object('action','education.schedule','child',p_child_id,'revision',p_revision,'kind',p_action,'year',p_academic_year,
  'grade',p_grade,'school',v_school,'starts',p_starts_on,'keep',p_keep_timetable);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id for update;
 if exists(select 1 from public.children where id=p_child_id and archived_at is not null) then raise exception 'child_archived';end if;
 today:=gina.family_today(f);
 -- Bugün ve geçmiş için anlık geçiş kullanılır; planlama yalnız yarından bir yıl sonrasına kadar.
 if p_starts_on<=today or p_starts_on>today+365 or extract(year from p_starts_on)::int not between p_academic_year and p_academic_year+1
 then raise exception 'education_date';end if;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 select revision into v_revision from gina.child_education_state where child_id=p_child_id;
 if v_revision<>p_revision then raise exception 'education_changed';end if;
 if exists(select 1 from gina.child_education_schedules where child_id=p_child_id and status='scheduled') then raise exception 'education_scheduled';end if;
 select * into old from gina.child_education_periods where child_id=p_child_id and ends_on is null;
 if old.id is null then raise exception 'education_changed';end if;
 if p_action='new_year' and (p_academic_year<=old.academic_year or p_starts_on<=old.starts_on) then raise exception 'education_date';end if;
 if p_action='transfer' and (p_academic_year<>old.academic_year or p_grade is distinct from old.grade
  or v_school is null or v_school is not distinct from old.school or p_starts_on<=old.starts_on) then raise exception 'education_transfer';end if;
 insert into gina.child_education_schedules(child_id,family_id,action,academic_year,grade,school,starts_on,keep_timetable,created_by)
 values(p_child_id,f,p_action,p_academic_year,p_grade,v_school,p_starts_on,p_keep_timetable,auth.uid()) returning * into s;
 update gina.child_education_state set revision=v_revision+1 where child_id=p_child_id;
 insert into gina.child_education_changes(child_id,family_id,action,before_value,after_value,actor)
 values(p_child_id,f,'schedule',to_jsonb(old),to_jsonb(s),auth.uid());
 result:=jsonb_build_object('child_id',p_child_id,'schedule_id',s.id,'starts_on',s.starts_on,'revision',v_revision+1);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

create function public.cancel_child_education_schedule(p_request_id uuid,p_child_id uuid,p_schedule_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);payload jsonb;result jsonb;s gina.child_education_schedules;v_revision int;
begin
 if p_request_id is null or p_schedule_id is null then raise exception 'education_invalid';end if;
 payload:=jsonb_build_object('action','education.schedule.cancel','child',p_child_id,'schedule',p_schedule_id);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id for update;
 select * into s from gina.child_education_schedules where id=p_schedule_id and child_id=p_child_id for update;
 if s.id is null or s.status<>'scheduled' then raise exception 'education_changed';end if;
 update gina.child_education_schedules set status='cancelled',cancelled_at=now() where id=s.id;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 update gina.child_education_state set revision=revision+1 where child_id=p_child_id returning revision into v_revision;
 insert into gina.child_education_changes(child_id,family_id,action,before_value,after_value,actor)
 values(p_child_id,f,'schedule_cancel',to_jsonb(s),jsonb_build_object('id',s.id,'status','cancelled'),auth.uid());
 result:=jsonb_build_object('child_id',p_child_id,'schedule_id',s.id,'status','cancelled','revision',v_revision);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- Günü gelen planlı geçiş, velinin bir sonraki açılışında mevcut L01 işlemiyle uygulanır (aynı kilit/CAS/geçmiş).
-- Boş başlayan programın sürümü planlanan günden itibaren tarihlenir; o günden önceki günler eski programı korur.
-- Uygulanamazsa (ör. arada başka geçiş yapıldı) planlı kayıt `failed` olur ve hiçbir şey yarım kalmaz.
create function public.apply_due_education_changes(p_child_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);s gina.child_education_schedules;today date;v_revision int;tt_rev int;result jsonb;code text;
begin
 perform 1 from public.children where id=p_child_id for update;
 today:=gina.family_today(f);
 select * into s from gina.child_education_schedules where child_id=p_child_id and status='scheduled' and starts_on<=today for update;
 if s.id is null then return jsonb_build_object('child_id',p_child_id,'applied',false);end if;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 select revision into v_revision from gina.child_education_state where child_id=p_child_id;
 select coalesce((select revision from public.school_timetables where child_id=p_child_id),0) into tt_rev;
 begin
  perform set_config('gina.plan_effective_from',s.starts_on::text,true);
  result:=gina.change_child_education(gen_random_uuid(),p_child_id,v_revision,s.action,s.academic_year,s.grade,s.school,s.starts_on,tt_rev,s.keep_timetable);
  perform set_config('gina.plan_effective_from','',true);
 exception when others then
  code:=left(sqlerrm,120);
  perform set_config('gina.plan_effective_from','',true);
  update gina.child_education_schedules set status='failed',failure=code where id=s.id;
  update gina.child_education_state set revision=revision+1 where child_id=p_child_id;
  return jsonb_build_object('child_id',p_child_id,'applied',false,'failed',code,'schedule_id',s.id);
 end;
 update gina.child_education_schedules set status='applied',applied_at=now(),applied_period_id=(result->>'period_id')::uuid where id=s.id;
 return jsonb_build_object('child_id',p_child_id,'applied',true,'schedule_id',s.id,'period_id',result->>'period_id','revision',(result->>'revision')::int);
end;$$;

-- Son geçişin (yeni yıl / okul değişimi) geri alınabilirliği: geçiş kaydı 14 aile-yerel gün içinde, dönem hâlâ
-- güncel ve yeni döneme aktarım (L01) yapılmamış olmalı. Aktarım varsa önce o kayıtlar ele alınır.
create function gina.education_undo_info(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cur gina.child_education_periods;prev gina.child_education_periods;ch gina.child_education_changes;tz text;today date;made date;blocked text;
begin
 select * into cur from gina.child_education_periods where child_id=p_child and ends_on is null;
 if cur.id is null or cur.reason not in('new_year','transfer') then return null;end if;
 select * into prev from gina.child_education_periods where child_id=p_child and ends_on=cur.starts_on order by starts_on desc limit 1;
 if prev.id is null then return null;end if;
 select * into ch from gina.child_education_changes where child_id=p_child and action=cur.reason and after_value->>'id'=cur.id::text order by created_at desc limit 1;
 if ch.id is null then return null;end if;
 select fa.timezone into tz from public.families fa where fa.id=cur.family_id;
 today:=gina.local_day(tz,now());made:=gina.local_day(tz,ch.created_at);
 if exists(select 1 from public.task_templates where child_id=p_child and (period_id=cur.id or source_period_id=cur.id))
 or exists(select 1 from gina.learning_plan where child_id=p_child and (period_id=cur.id or source_period_id=cur.id))
 or exists(select 1 from gina.child_education_changes where child_id=p_child and action='transfer_items' and created_at>=ch.created_at)
 then blocked:='transfer';end if;
 return jsonb_build_object('period_id',cur.id,'previous_period_id',prev.id,'reason',cur.reason,'starts_on',cur.starts_on,
  'changed_on',made,'until',made+14,'expired',today>made+14,'blocked',blocked,
  'previous',jsonb_build_object('academic_year',prev.academic_year,'grade',prev.grade,'school',prev.school,'starts_on',prev.starts_on),
  'restores_timetable',coalesce(jsonb_array_length(prev.timetable_snapshot->'lessons'),0)>0);
end;$$;

create function public.undo_child_education_change(p_request_id uuid,p_child_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);payload jsonb;result jsonb;info jsonb;v_revision int;cur gina.child_education_periods;
 prev gina.child_education_periods;tt public.school_timetables;restored boolean:=false;
begin
 if p_request_id is null or p_revision is null or p_revision<0 then raise exception 'education_invalid';end if;
 payload:=jsonb_build_object('action','education.undo','child',p_child_id,'revision',p_revision);
 result:=gina.help_receipt(p_request_id,payload);
 if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id for update;
 if exists(select 1 from public.children where id=p_child_id and archived_at is not null) then raise exception 'child_archived';end if;
 insert into gina.child_education_state(child_id) values(p_child_id) on conflict do nothing;
 select revision into v_revision from gina.child_education_state where child_id=p_child_id;
 if v_revision<>p_revision then raise exception 'education_changed';end if;
 info:=gina.education_undo_info(p_child_id);
 if info is null then raise exception 'education_undo_unavailable';end if;
 if (info->>'expired')::boolean then raise exception 'education_undo_expired';end if;
 if info->>'blocked' is not null then raise exception 'education_undo_transfer';end if;
 select * into cur from gina.child_education_periods where id=(info->>'period_id')::uuid;
 select * into prev from gina.child_education_periods where id=(info->>'previous_period_id')::uuid;
 -- Program: geçiş programı boşalttıysa ve veli o arada yeni ders girmediyse eski dönemin programı geri gelir.
 -- Yeni ders girilmişse dokunulmaz (sessiz ezme yok); sonuçta `timetable_restored=false` döner.
 select * into tt from public.school_timetables where child_id=p_child_id;
 if coalesce(jsonb_array_length(prev.timetable_snapshot->'lessons'),0)>0 and coalesce(jsonb_array_length(tt.lessons),0)=0 then
  perform public.save_school_timetable(p_child_id,coalesce(tt.revision,0),prev.timetable_snapshot->'lessons',coalesce(prev.timetable_snapshot->'settings',tt.settings,'{"start":"09:00","duration":40,"break":10}'::jsonb));
  restored:=true;
 end if;
 update gina.child_education_schedules set undone_at=now() where applied_period_id=cur.id and status='applied';
 -- Kanıt kayıtları (sınav/not education_context, görev/yıldız) dönem kimliğine FK ile bağlı değil; değişmez.
 delete from gina.child_education_periods where id=cur.id;
 update gina.child_education_periods set ends_on=null,timetable_snapshot=null where id=prev.id;
 update public.children set grade=prev.grade where id=p_child_id;
 update gina.child_education_state set revision=v_revision+1 where child_id=p_child_id;
 insert into gina.child_education_changes(child_id,family_id,action,before_value,after_value,actor)
 select p_child_id,f,'undo',to_jsonb(cur),to_jsonb(e)||jsonb_build_object('timetable_restored',restored),auth.uid() from gina.child_education_periods e where e.id=prev.id;
 result:=jsonb_build_object('child_id',p_child_id,'period_id',prev.id,'undone_period_id',cur.id,'revision',v_revision+1,'timetable_restored',restored);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

create function public.education_change_state(p_child_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);
begin
 return jsonb_build_object('child_id',p_child_id,'today',gina.family_today(f),
  'revision',coalesce((select revision from gina.child_education_state where child_id=p_child_id),0),
  'scheduled',(select to_jsonb(s)-'created_by'-'failure' from gina.child_education_schedules s where child_id=p_child_id and status='scheduled'),
  'last_failed',(select jsonb_build_object('id',s.id,'action',s.action,'starts_on',s.starts_on,'failure',s.failure) from gina.child_education_schedules s
    where child_id=p_child_id and status='failed' and not exists(select 1 from gina.child_education_schedules z where z.child_id=p_child_id and z.created_at>s.created_at)
    order by created_at desc limit 1),
  'undo',gina.education_undo_info(p_child_id));
end;$$;

-- ---------------------------------------------------------------------------
-- 3) Tek tarihli sözleşme: plan_for_day (+ ders kimliği, planlı geçiş) ve plan_for_days
-- ---------------------------------------------------------------------------
alter function public.plan_for_day(uuid,date) set schema gina;
alter function gina.plan_for_day(uuid,date) rename to plan_for_day_base;
revoke all on function gina.plan_for_day_base(uuid,date) from public,anon,authenticated,service_role;

create function public.plan_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb;s gina.child_education_schedules;
begin
 base:=gina.plan_for_day_base(p_child_id,p_day);
 base:=jsonb_set(base,'{timetable,lessons}',gina.annotate_lessons(p_child_id,base->'timetable'->'lessons'));
 base:=jsonb_set(base,'{timetable,day_lessons}',gina.annotate_lessons(p_child_id,base->'timetable'->'day_lessons'));
 select * into s from gina.child_education_schedules where child_id=p_child_id and status='scheduled';
 if s.id is not null and p_day>=s.starts_on then
  -- Henüz uygulanmamış planlı geçiş: o günden itibaren yeni dönem ve (seçildiyse) boş program görünür.
  base:=base||jsonb_build_object('period',jsonb_build_object('id',s.id,'academic_year',s.academic_year,'grade',s.grade,'school',s.school,
   'starts_on',s.starts_on,'ends_on',null,'reason',s.action,'scheduled',true));
  if not s.keep_timetable then
   base:=jsonb_set(base,'{timetable}',(base->'timetable')||jsonb_build_object('lessons','[]'::jsonb,'day_lessons','[]'::jsonb,
    'status','none','source','scheduled_change','effective_from',s.starts_on,'unknown_before',null));
  end if;
 end if;
 return base||jsonb_build_object('scheduled_education',case when s.id is null then null else jsonb_build_object('id',s.id,'action',s.action,
  'starts_on',s.starts_on,'academic_year',s.academic_year,'grade',s.grade,'school',s.school,'keep_timetable',s.keep_timetable) end);
end;$$;

-- Hafta şeridi/özetler için aynı sözleşme, en çok 42 gün.
create function public.plan_for_days(p_child_id uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_to<p_from or p_to-p_from>41 then raise exception 'plan_day_invalid';end if;
 return (select jsonb_agg(public.plan_for_day(p_child_id,d::date) order by d) from generate_series(p_from,p_to,interval '1 day') d);
end;$$;

-- Görev listesi: her rutinin o gün geçerli sürümü (hafta gününden bağımsız) ve varsa ileri tarihli bekleyen sürümü.
-- Canlı satır ileri tarihli ayarı hemen taşıdığı için liste bununla "bugün geçerli" ile "X'ten itibaren"i ayırır.
create function public.routines_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or f is null or (gina.is_parent() or (gina.is_device() and gina.child_id()=p_child_id)) is not true
 or not exists(select 1 from public.children where id=p_child_id and family_id=f)
 then raise exception 'plan_forbidden' using errcode='42501';end if;
 if p_day is null or not isfinite(p_day) then raise exception 'plan_day_invalid';end if;
 return jsonb_build_object('child_id',p_child_id,'day',p_day,'routines',coalesce((select jsonb_agg(jsonb_build_object(
   'id',t.id,'current_revision',t.revision,
   'version',case when v is null then null else jsonb_build_object('revision',(v->>'revision')::int,'title',v->'value'->>'title','icon',v->'value'->>'icon',
     'stars',(v->'value'->>'stars')::int,'days_of_week',v->'value'->'days_of_week','time_of_day',v->'value'->>'time_of_day',
     'requires_approval',(v->'value'->>'requires_approval')::boolean,'effective_from',v->'effective_from','known_since',v->'known_since',
     'status',v->>'status','unknown_before',v->'unknown_before') end,
   'next',(select jsonb_build_object('revision',c.revision,'effective_from',c.effective_from,'title',c.after_value->>'title','icon',c.after_value->>'icon',
     'stars',(c.after_value->>'stars')::int,'days_of_week',c.after_value->'days_of_week')
    from gina.task_routine_changes c where c.template_id=t.id and c.superseded_by is null and c.effective_from>p_day order by c.effective_from,c.revision limit 1)
  ) order by t.sort_order,t.created_at,t.id) from public.task_templates t cross join lateral (select gina.task_routine_version_on(t.id,p_day) v) x
  where t.child_id=p_child_id and t.family_id=f),'[]'::jsonb));
end;$$;

revoke all on function gina.education_parent_guard(uuid),gina.education_undo_info(uuid) from public,anon,authenticated,service_role;
revoke all on function public.child_subject_links(uuid),public.set_child_subject_links(uuid,uuid,jsonb,text),
 public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb,date),
 public.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean),
 public.cancel_child_education_schedule(uuid,uuid,uuid),public.apply_due_education_changes(uuid),
 public.undo_child_education_change(uuid,uuid,integer),public.education_change_state(uuid),
 public.plan_for_day(uuid,date),public.plan_for_days(uuid,date,date),public.routines_for_day(uuid,date) from public,anon,service_role;
grant execute on function public.child_subject_links(uuid),public.set_child_subject_links(uuid,uuid,jsonb,text),
 public.save_school_timetable_request(uuid,uuid,integer,jsonb,jsonb,date),
 public.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean),
 public.cancel_child_education_schedule(uuid,uuid,uuid),public.apply_due_education_changes(uuid),
 public.undo_child_education_change(uuid,uuid,integer),public.education_change_state(uuid),
 public.plan_for_day(uuid,date),public.plan_for_days(uuid,date,date),public.routines_for_day(uuid,date) to authenticated;
