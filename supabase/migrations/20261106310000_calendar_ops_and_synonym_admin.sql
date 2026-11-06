-- C11 — takvim işletimi ve ders eşanlamlısı yönetimi (S04 / L01 / F01 kararı: otomatik tatil ÖNERİSİ).
-- Kaynak kararlar: docs/DECISIONS.md "F01 ve S04 kararları" (6 Kasım 2026):
--  * Otomatik tatil önerisi onaylı; otomatik silme yok. Veli kabul eder; program silinmez, sınıf yükseltilmez.
--  * Düşük güvenli kayıt yayımlanmaz; 4 parçalı dönem modeli (ara tatiller dönemler arası boşluk).
--  * Ders eşleşmesi her zaman veli onaylı; eşanlamlılar yalnız aday üretir.
-- Bölümler:
--  1) Ders eşanlamlıları: yönetimden kontrollü ekleme/düzenleme/pasifleştirme + değişiklik geçmişi + audit.
--  2) Takvim yayın kapısı: tohumdan gelen orta güvenli taslak yalnız kayıtlı inceleme ile, düşük güvenli hiç,
--     kaynak tarihi yıl başlangıcından 1 yıldan eskiyse hiç yayımlanmaz. İnceleme kontrol listesi kaydı.
--  3) Tatil günleri (resmî tatil / ara tatil / yerel gün): taslak → ayrı yayın; tohumdan içe aktarma.
--  4) Veli için tatil önerisi: yalnız YAYIMLANMIŞ takvim/tatil verisinden; kabul/vazgeç/geri al;
--     plan_for_day yalnız işaret ekler (ders satırı silinmez).
--  5) Planlı eğitim geçişi + takvim gerekçesi: tarih dışı geçişin gerekçesi planla birlikte saklanır, uygulanınca
--     konum ve okul istisna bildirimi yazılır. Konumu yönetilen çocukta gerekçesiz planlama reddedilir.
--  6) Dönem hatırlatması: planlı geçişi olan çocuğa gönderilmez; her veli/çocuk/yıl/tür için tek kez.
--  7) Okul istisna kuyruğu özeti (aile kimliği olmadan) ve velinin kendi bildirim durumları.

-- ---------------------------------------------------------------------------
-- 1) Ders eşanlamlıları
-- ---------------------------------------------------------------------------
alter table gina.subject_synonyms
 add column active boolean not null default true,
 add column revision int not null default 1,
 add column updated_at timestamptz not null default now(),
 add column updated_by uuid references auth.users(id) on delete set null;

create table gina.subject_synonym_changes (
 id bigint generated always as identity primary key,
 alias_normalized text not null, subject_id text not null, grade_min int not null,
 action text not null check(action in('add','update','deactivate','reactivate')),
 before_value jsonb, after_value jsonb not null,
 note text not null check(length(trim(note)) between 10 and 500),
 actor uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index subject_synonym_changes_subject on gina.subject_synonym_changes(subject_id,created_at desc);
revoke all on gina.subject_synonym_changes from public,anon,authenticated,service_role;
alter table gina.subject_synonym_changes enable row level security;

-- Pasif eşanlamlı öneri üretmez. Gövde S04 ile aynı, yalnız `s.active` eklendi.
create or replace function public.suggest_subject(p_text text,p_grade int default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare normalized text;cands jsonb;in_scope int;total int;begin
 if not (gina.is_parent() or gina.has_operation_role('content')) then raise exception 'subject_forbidden' using errcode='42501';end if;
 if p_text is null or length(p_text)>80 or (p_grade is not null and p_grade not between 0 and 12) then raise exception 'subject_invalid';end if;
 normalized:=gina.normalize_subject_alias(p_text);
 with hits as (
  select o.id,o.label_tr,o.label_en,o.min_grade,o.max_grade,o.position,
   bool_or(p_grade is not null and p_grade between s.grade_min and s.grade_max) scoped,
   min(s.alias) alias
  from gina.subject_synonyms s join public.guided_input_options o on o.id=s.subject_id and o.kind='subject' and o.active
  where normalized<>'' and s.alias_normalized=normalized and s.active group by o.id
 ), counted as (select *,count(*) filter(where scoped) over() n_scoped from hits)
 select coalesce(jsonb_agg(jsonb_build_object('subject_id',id,'label_tr',label_tr,'label_en',label_en,'grade_min',min_grade,'grade_max',max_grade,
   'in_grade_scope',scoped,'matched_alias',alias) order by scoped desc,position,id) filter(where scoped or n_scoped=0),'[]'),
  coalesce(max(n_scoped),0),count(*)
 into cands,in_scope,total from counted;
 return jsonb_build_object('input',p_text,'normalized',normalized,'grade',p_grade,
  'match',case jsonb_array_length(cands) when 0 then 'none' when 1 then 'single' else 'ambiguous' end,
  'requires_confirmation',true,'keep_label',true,
  'scope_note',total>0 and in_scope=0 and p_grade is not null,
  'candidates',cands);
end;$$;

create or replace function public.admin_subject_synonyms() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('subject_id',subject_id,'alias',alias,'alias_normalized',alias_normalized,
  'grade_min',grade_min,'grade_max',grade_max,'source',source,'active',active,'revision',revision,'updated_at',updated_at)
  order by subject_id,source,alias_normalized,grade_min),'[]') from gina.subject_synonyms);
end;$$;

-- Eşanlamlı değişikliği. Kural:
--  * add: yalnız `source='admin'`; aynı ders + aynı normalize ad için çakışan sınıf aralığı olamaz.
--  * update: yalnız yönetici eklediği satırın görünen adı ve sınıf aralığı (normalize ad değişmez; değişecekse yeni ekle).
--  * deactivate/reactivate: her kaynak için; kaynak satırı silinmez, geçmiş kalır.
--  * Her değişiklik gerekçe notu (10–500) ister, satır sürümü (CAS) ile yapılır, geçmiş + audit yazar.
--  * Başka derslerle aynı ad paylaşılıyorsa yanıt `shared_with` döner: veliye birden fazla aday gösterilir (sessiz bağlama yok).
create function public.admin_save_subject_synonym(p_request uuid,p_action text,p_subject_id text,p_alias text,p_grade_min int,p_grade_max int,
 p_key jsonb,p_revision int,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;norm text;old gina.subject_synonyms;new_row gina.subject_synonyms;shared jsonb;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','subject.synonym','kind',p_action,'subject',p_subject_id,'alias',p_alias,'min',p_grade_min,'max',p_grade_max,'key',p_key,'revision',p_revision,'note',p_note);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_action is null or p_action not in('add','update','deactivate','reactivate') or length(trim(coalesce(p_note,''))) not between 10 and 500 then raise exception 'synonym_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('subject.synonym',0));
 if p_action='add' then
  norm:=gina.normalize_subject_alias(p_alias);
  if norm='' or length(trim(coalesce(p_alias,''))) not between 1 and 80 or norm !~ '^[a-z0-9]{1,80}$'
   or p_grade_min is null or p_grade_max is null or p_grade_min not between 0 and 12 or p_grade_max not between p_grade_min and 12 then raise exception 'synonym_invalid';end if;
  if not exists(select 1 from public.guided_input_options where id=p_subject_id and kind='subject' and active) then raise exception 'subject_unknown';end if;
  if exists(select 1 from gina.subject_synonyms where alias_normalized=norm and subject_id=p_subject_id and int4range(grade_min,grade_max,'[]') && int4range(p_grade_min,p_grade_max,'[]'))
   then raise exception 'synonym_exists';end if;
  insert into gina.subject_synonyms(alias_normalized,alias,subject_id,grade_min,grade_max,source,updated_by)
   values(norm,trim(p_alias),p_subject_id,p_grade_min,p_grade_max,'admin',auth.uid()) returning * into new_row;
 else
  if jsonb_typeof(p_key) is distinct from 'object' or p_revision is null then raise exception 'synonym_invalid';end if;
  select * into old from gina.subject_synonyms where alias_normalized=p_key->>'alias_normalized' and subject_id=p_key->>'subject_id'
   and grade_min=(p_key->>'grade_min')::int for update;
  if old.alias_normalized is null then raise exception 'synonym_not_found';end if;
  if old.revision<>p_revision then raise exception 'synonym_changed';end if;
  if p_action='update' then
   if old.source<>'admin' then raise exception 'synonym_source_locked';end if;
   if length(trim(coalesce(p_alias,''))) not between 1 and 80 or gina.normalize_subject_alias(p_alias)<>old.alias_normalized
    or p_grade_min is null or p_grade_max is null or p_grade_min not between 0 and 12 or p_grade_max not between p_grade_min and 12 then raise exception 'synonym_invalid';end if;
   if exists(select 1 from gina.subject_synonyms where alias_normalized=old.alias_normalized and subject_id=old.subject_id and grade_min<>old.grade_min
     and int4range(grade_min,grade_max,'[]') && int4range(p_grade_min,p_grade_max,'[]')) then raise exception 'synonym_exists';end if;
   update gina.subject_synonyms set alias=trim(p_alias),grade_min=p_grade_min,grade_max=p_grade_max,revision=revision+1,updated_at=now(),updated_by=auth.uid()
    where alias_normalized=old.alias_normalized and subject_id=old.subject_id and grade_min=old.grade_min returning * into new_row;
  else
   if (p_action='deactivate')<>old.active then raise exception 'synonym_changed';end if;
   update gina.subject_synonyms set active=(p_action='reactivate'),revision=revision+1,updated_at=now(),updated_by=auth.uid()
    where alias_normalized=old.alias_normalized and subject_id=old.subject_id and grade_min=old.grade_min returning * into new_row;
  end if;
 end if;
 insert into gina.subject_synonym_changes(alias_normalized,subject_id,grade_min,action,before_value,after_value,note,actor)
  values(new_row.alias_normalized,new_row.subject_id,new_row.grade_min,p_action,case when old.alias_normalized is null then null else to_jsonb(old)-'updated_by' end,to_jsonb(new_row)-'updated_by',trim(p_note),auth.uid());
 select coalesce(jsonb_agg(distinct subject_id),'[]') into shared from gina.subject_synonyms where alias_normalized=new_row.alias_normalized and subject_id<>new_row.subject_id and active;
 result:=jsonb_build_object('alias_normalized',new_row.alias_normalized,'subject_id',new_row.subject_id,'grade_min',new_row.grade_min,'grade_max',new_row.grade_max,
  'active',new_row.active,'revision',new_row.revision,'source',new_row.source,'shared_with',shared);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'subject.synonym.'||p_action,'subject_synonyms',
  new_row.subject_id||':'||new_row.alias_normalized||':'||new_row.grade_min,payload-'request');
 return result;
end;$$;

create function public.admin_subject_synonym_changes(p_subject_id text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'alias_normalized',c.alias_normalized,'subject_id',c.subject_id,'grade_min',c.grade_min,
  'action',c.action,'before',c.before_value,'after',c.after_value,'note',c.note,'created_at',c.created_at) order by c.created_at desc,c.id desc),'[]')
  from (select * from gina.subject_synonym_changes where p_subject_id is null or subject_id=p_subject_id order by created_at desc,id desc limit 50) c);
end;$$;

-- ---------------------------------------------------------------------------
-- 2) Takvim yayın kapısı ve inceleme kaydı
-- ---------------------------------------------------------------------------
create table gina.education_calendar_reviews (
 id uuid primary key default gen_random_uuid(),
 calendar_id uuid not null references gina.education_calendars(id) on delete cascade,
 revision int not null, checks jsonb not null, note text not null check(length(trim(note)) between 10 and 1000),
 reviewer uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index education_calendar_reviews_calendar on gina.education_calendar_reviews(calendar_id,created_at desc);
revoke all on gina.education_calendar_reviews from public,anon,authenticated,service_role;
alter table gina.education_calendar_reviews enable row level security;

-- Tohum kökeni: içe aktarma her taslak için audit_log'a seed_id/confidence/checked_at yazar (S04).
create function gina.education_calendar_provenance(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('seed_id',details->>'seed_id','confidence',details->>'confidence','checked_at',details->>'checked_at','source_url',details->>'source_url')
 from public.audit_log where action='education.calendar.draft' and target_table='education_calendars' and target_id=p_id::text and details->>'source'='seed'
 order by created_at desc limit 1;
$$;

-- Yayın kontrolleri (hata kodu dizisi; boşsa yayımlanabilir) ve uyarılar.
create function gina.education_calendar_publish_check(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c gina.education_calendars;prov jsonb;blocks text[]:='{}';warns text[]:='{}';place gina.education_places;parent_match jsonb;begin
 select * into c from gina.education_calendars where id=p_id;
 if c.id is null then return null;end if;
 select * into place from gina.education_places where id=c.place_id;
 prov:=gina.education_calendar_provenance(p_id);
 if prov->>'confidence'='low' then blocks:=array_append(blocks,'low_confidence');end if;
 if prov->>'confidence'='medium' then warns:=array_append(warns,'review_required');end if;
 if not place.active then blocks:=array_append(blocks,'place_inactive');end if;
 if (c.draft->>'verified_on')::date<(c.draft->>'starts_on')::date-365 then blocks:=array_append(blocks,'source_stale');end if;
 if c.published is not null and c.published_revision=c.revision then warns:=array_append(warns,'already_published');end if;
 -- Bölge/okul takvimi üst kapsamdaki yayımlanmış takvimle aynı dönemleri taşıyorsa ayrı yayın gereksizdir (zorunlu değil).
 if place.parent_id is not null then
  parent_match:=gina.education_calendar_match(place.parent_id,c.stage,c.academic_year);
  if parent_match is not null and parent_match->'value'->'terms'=c.draft->'terms' and parent_match->'value'->>'starts_on'=c.draft->>'starts_on'
   and parent_match->'value'->>'ends_on'=c.draft->>'ends_on' then warns:=array_append(warns,'same_as_parent');end if;
 end if;
 return jsonb_build_object('calendar_id',p_id,'revision',c.revision,'provenance',prov,'blocks',to_jsonb(blocks),'warnings',to_jsonb(warns),
  'place_kind',place.kind,'priority',case place.kind when 'school' then 3 when 'region' then (select max(depth) from gina.education_ancestors(place.id)) else 0 end,
  'last_review',(select jsonb_build_object('revision',r.revision,'checks',r.checks,'note',r.note,'created_at',r.created_at) from gina.education_calendar_reviews r
   where r.calendar_id=p_id order by created_at desc limit 1));
end;$$;

-- Her yayın yolu (eski admin_save_education_calendar(...,true) dahil) bu kapıdan geçer.
create function gina.education_calendar_publish_gate() returns trigger language plpgsql security definer set search_path='' as $$
declare chk jsonb;begin
 if new.published is null or (old.published is not distinct from new.published and old.published_revision is not distinct from new.published_revision) then return new;end if;
 chk:=gina.education_calendar_publish_check(new.id);
 if jsonb_array_length(chk->'blocks')>0 then raise exception 'calendar_publish_blocked' using detail=chk->>'blocks';end if;
 if chk->'warnings' ? 'review_required' and coalesce(current_setting('gina.calendar_review',true),'')<>new.id::text then raise exception 'calendar_publish_review_required';end if;
 return new;
end;$$;
create trigger education_calendar_publish_gate before update of published,published_revision on gina.education_calendars
 for each row execute function gina.education_calendar_publish_gate();

-- Kayıtlı inceleme ile yayın: kaynak açıldı, tarihler kaynakla karşılaştırıldı, kapsam (yer/kademe/yıl) doğru.
create function public.admin_publish_education_calendar(p_request uuid,p_id uuid,p_revision int,p_checks jsonb,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;c gina.education_calendars;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.calendar.review','id',p_id,'revision',p_revision,'checks',p_checks,'note',p_note);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if jsonb_typeof(p_checks) is distinct from 'object' or p_checks - array['source_opened','dates_match','scope_match'] <> '{}'::jsonb
  or not coalesce((p_checks->>'source_opened')::boolean and (p_checks->>'dates_match')::boolean and (p_checks->>'scope_match')::boolean,false)
  then raise exception 'calendar_review_incomplete';end if;
 if length(trim(coalesce(p_note,''))) not between 10 and 1000 then raise exception 'calendar_detail_required';end if;
 select * into c from gina.education_calendars where id=p_id;
 if c.id is null or c.revision<>p_revision then raise exception 'calendar_changed';end if;
 perform set_config('gina.calendar_review',p_id::text,true);
 result:=public.admin_save_education_calendar(gen_random_uuid(),p_id,p_revision,c.place_id,c.stage,c.academic_year,c.draft,true);
 perform set_config('gina.calendar_review','',true);
 insert into gina.education_calendar_reviews(calendar_id,revision,checks,note,reviewer) values(p_id,p_revision,p_checks,trim(p_note),auth.uid());
 result:=result||jsonb_build_object('reviewed',true);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.calendar.review','education_calendars',p_id::text,payload);
 return result;
end;$$;

-- ---------------------------------------------------------------------------
-- 3) Tatil günleri
-- ---------------------------------------------------------------------------
create table gina.education_holidays (
 id uuid primary key default gen_random_uuid(),
 place_id uuid not null references gina.education_places(id),
 stage text check(stage in('preschool','primary','middle','high','university')),
 academic_year int not null check(academic_year between 2000 and 2100),
 kind text not null check(kind in('public_holiday','break','local_day')),
 title text not null check(length(trim(title)) between 3 and 120),
 starts_on date not null, ends_on date not null check(ends_on>=starts_on and ends_on-starts_on<=31),
 half_day_start boolean not null default false,
 source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and length(source_url)<=1000),
 verified_on date not null, seed_key text,
 status text not null default 'draft' check(status in('draft','published','withdrawn')),
 revision int not null default 1, updated_at timestamptz not null default now()
);
create unique index education_holiday_seed on gina.education_holidays(place_id,academic_year,seed_key) where seed_key is not null;
create index education_holiday_lookup on gina.education_holidays(place_id,status,starts_on);
revoke all on gina.education_holidays from public,anon,authenticated,service_role;
alter table gina.education_holidays enable row level security;

-- Tohumdaki public_holidays.items → ülke kapsamında TASLAK tatil. Önizleme yazmaz; yürütme yalnız eksikleri ekler.
create function public.admin_import_education_holidays(p_request uuid,p_seed jsonb,p_execute boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;yr int;country uuid;src text;act text;records jsonb:='[]';n_create int:=0;n_exists int:=0;n_skip int:=0;payload jsonb;result jsonb;checked date;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 if p_execute is null or p_seed is null or jsonb_typeof(p_seed)<>'object' or p_seed->>'schema' is distinct from 'gina.education-calendar-seed.v1'
  or octet_length(p_seed::text)>262144 or jsonb_typeof(p_seed->'public_holidays'->'items') is distinct from 'array'
  or jsonb_typeof(p_seed->'academic_year') is distinct from 'number' or (p_seed->>'academic_year')::numeric not between 2000 and 2100
  or coalesce(p_seed->>'checked_at','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'calendar_seed_invalid';end if;
 yr:=(p_seed->>'academic_year')::int;checked:=(p_seed->>'checked_at')::date;
 select id into country from gina.education_places where kind='country' and lower(name)=lower(coalesce(p_seed->>'country','')) limit 1;
 if country is null then raise exception 'calendar_seed_invalid';end if;
 select s->>'url' into src from jsonb_array_elements(case jsonb_typeof(p_seed->'sources') when 'array' then p_seed->'sources' else '[]' end) s
  where s->>'id'=(p_seed->'public_holidays'->'sources'->>0) and coalesce(s->>'url','') ~ '^https://' limit 1;
 if p_execute then
  payload:=jsonb_build_object('action','education.holiday.seed','seed',encode(extensions.digest(p_seed::text,'sha256'),'hex'));
  result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
  perform pg_advisory_xact_lock(608005);
 end if;
 for item in select value from jsonb_array_elements(p_seed->'public_holidays'->'items') loop
  act:='create';
  if src is null or coalesce(item->>'id','')='' or length(trim(coalesce(item->>'title',''))) not between 3 and 120
   or coalesce(item->>'starts_on','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'ends_on','') !~ '^\d{4}-\d{2}-\d{2}$'
   or (item->>'ends_on')::date<(item->>'starts_on')::date or (item->>'ends_on')::date-(item->>'starts_on')::date>31 then act:='invalid';
  elsif (item->>'within_school_year')::boolean is not true then act:='skip';
  elsif exists(select 1 from gina.education_holidays where place_id=country and academic_year=yr and seed_key=item->>'id') then act:='exists';
  end if;
  if act='create' and p_execute then
   insert into gina.education_holidays(place_id,stage,academic_year,kind,title,starts_on,ends_on,half_day_start,source_url,verified_on,seed_key)
   values(country,null,yr,'public_holiday',trim(item->>'title'),(item->>'starts_on')::date,(item->>'ends_on')::date,coalesce((item->>'half_day_start')::boolean,false),src,checked,item->>'id');
  end if;
  if act='create' then n_create:=n_create+1;elsif act='exists' then n_exists:=n_exists+1;else n_skip:=n_skip+1;end if;
  records:=records||jsonb_build_object('seed_key',item->>'id','title',item->>'title','starts_on',item->>'starts_on','ends_on',item->>'ends_on','action',act);
 end loop;
 result:=jsonb_build_object('executed',p_execute,'published',false,'academic_year',yr,'source_url',src,
  'counts',jsonb_build_object('create',n_create,'exists',n_exists,'skipped',n_skip),'records',records);
 if p_execute then
  perform gina.save_help_receipt(p_request,payload,result,null);
  insert into public.audit_log(actor_id,action,target_table,details) values(auth.uid(),'education.holiday.seed_import','education_holidays',payload||jsonb_build_object('counts',result->'counts'));
 end if;
 return result;
end;$$;

create function public.admin_education_holidays(p_academic_year int default null) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('place_name',p.name) order by h.starts_on,h.id),'[]') from gina.education_holidays h
  join gina.education_places p on p.id=h.place_id where p_academic_year is null or h.academic_year=p_academic_year);
end;$$;

-- Yayın / geri çekme. Geri çekilen tatil öneri üretmez; velinin daha önce kabul ettiği işaret plan görünümünde kalmaz
-- (öneri listesi yalnız yayımlanmış veriden kurulur), ders programı hiçbir durumda değişmez.
create function public.admin_set_education_holiday_status(p_request uuid,p_id uuid,p_revision int,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;h gina.education_holidays;place gina.education_places;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 payload:=jsonb_build_object('action','education.holiday.status','id',p_id,'revision',p_revision,'status',p_status);
 result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
 if p_status is null or p_status not in('draft','published','withdrawn') then raise exception 'calendar_invalid';end if;
 perform pg_advisory_xact_lock(608005);
 select * into h from gina.education_holidays where id=p_id for update;
 if h.id is null or h.revision is distinct from p_revision then raise exception 'calendar_changed';end if;
 select * into place from gina.education_places where id=h.place_id;
 if p_status='published' and (not place.active or h.verified_on<h.starts_on-400) then raise exception 'calendar_publish_blocked';end if;
 update gina.education_holidays set status=p_status,revision=revision+1,updated_at=now() where id=p_id;
 result:=jsonb_build_object('id',p_id,'revision',p_revision+1,'status',p_status);
 perform gina.save_help_receipt(p_request,payload,result,null);
 insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.holiday.'||p_status,'education_holidays',p_id::text,payload);
 return result;
end;$$;

-- ---------------------------------------------------------------------------
-- 4) Veli için tatil önerisi
-- ---------------------------------------------------------------------------
create table gina.child_holiday_decisions (
 child_id uuid not null references public.children(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 holiday_key text not null check(length(holiday_key) between 3 and 120),
 title text not null, starts_on date not null, ends_on date not null,
 decision text not null check(decision in('accepted','dismissed')),
 revision int not null default 1,
 decided_by uuid references auth.users(id) on delete set null, decided_at timestamptz not null default now(),
 primary key(child_id,holiday_key)
);
create table gina.child_holiday_decision_changes (
 id bigint generated always as identity primary key,
 child_id uuid not null references public.children(id) on delete cascade,
 holiday_key text not null, action text not null check(action in('accept','dismiss','undo')),
 actor uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
revoke all on gina.child_holiday_decisions,gina.child_holiday_decision_changes from public,anon,authenticated,service_role;
alter table gina.child_holiday_decisions enable row level security;
alter table gina.child_holiday_decision_changes enable row level security;

-- Çocuğun takvim konumuna göre YAYIMLANMIŞ tatil pencereleri:
--  (a) eşleşen (en özel) yayımlanmış takvimin dönemleri arasındaki boşluklar = ara tatil / yarıyıl,
--  (b) konumun atalarında yayımlanmış tatil kayıtları (ülke resmî tatili, il yerel günü), kademe uyuyorsa.
-- Konumu olmayan çocuk için öneri yoktur (konum ve takvim veli tarafından seçilir).
create function gina.child_holiday_windows(p_child uuid,p_from date,p_to date) returns table(holiday_key text,kind text,title text,starts_on date,ends_on date,source_url text)
language plpgsql stable security definer set search_path='' as $$
declare loc gina.child_education_locations;cal jsonb;y int;begin
 select * into loc from gina.child_education_locations where child_id=p_child;
 if loc.child_id is null then return;end if;
 for y in select distinct extract(year from d)::int-k from generate_series(p_from,p_to,interval '1 day') d,(values(0),(1)) v(k) loop
  cal:=gina.education_calendar_match(loc.place_id,loc.stage,y);
  if cal is not null then
   return query select 'b:'||(cal->>'id')||':'||g.s::text,'break'::text,null::text,g.s,g.e,cal->'value'->>'source_url'
    from (select (t->>'ends_on')::date+1 s,(lead(t->>'starts_on') over(order by (t->>'starts_on')::date))::date-1 e
          from jsonb_array_elements(cal->'value'->'terms') t) g
    where g.e is not null and g.e>=g.s and g.s<=p_to and g.e>=p_from;
  end if;
 end loop;
 return query select 'h:'||h.id::text,h.kind,h.title,h.starts_on,h.ends_on,h.source_url
  from gina.education_holidays h join gina.education_ancestors(loc.place_id) a on a.id=h.place_id
  where h.status='published' and (h.stage is null or h.stage=loc.stage) and h.starts_on<=p_to and h.ends_on>=p_from;
end;$$;

-- Penceredeki, çocuğun güncel programında dersi olan hafta içi günleri.
create function gina.holiday_lesson_days(p_child uuid,p_from date,p_to date) returns int language sql stable security definer set search_path='' as $$
 select count(*)::int from generate_series(p_from,p_to,interval '1 day') d
 where extract(isodow from d) between 1 and 5 and exists(select 1 from public.school_timetables t,jsonb_array_elements(t.lessons) l
  where t.child_id=p_child and (l->>'day')::int=extract(isodow from d)::int);
$$;

create function public.education_holiday_suggestions(p_child_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);today date:=gina.family_today(f);begin
 return jsonb_build_object('child_id',p_child_id,'today',today,'has_location',exists(select 1 from gina.child_education_locations where child_id=p_child_id),
  'items',coalesce((select jsonb_agg(jsonb_build_object('key',w.holiday_key,'kind',w.kind,'title',w.title,'starts_on',w.starts_on,'ends_on',w.ends_on,
   'source_url',w.source_url,'lesson_days',gina.holiday_lesson_days(p_child_id,greatest(w.starts_on,today),w.ends_on),
   'decision',d.decision,'revision',coalesce(d.revision,0)) order by w.starts_on,w.holiday_key)
  from gina.child_holiday_windows(p_child_id,today,today+21) w
  left join gina.child_holiday_decisions d on d.child_id=p_child_id and d.holiday_key=w.holiday_key
  where w.ends_on>=today),'[]'::jsonb));
end;$$;

-- accept / dismiss / undo. Kabul yalnız işaret: ders programı, görevler, yıldızlar, ödüller ve sınıf değişmez.
create function public.decide_education_holiday(p_request_id uuid,p_child_id uuid,p_key text,p_decision text,p_revision int) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);payload jsonb;result jsonb;today date;w record;old gina.child_holiday_decisions;rev int;begin
 if p_request_id is null or p_key is null or p_decision is null or p_decision not in('accept','dismiss','undo') or p_revision is null then raise exception 'holiday_invalid';end if;
 payload:=jsonb_build_object('action','education.holiday.decide','child',p_child_id,'key',p_key,'decision',p_decision,'revision',p_revision);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform 1 from public.children where id=p_child_id for update;
 if exists(select 1 from public.children where id=p_child_id and archived_at is not null) then raise exception 'child_archived';end if;
 today:=gina.family_today(f);
 select * into old from gina.child_holiday_decisions where child_id=p_child_id and holiday_key=p_key for update;
 if coalesce(old.revision,0)<>p_revision then raise exception 'holiday_changed';end if;
 if p_decision='undo' then
  if old.child_id is null then raise exception 'holiday_changed';end if;
  delete from gina.child_holiday_decisions where child_id=p_child_id and holiday_key=p_key;
  rev:=0; -- karar yok: sonraki karar 0 sürümüyle verilir
 else
  -- Karar yalnız bugün veya sonrasında biten, yayımlanmış pencere için verilir.
  select * into w from gina.child_holiday_windows(p_child_id,today,today+60) x where x.holiday_key=p_key and x.ends_on>=today limit 1;
  if not found then raise exception 'holiday_unknown';end if;
  insert into gina.child_holiday_decisions(child_id,family_id,holiday_key,title,starts_on,ends_on,decision,revision,decided_by)
  values(p_child_id,f,p_key,coalesce(w.title,'break'),w.starts_on,w.ends_on,case p_decision when 'accept' then 'accepted' else 'dismissed' end,p_revision+1,auth.uid())
  on conflict(child_id,holiday_key) do update set decision=excluded.decision,revision=excluded.revision,decided_by=excluded.decided_by,decided_at=now(),
   title=excluded.title,starts_on=excluded.starts_on,ends_on=excluded.ends_on;
  rev:=p_revision+1;
 end if;
 insert into gina.child_holiday_decision_changes(child_id,holiday_key,action,actor) values(p_child_id,p_key,p_decision,auth.uid());
 result:=jsonb_build_object('child_id',p_child_id,'key',p_key,'decision',case p_decision when 'accept' then 'accepted' when 'dismiss' then 'dismissed' else null end,'revision',rev);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- plan_for_day: C02 sözleşmesi aynen + `holiday` işareti. Kabul edilmiş tatil gününde o günün ders satırları
-- `paused:true` taşır; satırlar silinmez, program kaydı değişmez.
alter function public.plan_for_day(uuid,date) set schema gina;
alter function gina.plan_for_day(uuid,date) rename to plan_for_day_dated;
revoke all on function gina.plan_for_day_dated(uuid,date) from public,anon,authenticated,service_role;
create function public.plan_for_day(p_child_id uuid,p_day date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb;w record;d gina.child_holiday_decisions;begin
 base:=gina.plan_for_day_dated(p_child_id,p_day);
 select * into w from gina.child_holiday_windows(p_child_id,p_day,p_day) x order by (x.kind='break') desc,x.holiday_key limit 1;
 if not found then return base||jsonb_build_object('holiday',null);end if;
 select * into d from gina.child_holiday_decisions where child_id=p_child_id and holiday_key=w.holiday_key;
 if d.decision='accepted' then
  base:=jsonb_set(base,'{timetable,day_lessons}',coalesce((select jsonb_agg(l||'{"paused":true}'::jsonb) from jsonb_array_elements(base->'timetable'->'day_lessons') l),'[]'::jsonb));
 end if;
 return base||jsonb_build_object('holiday',jsonb_build_object('key',w.holiday_key,'kind',w.kind,'title',w.title,'starts_on',w.starts_on,'ends_on',w.ends_on,'decision',d.decision));
end;$$;

-- ---------------------------------------------------------------------------
-- 5) Planlı eğitim geçişi + takvim gerekçesi
-- ---------------------------------------------------------------------------
alter table gina.child_education_schedules
 add column place_id uuid references gina.education_places(id),
 add column stage text check(stage in('preschool','primary','middle','high','university')),
 add column calendar_id uuid references gina.education_calendars(id) on delete set null,
 add column calendar_revision int,
 add column calendar_reason text check(calendar_reason in('school_calendar','personal','correction','calendar_missing')),
 add column calendar_detail text check(length(calendar_detail)<=2000);

alter function public.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean) set schema gina;
alter function gina.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean) rename to schedule_child_education_change_base;
revoke all on function gina.schedule_child_education_change_base(uuid,uuid,integer,text,integer,integer,text,date,boolean) from public,anon,authenticated,service_role;

-- Eski imza korunur; konumu yönetilen çocukta (anlık geçişteki gibi) takvim gerekçesi zorunlu olduğundan reddedilir.
create function public.schedule_child_education_change(p_request_id uuid,p_child_id uuid,p_revision integer,p_action text,p_academic_year integer,p_grade integer,
 p_school text,p_starts_on date,p_keep_timetable boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform gina.education_parent_guard(p_child_id);
 if exists(select 1 from gina.child_education_locations where child_id=p_child_id) then raise exception 'calendar_review_required';end if;
 return gina.schedule_child_education_change_base(p_request_id,p_child_id,p_revision,p_action,p_academic_year,p_grade,p_school,p_starts_on,p_keep_timetable);
end;$$;

create function public.schedule_child_education_change_with_calendar(p_request_id uuid,p_child_id uuid,p_revision integer,p_action text,p_academic_year integer,
 p_grade integer,p_school text,p_starts_on date,p_keep_timetable boolean,p_place_id uuid,p_stage text,p_calendar_id uuid,p_calendar_revision int,p_reason text,p_detail text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);payload jsonb;result jsonb;matched jsonb;warning text;place gina.education_places;expected_stage text;begin
 payload:=jsonb_build_object('action','education.schedule.calendar','child',p_child_id,'revision',p_revision,'kind',p_action,'year',p_academic_year,'grade',p_grade,
  'school',p_school,'date',p_starts_on,'keep',p_keep_timetable,'place',p_place_id,'stage',p_stage,'calendar',p_calendar_id,'calendarRevision',p_calendar_revision,'reason',p_reason,'detail',p_detail);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 perform pg_advisory_xact_lock_shared(608005);
 select * into place from gina.education_places where id=p_place_id and active;
 if place.id is null or p_stage is null or p_stage not in('preschool','primary','middle','high','university') then raise exception 'calendar_invalid';end if;
 expected_stage:=case when p_grade=0 then 'preschool' when p_grade between 1 and 4 then 'primary' when p_grade between 5 and 8 then 'middle' when p_grade between 9 and 12 then 'high' else null end;
 if expected_stage is not null and expected_stage<>p_stage then raise exception 'calendar_grade_mismatch';end if;
 if place.kind='school' and trim(coalesce(p_school,''))<>place.name then raise exception 'calendar_school_mismatch';end if;
 matched:=gina.education_calendar_match(p_place_id,p_stage,p_academic_year);
 if (matched->>'id')::uuid is distinct from p_calendar_id or (matched->>'revision')::int is distinct from p_calendar_revision then raise exception 'calendar_changed';end if;
 warning:=gina.education_calendar_warning(matched,p_action,p_starts_on);
 if p_reason is not null and p_reason not in('school_calendar','personal','correction','calendar_missing') then raise exception 'calendar_invalid';end if;
 if warning is not null and p_reason is null then raise exception 'calendar_reason_required';end if;
 if warning is null and p_reason is not null then raise exception 'calendar_invalid';end if;
 if length(coalesce(p_detail,''))>2000 or (p_reason='school_calendar' and length(trim(coalesce(p_detail,'')))<10) then raise exception 'calendar_detail_required';end if;
 result:=gina.schedule_child_education_change_base(gen_random_uuid(),p_child_id,p_revision,p_action,p_academic_year,p_grade,p_school,p_starts_on,p_keep_timetable);
 update gina.child_education_schedules set place_id=p_place_id,stage=p_stage,calendar_id=p_calendar_id,calendar_revision=p_calendar_revision,
  calendar_reason=p_reason,calendar_detail=case when p_reason is null then null else coalesce(trim(p_detail),'') end
 where id=(result->>'schedule_id')::uuid;
 result:=result||jsonb_build_object('warning',warning);
 perform gina.save_help_receipt(p_request_id,payload,result,f);
 return result;
end;$$;

-- C02 gövdesi + uygulanınca takvim konumu ve (gerekçe varsa) okul istisna bildirimi. Plan iptal edilirse hiçbir bildirim yazılmaz.
create or replace function public.apply_due_education_changes(p_child_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if s.place_id is not null then
  insert into gina.child_education_locations(child_id,place_id,stage) values(p_child_id,s.place_id,s.stage)
  on conflict(child_id) do update set place_id=excluded.place_id,stage=excluded.stage,updated_at=now();
  if s.calendar_reason is not null then
   insert into gina.education_calendar_reports(child_id,family_id,actor_id,place_id,calendar_id,academic_year,stage,proposed_start,reason,detail)
   values(p_child_id,f,s.created_by,s.place_id,s.calendar_id,s.academic_year,s.stage,s.starts_on,s.calendar_reason,coalesce(s.calendar_detail,''));
  end if;
 end if;
 return jsonb_build_object('child_id',p_child_id,'applied',true,'schedule_id',s.id,'period_id',result->>'period_id','revision',(result->>'revision')::int);
end;$$;

-- ---------------------------------------------------------------------------
-- 6) Dönem hatırlatması: planlı geçişi olan çocuğa yok; tek kez (veli × çocuk × yıl × tür)
-- ---------------------------------------------------------------------------
create or replace function gina.enqueue_education_reminders() returns int language plpgsql security definer set search_path='' as $$
declare n int;begin
 if not (select reminders_enabled from gina.education_notification_settings) then return 0;end if;
 perform pg_advisory_xact_lock_shared(608005);
 with matching as materialized (
 select c.id child_id,c.family_id,l.stage,(now() at time zone f.timezone)::date today,y.year,gina.education_calendar_match(l.place_id,l.stage,y.year) cal,e.academic_year active_year
 from public.children c join gina.child_education_locations l on l.child_id=c.id join public.families f on f.id=c.family_id
 left join gina.child_education_periods e on e.child_id=c.id and e.ends_on is null
 cross join lateral (values(extract(year from now() at time zone f.timezone)::int),(extract(year from now() at time zone f.timezone)::int-1))y(year)
 where c.archived_at is null
  -- C02: veli geçişi zaten planladıysa hatırlatma gereksizdir (uygulanınca ya da iptal edilince yeniden değerlendirilir).
  and not exists(select 1 from gina.child_education_schedules s where s.child_id=c.id and s.status='scheduled')
 for share of c
 ),events as (
 select *,case when today between (cal->'value'->>'starts_on')::date and (cal->'value'->>'starts_on')::date+7 and (active_year is null or active_year<year) then 'education_start'
 when today between (cal->'value'->>'ends_on')::date and (cal->'value'->>'ends_on')::date+7 and active_year=year then 'education_end' end kind from matching where cal is not null
 ), inserted as (
 insert into gina.parent_inbox(user_id,family_id,child_id,event_key,kind,title,body,expires_on)
 select m.user_id,e.family_id,e.child_id,e.kind||':'||e.child_id||':'||e.year,e.kind,
 case when e.kind='education_start' then 'Yeni eğitim yılı başladı' else 'Eğitim yılı tamamlanıyor' end,
 case when e.kind='education_start' then 'Okul takvimine göre yeni eğitim yılı başladı. Çocuğunun sınıf ve okul kaydını birlikte kontrol edebilirsin. Bilgileri yalnız sen onayladığında değiştiririz.' else 'Okul takvimindeki yıl sonuna geldik. Geçmiş çalışmalar korunur; sınıfı şimdi değiştirmen gerekmez. Yeni yıl kaydını okulun başlangıcında kontrol edebilirsin.' end,e.today+30
 from events e join public.family_members m on m.family_id=e.family_id where e.kind is not null
 on conflict(user_id,event_key) do nothing returning *
 ), queued as (
 insert into public.push_outbox(family_id,audience,target_user_id,target_child_id,kind,payload)
 select family_id,'parents',user_id,child_id,'education_reminder',jsonb_build_object('inbox_id',id,'child_id',child_id) from inserted returning id)
 select count(*) into n from queued;return n;
end;$$;

-- Teslim anında da: planlı geçiş açıldıysa bekleyen eğitim hatırlatması gönderilmez.
create or replace function gina.inbox_push_current(p_id text,p_user uuid,p_family uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from gina.parent_inbox i where i.id::text=p_id and i.user_id=p_user and i.family_id=p_family and i.expires_on>=current_date and i.read_at is null and i.archived_at is null
 and exists(select 1 from public.family_members where family_id=p_family and user_id=p_user)
 and (i.child_id is null or exists(select 1 from public.children where id=i.child_id and archived_at is null))
 and (i.kind<>'education_start' or not exists(select 1 from gina.child_education_periods e where e.child_id=i.child_id and e.ends_on is null and e.academic_year>=nullif(split_part(i.event_key,':',3),'')::int))
 and (i.kind<>'education_end' or exists(select 1 from gina.child_education_periods e where e.child_id=i.child_id and e.ends_on is null and e.academic_year=nullif(split_part(i.event_key,':',3),'')::int))
 and (i.kind not in('education_start','education_end') or not exists(select 1 from gina.child_education_schedules s where s.child_id=i.child_id and s.status='scheduled'))
 and (i.announcement_id is null or exists(select 1 from gina.parent_announcements a where a.id=i.announcement_id and a.status='published' and gina.announcement_family_matches(p_family,a.place_id,a.stage))));
$$;

-- ---------------------------------------------------------------------------
-- 7) Okul istisna kuyruğu özeti ve velinin kendi bildirimleri
-- ---------------------------------------------------------------------------
-- Aile/çocuk kimliği içermez: yer × kademe × yıl × gerekçe sayıları. `calendar_missing` takvimi olmayan yerleri gösterir.
create function public.admin_education_report_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('place_id',x.place_id,'place_name',p.name,'place_kind',p.kind,'stage',x.stage,'academic_year',x.academic_year,
  'reason',x.reason,'open',x.open,'verified',x.verified,'dismissed',x.dismissed,'latest',x.latest) order by x.open desc,x.latest desc),'[]')
  from (select place_id,stage,academic_year,reason,count(*) filter(where status='open') open,count(*) filter(where status='verified') verified,
   count(*) filter(where status='dismissed') dismissed,max(created_at) latest from gina.education_calendar_reports group by 1,2,3,4) x
  join gina.education_places p on p.id=x.place_id);
end;$$;

create function public.child_education_reports(p_child_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.education_parent_guard(p_child_id);begin
 return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'place_name',p.name,'academic_year',r.academic_year,'stage',r.stage,'proposed_start',r.proposed_start,
  'reason',r.reason,'status',case when r.reason='school_calendar' then r.status else 'recorded' end,'created_at',r.created_at) order by r.created_at desc),'[]')
  from gina.education_calendar_reports r join gina.education_places p on p.id=r.place_id where r.child_id=p_child_id and r.family_id=f);
end;$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke all on function gina.education_calendar_provenance(uuid),gina.education_calendar_publish_check(uuid),gina.education_calendar_publish_gate(),
 gina.child_holiday_windows(uuid,date,date),gina.holiday_lesson_days(uuid,date,date) from public,anon,authenticated,service_role;
revoke all on function public.suggest_subject(text,int),public.admin_subject_synonyms(),
 public.admin_save_subject_synonym(uuid,text,text,text,int,int,jsonb,int,text),public.admin_subject_synonym_changes(text),
 public.admin_publish_education_calendar(uuid,uuid,int,jsonb,text),public.admin_import_education_holidays(uuid,jsonb,boolean),
 public.admin_education_holidays(int),public.admin_set_education_holiday_status(uuid,uuid,int,text),
 public.education_holiday_suggestions(uuid),public.decide_education_holiday(uuid,uuid,text,text,int),public.plan_for_day(uuid,date),
 public.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean),
 public.schedule_child_education_change_with_calendar(uuid,uuid,integer,text,integer,integer,text,date,boolean,uuid,text,uuid,int,text,text),
 public.apply_due_education_changes(uuid),public.admin_education_report_summary(),public.child_education_reports(uuid)
 from public,anon,service_role;
grant execute on function public.suggest_subject(text,int),public.admin_subject_synonyms(),
 public.admin_save_subject_synonym(uuid,text,text,text,int,int,jsonb,int,text),public.admin_subject_synonym_changes(text),
 public.admin_publish_education_calendar(uuid,uuid,int,jsonb,text),public.admin_import_education_holidays(uuid,jsonb,boolean),
 public.admin_education_holidays(int),public.admin_set_education_holiday_status(uuid,uuid,int,text),
 public.education_holiday_suggestions(uuid),public.decide_education_holiday(uuid,uuid,text,text,int),public.plan_for_day(uuid,date),
 public.schedule_child_education_change(uuid,uuid,integer,text,integer,integer,text,date,boolean),
 public.schedule_child_education_change_with_calendar(uuid,uuid,integer,text,integer,integer,text,date,boolean,uuid,text,uuid,int,text,text),
 public.apply_due_education_changes(uuid),public.admin_education_report_summary(),public.child_education_reports(uuid)
 to authenticated;

-- Yayın kontrollerini yönetim listesinde göstermek için okuma ucu.
create function public.admin_education_calendar_checks() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(gina.education_calendar_publish_check(id) order by academic_year desc,id),'[]') from gina.education_calendars);
end;$$;
revoke all on function public.admin_education_calendar_checks() from public,anon,service_role;
grant execute on function public.admin_education_calendar_checks() to authenticated;
