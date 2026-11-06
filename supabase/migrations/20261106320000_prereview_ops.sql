-- C09 (E01/B02) — AI içerik ön incelemesini işletilebilir yap.
--
-- 1. Sağlayıcı-farkında devre kesici (C08): Edge, çözülmüş sağlayıcının duraklatılıp duraklatılmadığını
--    sorar ve sonucu aynı `gina.ai_provider_outcome` kaydına yazar (content_prereview_provider). Duraklatılmış
--    sağlayıcıya çağrı yapılmaz; o deneme sayılmaz (ücret oluşmadı), kayıt kuyrukta kalır.
-- 2. Görsel bayrağı: model görsel baytlarını görmez. Her verdict'e veritabanı tarafından sayılan
--    `media{count, reviewed, image_dependent_correctness}` eklenir; C09 sözleşmesiyle gelen (media anahtarlı)
--    verdict, incelenmemiş görselli kayıtta `ai_approved` olamaz (prereview_media_unreviewed).
-- 3. Eski kaynak (C05): onaylı olmayan/yerine yenisi gelmiş (superseded/withdrawn) kaynak sürümünden
--    ya da emekli hedeften gelen senaryo adayı modele gönderilmez; AI çağrısı olmadan needs_admin + neden.
-- 4. Yapılandırma kaynaklı needs_admin (AI kapalı, model pasif, anahtar yok, sağlayıcı duraklatıldı, eski kaynak)
--    yöneticinin açık isteğiyle yeniden kuyruğa alınabilir; retry_limit ve model kararları alınmaz (sonsuz ücret yok).
-- 5. Aile üyesi olmayan yönetici ve içerik operatörü için kalıcı uygulama içi bildirim
--    (gina.operator_prereview_notices). Push (aile üyesi yönetici) eskisi gibi sürer.
-- 6. Aday rozetleri için kaynak bağlamı (admin_prereview_candidate_context; içerik + yayın rolü, C07 matrisi).
-- 7. pg_cron drain: yalnız kapı açık, bekleyen kayıt var ve Vault sırları kuruluysa Edge'e istek atar.
--
-- C07'nin yeniden kapıladığı admin_content_prereviews / request_content_prereview / enqueue_content_prereview
-- bu migration'da TANIMLANMAZ (yetki matrisi korunur). Değişen gövdeler yalnız servis/iç fonksiyonlardır:
-- content_prereview_claim, content_prereview_finish, gina.content_prereview_queue, gina.content_prereview_notify.
-- Mevcut veriyi yeniden yazmaz.

-- 1. Yardımcılar ---------------------------------------------------------------------------------
-- Kayıttaki görsel sayısı (modele hiçbir zaman bayt gitmez).
create function gina.content_prereview_media(p_kind text,p_id uuid) returns int
language sql stable security definer set search_path='' as $$
 select case p_kind
  when 'library_package' then (select count(*)::int from gina.library_import_sources s where s.package_id=p_id and s.asset_hash is not null)
  when 'contribution_set' then (select coalesce(jsonb_array_length(s.snapshot->'images'),0) from gina.contribution_sets s where s.id=p_id)
  else 0 end;
$$;

-- Senaryo adayının kaynak bağlamı: C05 sürüm durumu (onaylı önce), hedef durumu, güncellik ve eskime nedeni.
create function gina.prereview_candidate_source(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c gina.curriculum_candidates;v record;target text;stale boolean;reason text;begin
 select * into c from gina.curriculum_candidates where id=p_id;
 if not found then return null;end if;
 select r.status,r.id revision_id,s.school_year,s.term,s.exam_family,s.freshness,s.last_checked_at into v
 from gina.curriculum_source_revisions r join gina.curriculum_sources s on s.id=r.source_id
 where r.sha256=c.source_sha256 order by (r.status='approved') desc,r.retrieved_at desc limit 1;
 if v.status is null then
  return jsonb_build_object('source_status','manifest_only','target_status',null,'school_year',c.candidate->>'academic_year','term',c.candidate->'term',
   'stale',null,'obsolete_reason',null);
 end if;
 select t.status into target from gina.curriculum_source_targets t where t.exam_family=v.exam_family and t.school_year=v.school_year and t.term=v.term;
 stale:=v.freshness='unverified' or v.last_checked_at is null or v.last_checked_at<now()-interval '7 days';
 reason:=case when v.status in('superseded','withdrawn') then 'source_'||v.status
  when target is distinct from 'active' then 'source_target_retired' end;
 return jsonb_build_object('source_status',v.status,'revision_id',v.revision_id,'target_status',coalesce(target,'missing'),'school_year',v.school_year,'term',v.term,
  'last_checked_at',v.last_checked_at,'stale',stale,'obsolete_reason',reason);
end;$$;
revoke all on function gina.content_prereview_media(text,uuid),gina.prereview_candidate_source(uuid) from public,anon,authenticated,service_role;

-- Yeniden istenebilen needs_admin nedenleri: hiçbiri model kararı değildir ve ücret oluşturmamıştır.
create function gina.prereview_requeueable(p_reason text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_reason in('ai_disabled','ai_model_unavailable','ai_not_configured','provider_unconfigured','ai_model_unsupported',
  'ai_configuration_unavailable','plan_has_no_ai','ai_temporarily_unavailable','source_superseded','source_withdrawn','source_target_retired'),false);
$$;
revoke all on function gina.prereview_requeueable(text) from public,anon,authenticated,service_role;

-- 2. Operatör bildirimleri -------------------------------------------------------------------------
create table gina.operator_prereview_notices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 target_kind text not null check(target_kind in('library_package','contribution_set','curriculum_candidate')),
 target_id uuid not null,
 content_hash text not null, prompt_version text not null,
 prereview_status text not null check(prereview_status in('needs_admin','ai_rejected_suggestion')),
 reason text check(length(reason)<=80),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(user_id,target_kind,target_id,content_hash,prompt_version)
);
create index operator_prereview_notices_unread on gina.operator_prereview_notices(user_id,created_at desc) where read_at is null;
alter table gina.operator_prereview_notices enable row level security;
revoke all on gina.operator_prereview_notices from public,anon,authenticated,service_role;

-- Bildirim: push (aile üyesi yönetici; E01 davranışı aynen) + kalıcı operatör bildirimi (tam yönetici ve süresi
-- dolmamış içerik operatörü, aile üyeliği aranmaz). (kayıt, içerik, prompt sürümü) başına bir kez.
create or replace function gina.content_prereview_notify(p_kind text,p_id uuid,p_hash text,p_prompt_version text,p_status text) returns int
language plpgsql security definer set search_path='' as $$
declare n int;begin
 if exists(select 1 from gina.content_prereview_notices where target_kind=p_kind and target_id=p_id and content_hash=p_hash and prompt_version=p_prompt_version) then return -1;end if;
 with recipients as(
  select distinct on(a.user_id) a.user_id,m.family_id from public.admins a join public.family_members m on m.user_id=a.user_id
  left join public.active_families af on af.user_id=a.user_id
  order by a.user_id,(m.family_id=af.family_id) desc nulls last,m.family_id),
 queued as(
  insert into public.push_outbox(family_id,audience,target_user_id,kind,payload)
  select family_id,'parents',user_id,'content_prereview_needs_admin',jsonb_build_object('target_id',p_id,'target_kind',p_kind,'prereview_status',p_status) from recipients returning 1)
 select count(*) into n from queued;
 insert into gina.content_prereview_notices(target_kind,target_id,content_hash,prompt_version,prereview_status,recipient_count) values(p_kind,p_id,p_hash,p_prompt_version,p_status,n);
 insert into gina.operator_prereview_notices(user_id,target_kind,target_id,content_hash,prompt_version,prereview_status,reason)
 select u.user_id,p_kind,p_id,p_hash,p_prompt_version,p_status,
  left((select r.prereview_verdict->>'decision_reason' from gina.content_prereviews r where r.target_kind=p_kind and r.target_id=p_id),80)
 from (select a.user_id from public.admins a
       union select o.user_id from public.operations_members o where o.role='content' and o.revoked_at is null and o.expires_at>now()) u
 on conflict do nothing;
 return n;
end;$$;
revoke all on function gina.content_prereview_notify(text,uuid,text,text,text) from public,anon,authenticated,service_role;

-- Okuyan: tam yönetici veya içerik operatörü; yalnız kendi bildirimleri. Yetki her çağrıda canlı.
create function public.operator_prereview_notices(p_unread_only boolean default false,p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_operation_role(array['content']);
 if p_limit is null or p_limit not between 1 and 200 then raise exception 'invalid_input';end if;
 return jsonb_build_object(
  'unread',(select count(*) from gina.operator_prereview_notices where user_id=auth.uid() and read_at is null),
  'items',(select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') from (
    select jsonb_build_object('id',n.id,'target_kind',n.target_kind,'target_id',n.target_id,'prereview_status',n.prereview_status,'reason',n.reason,
     'created_at',n.created_at,'read_at',n.read_at,
     'current_status',r.prereview_status,'awaiting_admin',gina.content_prereview_awaiting(n.target_kind,n.target_id),
     'current_content',r.content_hash is not distinct from n.content_hash) x
    from gina.operator_prereview_notices n left join gina.content_prereviews r on r.target_kind=n.target_kind and r.target_id=n.target_id
    where n.user_id=auth.uid() and (not coalesce(p_unread_only,false) or n.read_at is null)
    order by n.created_at desc limit p_limit) s));
end;$$;
create function public.mark_operator_prereview_notices_read(p_ids uuid[] default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n int;begin
 perform gina.assert_operation_role(array['content']);
 if p_ids is not null and cardinality(p_ids)>200 then raise exception 'invalid_input';end if;
 update gina.operator_prereview_notices set read_at=now() where user_id=auth.uid() and read_at is null and (p_ids is null or id=any(p_ids));
 get diagnostics n=row_count;
 return jsonb_build_object('marked',n,'unread',(select count(*) from gina.operator_prereview_notices where user_id=auth.uid() and read_at is null));
end;$$;
revoke all on function public.operator_prereview_notices(boolean,int),public.mark_operator_prereview_notices_read(uuid[]) from public,anon,service_role;
grant execute on function public.operator_prereview_notices(boolean,int),public.mark_operator_prereview_notices_read(uuid[]) to authenticated;

-- Aday rozetleri: kaynak sürümü/hedef/güncellik ve AI kaydı. İçerik + yayın rolü (birleşik listeyi görenler).
create function public.admin_prereview_candidate_context(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_operation_role(array['content','release']);
 if p_ids is null or cardinality(p_ids)>200 then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_object_agg(c.id,gina.prereview_candidate_source(c.id)||jsonb_build_object(
   'status',c.status,'prereview_status',r.prereview_status,'prereview_reason',r.prereview_verdict->>'decision_reason')),'{}')
  from gina.curriculum_candidates c left join gina.content_prereviews r on r.target_kind='curriculum_candidate' and r.target_id=c.id
  where c.id=any(p_ids));
end;$$;
revoke all on function public.admin_prereview_candidate_context(uuid[]) from public,anon,service_role;
grant execute on function public.admin_prereview_candidate_context(uuid[]) to authenticated;

-- 3. Kuyruk: yapılandırma kaynaklı needs_admin açık istekle yeniden alınır ------------------------------
create or replace function gina.content_prereview_queue(p_kind text,p_id uuid,p_actor uuid) returns text
language plpgsql security definer set search_path='' as $$
declare src jsonb;h text;row gina.content_prereviews;begin
 src:=gina.content_prereview_source(p_kind,p_id);
 if src is null then raise exception 'prereview_not_found';end if;
 h:=gina.content_prereview_hash(src);
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id::text,91));
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id;
 if not found then
  insert into gina.content_prereviews(target_kind,target_id,content_hash,requested_by) values(p_kind,p_id,h,p_actor);return 'queued';
 end if;
 if row.content_hash<>h
  or (p_actor is not null and row.prereview_status='needs_admin' and gina.prereview_requeueable(row.prereview_verdict->>'decision_reason')) then
  update gina.content_prereviews set content_hash=h,prereview_status='pending',prereview_verdict=null,prereview_at=null,attempts=0,last_error=null,lease=null,claimed_at=null,requested_by=p_actor,queued_at=now(),updated_at=now()
  where target_kind=p_kind and target_id=p_id;return 'requeued';
 end if;
 return 'unchanged';
end;$$;
revoke all on function gina.content_prereview_queue(text,uuid,uuid) from public,anon,authenticated,service_role;

-- 4. Servis claim: eski kaynak → AI çağrısı yok; görsel sayısı claim'de döner --------------------------
create or replace function public.content_prereview_claim(p_kind text,p_id uuid,p_lease uuid,p_prompt_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare src jsonb;h text;row gina.content_prereviews;existed boolean;ctx jsonb;obsolete text;verdict jsonb;begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('library_package','contribution_set','curriculum_candidate') or p_id is null or p_lease is null or p_prompt_version is null or length(p_prompt_version) not between 1 and 40 then raise exception 'prereview_kind_invalid';end if;
 if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return jsonb_build_object('error','prereview_disabled');end if;
 src:=gina.content_prereview_source(p_kind,p_id);
 if src is null then return jsonb_build_object('error','not_found');end if;
 h:=gina.content_prereview_hash(src);
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id::text,91));
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id for update;
 existed:=found;
 if existed and row.content_hash=h and row.prompt_version=p_prompt_version and row.prereview_status<>'pending' then
  return jsonb_build_object('cached',true,'prereview_status',row.prereview_status,'prereview_verdict',row.prereview_verdict,'content_hash',h);
 end if;
 if existed and row.content_hash=h and row.prompt_version=p_prompt_version and row.lease is not null and row.claimed_at>now()-interval '3 minutes' then
  return jsonb_build_object('error','in_progress');
 end if;
 if existed and (row.content_hash<>h or row.prompt_version<>p_prompt_version) then
  update gina.content_prereviews set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',prereview_verdict=null,prereview_at=null,attempts=0,last_error=null,lease=null,claimed_at=null,queued_at=now(),updated_at=now()
  where target_kind=p_kind and target_id=p_id returning * into row;
 end if;
 -- C05: eski/geri çekilmiş kaynak sürümü veya emekli hedef — modele gönderilmez, ücret yok.
 if p_kind='curriculum_candidate' then
  ctx:=gina.prereview_candidate_source(p_id);
  obsolete:=ctx->>'obsolete_reason';
 end if;
 if obsolete is not null then
  verdict:=jsonb_build_object('model',null,'provider',null,'confidence',0,'recommendation','admin_review','decision_reason',obsolete,'rubric',null,
   'findings',jsonb_build_array(jsonb_build_object('code','other','severity','advisory','detail',obsolete,'item',null)),'summary',null,
   'source',ctx,'content_hash',h,'prompt_version',p_prompt_version,'media',jsonb_build_object('count',0,'reviewed',false,'image_dependent_correctness','not_applicable'));
  insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,prereview_status,prereview_verdict,prereview_at,attempts,last_error,updated_at)
  values(p_kind,p_id,h,p_prompt_version,'needs_admin',verdict,now(),0,obsolete,now())
  on conflict(target_kind,target_id) do update set content_hash=h,prompt_version=p_prompt_version,prereview_status='needs_admin',prereview_verdict=verdict,
   prereview_at=now(),last_error=obsolete,lease=null,claimed_at=null,updated_at=now();
  perform gina.content_prereview_notify(p_kind,p_id,h,p_prompt_version,'needs_admin');
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.needs_admin','gina.content_prereviews',p_kind||':'||p_id::text,jsonb_build_object('reason',obsolete));
  return jsonb_build_object('error','source_obsolete','reason',obsolete,'prereview_status','needs_admin');
 end if;
 if existed and row.attempts>=3 then
  update gina.content_prereviews set prereview_status='needs_admin',prereview_at=now(),lease=null,claimed_at=null,updated_at=now(),
   prereview_verdict=jsonb_build_object('decision_reason','retry_limit','last_error',row.last_error,'attempts',row.attempts,'content_hash',h,'prompt_version',p_prompt_version)
  where target_kind=p_kind and target_id=p_id;
  perform gina.content_prereview_notify(p_kind,p_id,h,p_prompt_version,'needs_admin');
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.needs_admin','gina.content_prereviews',p_kind||':'||p_id::text,jsonb_build_object('reason','retry_limit'));
  return jsonb_build_object('error','retry_limit','prereview_status','needs_admin');
 end if;
 insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,attempts,lease,claimed_at,updated_at)
 values(p_kind,p_id,h,p_prompt_version,1,p_lease,now(),now())
 on conflict(target_kind,target_id) do update set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',attempts=gina.content_prereviews.attempts+1,lease=p_lease,claimed_at=now(),updated_at=now()
 returning * into row;
 return jsonb_build_object('claimed',true,'content',src,'content_hash',h,'prompt_version',p_prompt_version,'attempts',row.attempts,
  'media_count',gina.content_prereview_media(p_kind,p_id));
end;$$;

-- 5. Servis finish: görsel bayrağı + duraklatılmış sağlayıcı denemesi sayılmaz ---------------------------
create or replace function public.content_prereview_finish(p_kind text,p_id uuid,p_lease uuid,p_status text,p_verdict jsonb,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row gina.content_prereviews;notified int:=0;media int;reviewed boolean;media_flag jsonb;begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in('pending','ai_approved','needs_admin','ai_rejected_suggestion') or (p_status<>'pending' and jsonb_typeof(p_verdict) is distinct from 'object') then raise exception 'prereview_status_invalid';end if;
 if p_status<>'pending' and not(p_verdict ?& array['decision_reason','confidence','findings']) then raise exception 'prereview_verdict_invalid';end if;
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id for update;
 if not found or row.lease is distinct from p_lease or row.prereview_status<>'pending' then raise exception 'lease_lost';end if;
 if p_status<>'pending' then
  media:=coalesce(gina.content_prereview_media(p_kind,p_id),0);
  reviewed:=coalesce(jsonb_typeof(p_verdict->'media')='object' and (p_verdict->'media'->>'reviewed')='true',false);
  -- C09 sözleşmesi (verdict'te media anahtarı) ile gelen onay görseli incelemeden verilemez.
  if p_status='ai_approved' and media>0 and not reviewed and p_verdict ? 'media' then raise exception 'prereview_media_unreviewed';end if;
  media_flag:=jsonb_build_object('count',media,'reviewed',reviewed,
   'image_dependent_correctness',case when media=0 then 'not_applicable' when reviewed then 'reviewed' else 'not_proven' end);
 end if;
 update gina.content_prereviews set prereview_status=p_status,
  prereview_verdict=case when p_status='pending' then prereview_verdict else p_verdict||jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version,'media',media_flag) end,
  prereview_at=case when p_status='pending' then prereview_at else now() end,
  -- Duraklatılmış sağlayıcı: çağrı yapılmadı, ücret yok; deneme hakkı geri verilir.
  attempts=case when p_status='pending' and p_error='ai_temporarily_unavailable' then greatest(attempts-1,0) else attempts end,
  last_error=left(p_error,160),lease=null,claimed_at=null,updated_at=now()
 where target_kind=p_kind and target_id=p_id returning * into row;
 if p_status in('needs_admin','ai_rejected_suggestion') then notified:=gina.content_prereview_notify(p_kind,p_id,row.content_hash,row.prompt_version,p_status);end if;
 if p_status<>'pending' then
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.'||p_status,'gina.content_prereviews',p_kind||':'||p_id::text,
   jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version,'confidence',p_verdict->'confidence','decision_reason',p_verdict->'decision_reason','notified',notified,
    'model',p_verdict->'model','provider',p_verdict->'provider','media',media_flag));
 end if;
 return jsonb_build_object('prereview_status',row.prereview_status,'attempts',row.attempts,'notified',notified);
end;$$;

-- 6. Sağlayıcı sağlığı (C08 devre kesicisi) — yalnız servis -----------------------------------------
create function public.content_prereview_provider(p_provider text,p_ok boolean default null,p_error text default null,p_uncertain boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_provider is null or not exists(select 1 from public.ai_providers where id=p_provider) then raise exception 'provider_unknown';end if;
 if p_error is not null and length(p_error)>160 then raise exception 'invalid_input';end if;
 if p_ok is not null then perform gina.ai_provider_outcome(p_provider,p_ok,p_error,coalesce(p_uncertain,false));end if;
 return jsonb_build_object('provider',p_provider,'paused',gina.ai_provider_paused(p_provider));
end;$$;
revoke all on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),
 public.content_prereview_provider(text,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),
 public.content_prereview_provider(text,boolean,text,boolean) to service_role;

-- 7. Zamanlanmış drain -----------------------------------------------------------------------------
-- Kapı kapalıysa, bekleyen kayıt yoksa veya Vault sırları (project_url, content_prereview_secret) yoksa
-- hiçbir istek atılmaz. Edge yine kendi kapısını, AI anahtarını ve devre kesiciyi denetler.
create function gina.kick_content_prereview() returns void
language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;begin
 if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return;end if;
 if not exists(select 1 from gina.content_prereviews where prereview_status='pending' and attempts<3 and (lease is null or claimed_at<now()-interval '3 minutes')) then return;end if;
 begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='content_prereview_secret';
  if v_url is null or v_secret is null then return;end if;
  perform net.http_post(url:=v_url||'/functions/v1/content-prereview',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
   body:=jsonb_build_object('drain',true,'limit',5));
 exception when others then raise notice 'content-prereview drain tetiklenemedi: %',sqlerrm;
 end;
end;$$;
revoke all on function gina.kick_content_prereview() from public,anon,authenticated;
do $$begin
 perform cron.schedule('content-prereview-drain','*/10 * * * *',$job$ select gina.kick_content_prereview() $job$);
exception when others then raise notice 'pg_cron yok; content-prereview-drain zamanlanmadı: %',sqlerrm;end;$$;
