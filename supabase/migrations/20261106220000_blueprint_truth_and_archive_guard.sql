-- C01 (P02/P04/L02/Q02) — yanlış doğrulamayı düzelt, eski sonuçları koru.
--
-- 1) Senaryo/dağılım kökeni (exam_blueprints): "okulun senaryosunu biliyorum/bilmiyorum" beyanı, velinin çalışma
--    dağılımı, kişiselleştirme ve resmî kaynak doğrulaması ayrı sütunlarda tutulur. Okul onayı (school_confirmed)
--    yalnız sunucunun kurduğu katalog bağıyla (gina.catalog_blueprint_links, veli "bu okulumun senaryosu" onayıyla)
--    oluşur; veli girişi ve "bilmiyorum" okul onayı alamaz (CHECK + tetikleyici). Resmî doğrulama yalnız sunucu
--    (service_role) tarafından ve yalnız katalog kopyasında işaretlenebilir. Kişiselleştirme metadata'sı isimden
--    ayrı `personalization` sütunundadır.
--    Geriye uyum: save_family_blueprint imzası aynı; yeni isteğe bağlı anahtarlar `school_scenario`,
--    `personalization`. Eski istemci → `school_scenario='unstated'`. Eski yanlış `school_confirmed:true` veli
--    kayıtları kökenine göre düzeltilir ve gina.blueprint_provenance_corrections'a önce/sonra yazılır. İsim, satırlar,
--    sınav/soru/cevap/puan snapshot'ları değişmez.
-- 2) save_calendar_event arşivli etkinliği düzenlemez/silmez ('event_archived'); geri alma bulk_restore_apply ile.
-- 3) Haftalık özet: çocuk kapsamı (arşivli profil hariç) veri, takma ad eşlemesi ve okuma ekranında tek yardımcıdan
--    gelir; arşivli profil sırayı kaydırıp yanlış ada eşlenmez. Mevcut haftalık snapshot'lar yeniden yazılmaz.
-- 4) P04 öncesi otomatik sıfırlar: etki önizlemesi + veli/yönetici onaylı, idempotent, denetim izli düzeltme.
--    Migration hiçbir denemeyi yeniden hesaplamaz; exam_answers (veli/AI puanı) hiç değişmez.

-- 1. Senaryo kökeni -----------------------------------------------------------------------------------------------
alter table public.exam_blueprints
 add column school_scenario text not null default 'unstated' check (school_scenario in ('known','unknown','unstated')),
 add column distribution_kind text not null default 'parent_study' check (distribution_kind in ('school_catalogue','parent_study','personalized')),
 add column school_confirmed boolean not null default false,
 add column official_source_verified boolean not null default false,
 add column official_verified_at timestamptz,
 add column personalization jsonb,
 add column provenance_corrected_at timestamptz;
alter table public.exam_blueprints
 add constraint exam_blueprints_school_confirmed_scope check (not school_confirmed or (distribution_kind='school_catalogue' and school_scenario='known')),
 add constraint exam_blueprints_official_scope check ((not official_source_verified and official_verified_at is null) or (official_source_verified and distribution_kind='school_catalogue' and official_verified_at is not null)),
 add constraint exam_blueprints_personalization_shape check ((distribution_kind='personalized') = (personalization is not null) and (personalization is null or jsonb_typeof(personalization)='object'));
comment on column public.exam_blueprints.school_scenario is 'Velinin beyanı: known=okulun senaryosunu biliyorum, unknown=bilmiyorum, unstated=sorulmadı (eski kayıt/eski istemci). Beyan okul onayı değildir.';
comment on column public.exam_blueprints.distribution_kind is 'school_catalogue=yayımlanmış katalogdan okul senaryosu kopyası; parent_study=velinin girdiği çalışma dağılımı; personalized=senaryodan değiştirilmiş çalışma.';
comment on column public.exam_blueprints.school_confirmed is 'Yalnız katalog kopyası + veli okul onayı. Veli girişi ve bilmiyorum yolu asla true olamaz.';
comment on column public.exam_blueprints.official_source_verified is 'Resmî kaynakla doğrulandı; yalnız sunucu (service_role) işaretler, yalnız katalog kopyasında.';
comment on column public.exam_blueprints.personalization is 'Kişiselleştirme metadata''sı (isimden ayrı).';

create table gina.blueprint_provenance_corrections (
 blueprint_id uuid primary key references public.exam_blueprints(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 reason text not null,
 before jsonb not null,
 after jsonb not null,
 corrected_at timestamptz not null default now()
);
alter table gina.blueprint_provenance_corrections enable row level security;
revoke all on gina.blueprint_provenance_corrections from public,anon,authenticated,service_role;

-- Katalog kopyaları: sunucu bağı tek kanıttır (düzenlenebilir JSON değil).
update public.exam_blueprints b set distribution_kind='school_catalogue',school_scenario='known',school_confirmed=true
from gina.catalog_blueprint_links l where l.blueprint_id=b.id;

-- Veli girişleri: P02 ad etiketi beyan/kişiselleştirme kökenini taşır; etiket isimde kalır, metadata ayrı sütuna geçer.
-- Tekrar çalıştırılabilir: yalnız farklı olan satırı yazar; denetim satırı blueprint başına bir kez oluşur.
create function gina.backfill_blueprint_provenance() returns int
language plpgsql security definer set search_path='' as $$
declare r record;scenario text;kind text;pers jsonb;ctx jsonb;n int:=0;
begin
 for r in select b.* from public.exam_blueprints b where not exists(select 1 from gina.catalog_blueprint_links l where l.blueprint_id=b.id) order by b.created_at,b.id for update loop
  scenario:=case when r.name ~ ' · (Çalışma senaryosu|Study scenario)$' then 'unknown' when r.name ~ ' · (Okulun senaryosu|School scenario)$' then 'known' else r.school_scenario end;
  kind:=case when r.name ~ ' · (Kişiselleştirilmiş çalışma|Personalised study)$' then 'personalized' when r.distribution_kind='school_catalogue' then 'parent_study' else r.distribution_kind end;
  pers:=case when kind='personalized' then coalesce(r.personalization,jsonb_build_object('basis','legacy_name_tag')) end;
  ctx:=r.source_context;
  if ctx ? 'school_confirmed' or ctx ? 'origin' or ctx ? 'officially_verified' then
   ctx:=ctx||jsonb_build_object('origin','parent_entered','school_confirmed',false,'officially_verified',false,'school_scenario',scenario,'distribution_kind',kind);
  end if;
  if ctx is distinct from r.source_context or scenario is distinct from r.school_scenario or kind is distinct from r.distribution_kind
   or pers is distinct from r.personalization or r.school_confirmed or r.official_source_verified then
   update public.exam_blueprints set source_context=ctx,school_scenario=scenario,distribution_kind=kind,personalization=pers,school_confirmed=false,
    official_source_verified=false,official_verified_at=null,provenance_corrected_at=now() where id=r.id;
   insert into gina.blueprint_provenance_corrections(blueprint_id,family_id,reason,before,after)
   values(r.id,r.family_id,case when r.source_context @> '{"school_confirmed":true}' or r.school_confirmed then 'parent_entry_marked_school_confirmed' else 'provenance_backfill' end,
    jsonb_build_object('source_context',r.source_context,'school_scenario',r.school_scenario,'distribution_kind',r.distribution_kind,'school_confirmed',r.school_confirmed,'personalization',r.personalization),
    jsonb_build_object('source_context',ctx,'school_scenario',scenario,'distribution_kind',kind,'school_confirmed',false,'personalization',pers))
   on conflict (blueprint_id) do nothing;
   n:=n+1;
  end if;
 end loop;
 return n;
end;$$;
revoke all on function gina.backfill_blueprint_provenance() from public,anon,authenticated,service_role;
select gina.backfill_blueprint_provenance();

-- Doğrudan istemci yazımı (REST, rol authenticated/anon) köken sütunlarını kuramaz/değiştiremez. SECURITY INVOKER:
-- current_user tanımlayıcı RPC'lerde fonksiyon sahibi, REST'te çağıran roldür.
create function gina.guard_blueprint_provenance() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('authenticated','anon') then
  if current_user<>'service_role' and (new.official_source_verified or new.official_verified_at is not null)
   and (tg_op='INSERT' or (old.official_source_verified,old.official_verified_at) is distinct from (new.official_source_verified,new.official_verified_at)) then
   raise exception 'blueprint_provenance_locked' using errcode='42501';
  end if;
  return new;
 end if;
 if tg_op='INSERT' then
  if new.school_confirmed or new.official_source_verified or new.official_verified_at is not null or new.distribution_kind='school_catalogue'
   or new.provenance_corrected_at is not null or new.source_context @> '{"school_confirmed":true}' or new.source_context @> '{"officially_verified":true}'
   or new.source_context @> '{"origin":"reviewed_catalogue"}' then
   raise exception 'blueprint_provenance_locked' using errcode='42501';
  end if;
 elsif (new.school_scenario,new.distribution_kind,new.school_confirmed,new.official_source_verified,new.official_verified_at,new.personalization,new.provenance_corrected_at,new.source_context)
  is distinct from (old.school_scenario,old.distribution_kind,old.school_confirmed,old.official_source_verified,old.official_verified_at,old.personalization,old.provenance_corrected_at,old.source_context) then
  raise exception 'blueprint_provenance_locked' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function gina.guard_blueprint_provenance() from public,anon,authenticated,service_role;
create trigger guard_blueprint_provenance before insert or update on public.exam_blueprints for each row execute function gina.guard_blueprint_provenance();

-- Katalog seçimi (save_catalog_blueprint, confirmed=true zorunlu) bağ satırını yazınca kopya okul onayı alır.
create function gina.mark_catalog_blueprint() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.exam_blueprints set distribution_kind='school_catalogue',school_scenario='known',school_confirmed=true,personalization=null where id=new.blueprint_id;
 return null;
end;$$;
revoke all on function gina.mark_catalog_blueprint() from public,anon,authenticated,service_role;
create trigger mark_catalog_blueprint after insert on gina.catalog_blueprint_links for each row execute function gina.mark_catalog_blueprint();

-- Veli dağılımı: imza aynı; okul onayı hiçbir girişle oluşmaz.
create or replace function public.save_family_blueprint(p_request_id uuid,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id();actor uuid:=auth.uid();r public.mutation_receipts;child public.children;row jsonb;total int:=0;result uuid;grade int;term int;exam int;y text;
 scenario text;kind text;pers jsonb;
begin
 if not gina.is_parent() or f is null or actor is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>50000 then raise exception 'blueprint_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.family_id<>f or r.actor_id<>actor or r.operation<>'family_blueprint' or r.payload<>p_input then raise exception 'request_conflict';end if;
  return (r.result#>>'{}')::uuid;
 end if;
 if exists(select 1 from jsonb_object_keys(p_input) k where k not in('child_id','grade','subject','name','academic_year','term','exam','rows','source_url','confirmed','school_scenario','personalization'))
 or jsonb_typeof(p_input->'grade') is distinct from 'number' or jsonb_typeof(p_input->'term') is distinct from 'number' or jsonb_typeof(p_input->'exam') is distinct from 'number'
 or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'subject') is distinct from 'string'
 or p_input->'confirmed' is distinct from 'true'::jsonb or coalesce(p_input->>'grade','') !~ '^([1-9]|1[0-2])$'
 or coalesce(p_input->>'term','') !~ '^[12]$' or coalesce(p_input->>'exam','') !~ '^[12]$'
 or length(trim(coalesce(p_input->>'subject',''))) not between 1 and 80 or length(trim(coalesce(p_input->>'name',''))) not between 1 and 100
 or coalesce(p_input->>'academic_year','') !~ '^20[0-9]{2}-20[0-9]{2}$'
 or jsonb_typeof(p_input->'rows') is distinct from 'array' then raise exception 'blueprint_invalid';end if;
 -- Beyan: yalnız known/unknown; yokluk = sorulmadı. Hiçbiri okul onayı değildir.
 if p_input ? 'school_scenario' and (jsonb_typeof(p_input->'school_scenario') is distinct from 'string' or p_input->>'school_scenario' not in('known','unknown')) then raise exception 'blueprint_invalid';end if;
 scenario:=coalesce(p_input->>'school_scenario','unstated');
 pers:=nullif(p_input->'personalization','null'::jsonb);
 if pers is not null and (jsonb_typeof(pers)<>'object'
  or exists(select 1 from jsonb_object_keys(pers) k where k not in('basis','base_label','base_total','base_blocks'))
  or pers->'basis' is distinct from '"catalogue_seed"'::jsonb
  or jsonb_typeof(pers->'base_label') is distinct from 'string' or length(trim(pers->>'base_label')) not between 1 and 200
  or jsonb_typeof(pers->'base_total') is distinct from 'number' or coalesce(pers->>'base_total','') !~ '^([1-9]|[12][0-9]|30)$'
  or jsonb_typeof(pers->'base_blocks') is distinct from 'number' or coalesce(pers->>'base_blocks','') !~ '^([1-9]|[12][0-9]|30)$') then raise exception 'blueprint_invalid';end if;
 kind:=case when pers is null then 'parent_study' else 'personalized' end;
 y:=p_input->>'academic_year';grade:=(p_input->>'grade')::int;term:=(p_input->>'term')::int;exam:=(p_input->>'exam')::int;
 if right(y,4)::int<>left(y,4)::int+1 or jsonb_array_length(p_input->'rows') not between 1 and 30 then raise exception 'blueprint_invalid';end if;
 if jsonb_typeof(p_input->'source_url') is distinct from 'string' or length(p_input->>'source_url')>2000
 or (p_input->>'source_url'<>'' and p_input->>'source_url' !~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$') then raise exception 'blueprint_invalid';end if;
 select * into child from public.children where id=(p_input->>'child_id')::uuid and family_id=f for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if child.grade between 1 and 12 and child.grade<>grade then raise exception 'blueprint_grade_mismatch';end if;
 for row in select value from jsonb_array_elements(p_input->'rows') loop
  if jsonb_typeof(row) is distinct from 'object' or jsonb_typeof(row->'topic') is distinct from 'string' or jsonb_typeof(row->'count') is distinct from 'number' or length(trim(coalesce(row->>'topic',''))) not between 1 and 200 or coalesce(row->>'count','') !~ '^([1-9]|[12][0-9]|30)$' then raise exception 'blueprint_invalid';end if;
  total:=total+(row->>'count')::int;
 end loop;
 if total>30 or (select count(distinct trim(value->>'topic')) from jsonb_array_elements(p_input->'rows'))<>jsonb_array_length(p_input->'rows') then raise exception 'blueprint_invalid';end if;
 insert into public.exam_blueprints(family_id,grade,subject,name,rows,source_url,created_by,source_context,school_scenario,distribution_kind,school_confirmed,personalization)
 values(f,grade,trim(p_input->>'subject'),trim(p_input->>'name'),(select jsonb_agg(jsonb_build_object('topic',trim(value->>'topic'),'count',(value->>'count')::int)) from jsonb_array_elements(p_input->'rows')),nullif(p_input->>'source_url',''),actor,
 jsonb_build_object('origin','parent_entered','academic_year',y,'term',term,'exam',exam,'school_confirmed',false,'officially_verified',false,'school_scenario',scenario,'distribution_kind',kind),
 scenario,kind,false,case when pers is null then null else jsonb_build_object('basis','catalogue_seed','base_label',trim(pers->>'base_label'),'base_total',(pers->>'base_total')::int,'base_blocks',(pers->>'base_blocks')::int) end) returning id into result;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)values(p_request_id,f,actor,'family_blueprint',p_input,to_jsonb(result));
 return result;
end;$$;
revoke all on function public.save_family_blueprint(uuid,jsonb) from public,anon;
grant execute on function public.save_family_blueprint(uuid,jsonb) to authenticated;

-- 2. Takvim: arşivli etkinlik normal düzenleme/silme ile değişmez ---------------------------------------------------
create or replace function public.save_calendar_event(p_request_id uuid,p_event_id uuid,p_revision int,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=gina.family_id(); previous public.events; candidate public.events; receipt public.mutation_receipts; payload jsonb; result jsonb;
begin
 if not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_event_id is null or p_revision is null or p_revision<0 then raise exception 'invalid_input';end if;
 payload:=jsonb_build_object('event',p_event_id,'revision',p_revision,'values',p_values);
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>auth.uid() or receipt.operation<>'save_calendar_event' or receipt.payload<>payload then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,61));
 select * into previous from public.events where id=p_event_id for update;
 if found then
  if previous.family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
  -- C01: arşivli kayıt yalnız açık geri alma akışıyla (bulk_restore_apply) canlanır; düzenleme/silme reddedilir.
  if previous.archived_at is not null then raise exception 'event_archived';end if;
  if previous.timetable_entry_key is not null then raise exception 'event_is_timetable';end if;
  if previous.edit_revision<>p_revision then raise exception 'event_changed';end if;
 elsif p_revision<>0 or p_values is null then raise exception 'event_changed';end if;
 if p_values is null then
  delete from public.events where id=p_event_id;
  result:=jsonb_build_object('id',p_event_id,'deleted',true,'revision',p_revision);
 else
  if jsonb_typeof(p_values)<>'object' or not(p_values ?& array['title','type','child_id','starts_at','ends_at','all_day','location','rrule'])
   or p_values-array['title','type','child_id','starts_at','ends_at','all_day','location','rrule']<>'{}'::jsonb
   or jsonb_typeof(p_values->'title')<>'string' or length(trim(p_values->>'title')) not between 1 and 120
   or jsonb_typeof(p_values->'type')<>'string' or jsonb_typeof(p_values->'starts_at')<>'string'
   or jsonb_typeof(p_values->'all_day')<>'boolean' or jsonb_typeof(p_values->'ends_at') not in('string','null')
   or jsonb_typeof(p_values->'child_id') not in('string','null') or jsonb_typeof(p_values->'location') not in('string','null')
   or jsonb_typeof(p_values->'rrule') not in('string','null') or coalesce(length(p_values->>'location'),0)>180 or coalesce(length(p_values->>'rrule'),0)>250
  then raise exception 'invalid_input';end if;
  select * into candidate from jsonb_populate_record(null::public.events,p_values);
  if not isfinite(candidate.starts_at) or (candidate.ends_at is not null and (not isfinite(candidate.ends_at) or candidate.ends_at<candidate.starts_at)) then raise exception 'invalid_input';end if;
  if candidate.child_id is not null and not exists(select 1 from public.children where id=candidate.child_id and family_id=f) then raise exception 'forbidden' using errcode='42501';end if;
  if candidate.rrule is not null and candidate.rrule is distinct from previous.rrule and candidate.rrule !~ '^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*(;UNTIL=[0-9]{8})?$' then raise exception 'invalid_input';end if;
  if previous.id is null then
   insert into public.events(id,family_id,created_by,title,type,child_id,starts_at,ends_at,all_day,location,rrule)
   values(p_event_id,f,auth.uid(),trim(candidate.title),candidate.type,candidate.child_id,candidate.starts_at,candidate.ends_at,candidate.all_day,candidate.location,candidate.rrule) returning * into candidate;
  else
   update public.events set title=trim(candidate.title),type=candidate.type,child_id=candidate.child_id,starts_at=candidate.starts_at,ends_at=candidate.ends_at,all_day=candidate.all_day,location=candidate.location,rrule=candidate.rrule where id=p_event_id returning * into candidate;
  end if;
  result:=jsonb_build_object('id',p_event_id,'deleted',false,'revision',candidate.edit_revision);
 end if;
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,auth.uid(),'save_calendar_event',payload,result);
 return result;
end;$$;
revoke all on function public.save_calendar_event(uuid,uuid,int,jsonb) from public,anon;
grant execute on function public.save_calendar_event(uuid,uuid,int,jsonb) to authenticated;

-- 3. Haftalık özet: tek çocuk kapsamı ---------------------------------------------------------------------------
-- Arşivli profil haftalık veride yoktur; takma ad eşlemesi de aynı kümeden üretilir (önceden eşleme arşivli
-- profili de sayıyordu: arşivli ilk çocuk "Çocuk A"yı alıp canlı çocukların adlarını kaydırıyordu).
create function gina.weekly_children(p_family uuid) returns table(id uuid,grade smallint,ord bigint,alias text)
language sql stable security definer set search_path='' as $$
 select c.id,c.grade,row_number() over w,'Çocuk '||chr(64+(row_number() over w)::int)
 from public.children c where c.family_id=p_family and c.archived_at is null
 window w as (order by c.sort_order,c.created_at,c.id);
$$;
revoke all on function gina.weekly_children(uuid) from public,anon,authenticated,service_role;

create or replace function public.get_weekly_summary_data(p_family_id uuid,p_week_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.families; monday date;begin
 if auth.role() is distinct from 'service_role' and
  (auth.uid() is not null and gina.is_parent() and gina.family_id()=p_family_id) is not true
 then raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 if p_week_start is null or not isfinite(p_week_start) or extract(isodow from p_week_start)<>1 or p_week_start<monday-56 or p_week_start>monday-7 then raise exception 'weekly_date';end if;
 return jsonb_build_object('week_start',p_week_start,'locale',f.locale,'timezone',f.timezone,'data_version','v2',
 'children',(select coalesce(jsonb_agg(jsonb_build_object('alias',k.alias,'grade',k.grade,
 'stars_earned',(select coalesce(sum(delta),0) from public.star_events where family_id=f.id and child_id=k.id and reason='task_approved' and delta>0 and created_at>=p_week_start::timestamp at time zone f.timezone and created_at<(p_week_start+7)::timestamp at time zone f.timezone),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_object('status',c.status,'count',c.n) order by c.status),'[]') from (select status,count(*) n from public.task_completions where family_id=f.id and child_id=k.id and due_date>=p_week_start and due_date<p_week_start+7 group by status)c)
 ) order by k.ord),'[]') from gina.weekly_children(f.id) k));
end;$$;
revoke all on function public.get_weekly_summary_data(uuid,date) from public,anon;
grant execute on function public.get_weekly_summary_data(uuid,date) to authenticated,service_role;

create or replace function gina.capture_weekly_aliases() returns trigger
language plpgsql security definer set search_path='' as $$
declare data jsonb; aliases jsonb;
begin
 select public.get_weekly_summary_data(new.family_id,new.week_start),
  (select coalesce(jsonb_object_agg(k.alias,k.id),'{}') from gina.weekly_children(new.family_id) k)
 into data,aliases;
 new.context:=jsonb_set(new.context,'{input}',data);
 new.child_aliases:=aliases;
 return new;
end;$$;
revoke all on function gina.capture_weekly_aliases() from public,anon,authenticated,service_role;

create or replace function public.get_family_weekly_review(p_week date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.families; monday date; chosen date; c gina.weekly_summary_contexts;
 j public.ai_operation_jobs; plan public.plans; pol public.ai_operation_policies;
 data jsonb; aliases jsonb; kids jsonb; output jsonb; state text:='empty'; used int; allowed boolean;
begin
 if auth.uid() is null or not gina.is_parent() or gina.family_id() is null then
  raise exception 'weekly_forbidden' using errcode='42501';end if;
 select * into f from public.families where id=gina.family_id();
 if f.id is null then raise exception 'weekly_forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.id::text,28));
 monday:=date_trunc('week',now() at time zone f.timezone)::date;
 chosen:=coalesce(p_week,monday-7);
 if not isfinite(chosen) or extract(isodow from chosen)<>1 or chosen<monday-56 or chosen>monday-7 then raise exception 'weekly_date';end if;
 select * into c from gina.weekly_summary_contexts where family_id=f.id and week_start=chosen;
 if c.id is not null then
  data:=c.context->'input'; aliases:=c.child_aliases;
  select * into j from public.ai_operation_jobs where family_id=f.id and action='weekly'
   and input_hash=encode(extensions.digest(c.id::text||c.context::text,'sha256'),'hex');
  state:=case when j.status='done' then 'ready'
   when j.status='working' and j.updated_at>now()-interval '3 minutes' then 'working'
   when j.status in('working','uncertain') then 'uncertain'
   when j.status='failed' then 'failed' else 'empty' end;
  if state='ready' then output:=j.result->'output';end if;
 else
  select public.get_weekly_summary_data(f.id,chosen),
   (select coalesce(jsonb_object_agg(k.alias,k.id),'{}') from gina.weekly_children(f.id) k)
  into data,aliases;
 end if;
 -- Old contexts deliberately keep aliases. Never infer their names from today's order.
 select coalesce(jsonb_agg(e.value||jsonb_build_object('name',ch.name) order by e.ordinality),'[]') into kids
 from jsonb_array_elements(data->'children') with ordinality e(value,ordinality)
 left join public.children ch on ch.family_id=f.id and ch.id::text=aliases->>(e.value->>'alias');
 plan:=gina.family_plan_of(f.id);
 select * into pol from public.ai_operation_policies where action='weekly' and plan_code=plan.code;
 select count(*) into used from public.ai_operation_jobs where family_id=f.id and action='weekly'
  and status<>'failed' and created_at>=gina.family_month_start(f.id);
 allowed:=coalesce(plan.ai_weekly and pol.enabled,false)
  and not exists(select 1 from public.app_settings where key='ai.enabled' and value='false'::jsonb)
  and not exists(select 1 from public.ai_settings where plan_code=plan.code and not enabled);
 return jsonb_build_object('week_start',chosen,'weeks',(select jsonb_agg(monday-7*i order by i) from generate_series(1,8)i),
  'timezone',f.timezone,'state',state,'snapshot_at',c.created_at,'children',kids,'summary',output,
  'remaining',greatest(0,coalesce(pol.monthly_limit,0)-used),
  'can_generate',allowed and used<coalesce(pol.monthly_limit,0) and jsonb_array_length(kids)>0 and state in('empty','failed'),
  'access',case when jsonb_array_length(kids)=0 then 'no_children' when not allowed then 'disabled'
   when used>=coalesce(pol.monthly_limit,0) then 'quota' else 'available' end);
end;$$;
revoke all on function public.get_family_weekly_review(date) from public,anon,service_role;
grant execute on function public.get_family_weekly_review(date) to authenticated;

-- 4. P04 öncesi otomatik sıfırlar ------------------------------------------------------------------------------------
-- Eski kural (20261030080000) boş metinli açık uçluyu (çizim-only dahil) toplamlarda 0 sayıyordu; exam_answers'a puan
-- yazılmadı. Etkilenen deneme: P04 sonrası hiç yeniden hesaplanmamış (provisional is null) ve puansız, metni boş en az
-- bir açık uçlu maddesi olan bitmiş deneme. Düzeltme yalnız deneme toplamlarını P04 kuralıyla yeniden hesaplar;
-- verilmiş (veli/AI) puanlara, cevaplara, raporlara ve snapshot'lara dokunmaz.
create table gina.attempt_score_corrections (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 rule text not null check (rule='p04_legacy_auto_zero'),
 before jsonb not null,
 after jsonb not null,
 items jsonb not null,
 applied_by uuid references auth.users(id) on delete set null,
 applied_role text not null check (applied_role in ('parent','admin')),
 request_id uuid not null,
 applied_at timestamptz not null default now(),
 unique (attempt_id, rule)
);
create index attempt_score_corrections_family_idx on gina.attempt_score_corrections(family_id,applied_at);
alter table gina.attempt_score_corrections enable row level security;
revoke all on gina.attempt_score_corrections from public,anon,authenticated,service_role;

create function gina.legacy_zero_items(p_attempt_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',q.id,'position',qid.ord,
   'state',case when gina.open_answer_present(ans.answer_text,ans.answer_document) then 'pending' else 'unanswered' end) order by qid.ord),'[]')
 from public.exam_attempts a
 join public.exams e on e.id=a.exam_id
 join unnest(e.question_ids) with ordinality qid(id,ord) on true
 join public.question_bank q on q.id=qid.id
 left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
 where a.id=p_attempt_id and q.kind='open_ended' and ans.score is null and coalesce(trim(ans.answer_text),'')='';
$$;
revoke all on function gina.legacy_zero_items(uuid) from public,anon,authenticated,service_role;

-- Yeniden hesabın yazmadan önizlemesi (gina.recompute_attempt_totals ile aynı kural).
create function gina.attempt_totals_projection(p_attempt_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with items as (
  select q.kind,
   case when q.kind='multiple_choice' then case when coalesce(ans.is_correct,false) then 100 else 0 end else ans.score::int end as value,
   case when q.kind='open_ended' then gina.open_answer_state(ans.score,ans.answer_text,ans.answer_document) end as open_state
  from public.exam_attempts a
  join public.exams e on e.id=a.exam_id
  join unnest(e.question_ids) qid on true
  join public.question_bank q on q.id=qid
  left join public.exam_answers ans on ans.attempt_id=a.id and ans.question_id=q.id
  where a.id=p_attempt_id
 ), agg as (
  select count(*) filter (where kind='open_ended')::int open_total,
   count(*) filter (where open_state='graded')::int open_graded,
   count(*) filter (where open_state='pending')::int open_pending,
   count(*) filter (where open_state='unanswered')::int open_unanswered,
   round(avg(value))::smallint score_pct
  from items
 )
 select jsonb_build_object(
  'status',case when a.status in('submitted','graded') and agg.open_graded=agg.open_total then 'graded' when a.status='graded' then 'submitted' else a.status::text end,
  'score_pct',agg.score_pct,'open_total',agg.open_total,'open_graded',agg.open_graded,'open_pending',agg.open_pending,
  'open_unanswered',agg.open_unanswered,'provisional',agg.open_graded<agg.open_total)
 from public.exam_attempts a,agg where a.id=p_attempt_id;
$$;
revoke all on function gina.attempt_totals_projection(uuid) from public,anon,authenticated,service_role;

create function gina.attempt_totals_snapshot(a public.exam_attempts) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('status',a.status,'score_pct',a.score_pct,'open_total',a.open_total,'open_graded',a.open_graded,
  'open_pending',a.open_pending,'open_unanswered',a.open_unanswered,'provisional',a.provisional,'graded_at',a.graded_at);
$$;
revoke all on function gina.attempt_totals_snapshot(public.exam_attempts) from public,anon,authenticated,service_role;

-- Aday: bitmiş, P04 sonrası hesaplanmamış, düzeltilmemiş, en az bir otomatik-sıfır maddesi olan deneme.
create function gina.legacy_zero_candidate(a public.exam_attempts) returns boolean
language sql stable security definer set search_path='' as $$
 select a.status in('submitted','graded') and a.provisional is null and coalesce(a.open_total,0)>0
  and not exists(select 1 from gina.attempt_score_corrections c where c.attempt_id=a.id)
  and jsonb_array_length(gina.legacy_zero_items(a.id))>0;
$$;
revoke all on function gina.legacy_zero_candidate(public.exam_attempts) from public,anon,authenticated,service_role;

-- Önizleme: veli kendi ailesi; tam yönetici (is_admin_strict) bir aile ya da yalnız aile başına sayı. Yazmaz.
create function public.preview_legacy_open_zero_corrections(p_family_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid;
begin
 if auth.uid() is not null and coalesce(gina.is_parent(),false) and gina.family_id() is not null then
  f:=gina.family_id();
  if p_family_id is not null and p_family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
 elsif coalesce(gina.is_admin_strict(),false) then
  if p_family_id is null then
   return (select jsonb_build_object('scope','all','total',coalesce(sum(n),0),'families',coalesce(jsonb_agg(jsonb_build_object('family_id',family_id,'attempts',n) order by family_id),'[]'))
    from (select a.family_id,count(*)::int n from public.exam_attempts a where gina.legacy_zero_candidate(a) group by a.family_id) x);
  end if;
  f:=p_family_id;
 else
  raise exception 'forbidden' using errcode='42501';
 end if;
 return (select jsonb_build_object('scope','family','family_id',f,'rule','p04_legacy_auto_zero',
  'eligible',count(*) filter (where blocked is null),
  'blocked',count(*) filter (where blocked is not null),
  'already_corrected',(select count(*) from gina.attempt_score_corrections c where c.family_id=f),
  'attempts',coalesce(jsonb_agg(jsonb_build_object('attempt_id',id,'exam_id',exam_id,'child_id',child_id,'finished_at',finished_at,'blocked',blocked,
    'before',before,'after',after,'items',items,'kept_scores',kept) order by finished_at,id),'[]'))
  from (select a.id,a.exam_id,a.child_id,a.finished_at,
    case when ch.archived_at is not null then 'child_archived' end blocked,
    gina.attempt_totals_snapshot(a) before,gina.attempt_totals_projection(a.id) after,gina.legacy_zero_items(a.id) items,
    (select count(*) from public.exam_answers x where x.attempt_id=a.id and x.score is not null)::int kept
   from public.exam_attempts a join public.children ch on ch.id=a.child_id
   where a.family_id=f and gina.legacy_zero_candidate(a)
   order by a.finished_at,a.id limit 200) y);
end;$$;
revoke all on function public.preview_legacy_open_zero_corrections(uuid) from public,anon,service_role;
grant execute on function public.preview_legacy_open_zero_corrections(uuid) to authenticated;

-- Uygulama: yalnız açıkça seçilen denemeler; aynı istek kimliği aynı sonucu döner, ikinci istek 'already_corrected'.
create function public.apply_legacy_open_zero_corrections(p_request_id uuid,p_attempt_ids uuid[],p_family_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid;actor uuid:=auth.uid();v_role text;receipt public.mutation_receipts;payload jsonb;a public.exam_attempts;v public.exam_attempts;
 v_id uuid;results jsonb:='[]';v_before jsonb;projected jsonb;v_after jsonb;v_items jsonb;archived timestamptz;done int:=0;result jsonb;
begin
 if actor is not null and coalesce(gina.is_parent(),false) and gina.family_id() is not null then
  f:=gina.family_id();v_role:='parent';
  if p_family_id is not null and p_family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
 elsif actor is not null and coalesce(gina.is_admin_strict(),false) and p_family_id is not null then
  f:=p_family_id;v_role:='admin';
  if not exists(select 1 from public.families where families.id=f) then raise exception 'forbidden' using errcode='42501';end if;
 else
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_request_id is null or p_attempt_ids is null or cardinality(p_attempt_ids) not between 1 and 200
  or (select count(distinct x) from unnest(p_attempt_ids) x)<>cardinality(p_attempt_ids) or array_position(p_attempt_ids,null) is not null then
  raise exception 'invalid_input';
 end if;
 payload:=jsonb_build_object('family_id',f,'attempt_ids',(select jsonb_agg(x order by x) from unnest(p_attempt_ids) x));
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into receipt from public.mutation_receipts where request_id=p_request_id;
 if found then
  if receipt.family_id<>f or receipt.actor_id<>actor or receipt.operation<>'legacy_open_zero_correction' or receipt.payload<>payload then raise exception 'request_conflict';end if;
  return receipt.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,104));
 foreach v_id in array (select array_agg(x order by x) from unnest(p_attempt_ids) x) loop
  select * into a from public.exam_attempts x where x.id=v_id and x.family_id=f for update;
  if a.id is null then
   results:=results||jsonb_build_array(jsonb_build_object('attempt_id',v_id,'result','not_found'));continue;
  end if;
  if exists(select 1 from gina.attempt_score_corrections c where c.attempt_id=a.id) then
   results:=results||jsonb_build_array(jsonb_build_object('attempt_id',v_id,'result','already_corrected',
    'after',(select c.after from gina.attempt_score_corrections c where c.attempt_id=a.id)));continue;
  end if;
  select archived_at into archived from public.children where children.id=a.child_id;
  if archived is not null then
   results:=results||jsonb_build_array(jsonb_build_object('attempt_id',v_id,'result','child_archived'));continue;
  end if;
  if not gina.legacy_zero_candidate(a) then
   results:=results||jsonb_build_array(jsonb_build_object('attempt_id',v_id,'result','not_eligible'));continue;
  end if;
  v_before:=gina.attempt_totals_snapshot(a);v_items:=gina.legacy_zero_items(a.id);projected:=gina.attempt_totals_projection(a.id);
  v:=gina.recompute_attempt_totals(a.id);
  v_after:=gina.attempt_totals_snapshot(v);
  if (v_after-'graded_at'-'open_total') is distinct from (projected-'open_total') then raise exception 'correction_mismatch';end if;
  insert into gina.attempt_score_corrections(attempt_id,family_id,rule,before,after,items,applied_by,applied_role,request_id)
  values(a.id,f,'p04_legacy_auto_zero',v_before,v_after,v_items,actor,v_role,p_request_id);
  done:=done+1;
  results:=results||jsonb_build_array(jsonb_build_object('attempt_id',v_id,'result','corrected','before',v_before,'after',v_after));
 end loop;
 result:=jsonb_build_object('corrected',done,'results',results);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result) values(p_request_id,f,actor,'legacy_open_zero_correction',payload,result);
 return result;
end;$$;
revoke all on function public.apply_legacy_open_zero_corrections(uuid,uuid[],uuid) from public,anon,service_role;
grant execute on function public.apply_legacy_open_zero_corrections(uuid,uuid[],uuid) to authenticated;

-- Denetim izi okuma: veli kendi ailesi; tam yönetici belirtilen aile.
create function public.get_legacy_open_zero_corrections(p_family_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid;
begin
 if auth.uid() is not null and coalesce(gina.is_parent(),false) and gina.family_id() is not null then
  f:=gina.family_id();
  if p_family_id is not null and p_family_id<>f then raise exception 'forbidden' using errcode='42501';end if;
 elsif coalesce(gina.is_admin_strict(),false) and p_family_id is not null then f:=p_family_id;
 else raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('attempt_id',attempt_id,'rule',rule,'before',before,'after',after,'items',items,
   'applied_role',applied_role,'applied_at',applied_at) order by applied_at,attempt_id),'[]') from gina.attempt_score_corrections where family_id=f);
end;$$;
revoke all on function public.get_legacy_open_zero_corrections(uuid) from public,anon,service_role;
grant execute on function public.get_legacy_open_zero_corrections(uuid) to authenticated;
