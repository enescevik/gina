-- H07 — AI içerik ön incelemesi: aktivasyon öncesi işletim hazırlığı (E01/C09 üzerine).
--
-- Kapı (`content_prereview.enabled`) bu migration'la DEĞİŞMEZ; üretimde kapalı kalır.
--
-- 1. Ücretli çağrı defteri (gina.content_prereview_calls): sağlayıcıya gidebilecek her claim bir satırdır
--    (lease başına tek satır). Finish sonucu yazar; çağrı yapılmadığı kesin olan sonuçlar `not_called`.
--    "Aynı iş bir kez ücretlenir" bu defterden sayılır/kanıtlanır; bitmemiş (lease kaybolmuş) çağrı görünür olur.
-- 2. Günlük kota (`content_prereview.daily_call_limit`, varsayılan 25): son 24 saatte `not_called` dışındaki
--    defter satırları sınıra ulaştıysa claim yeni ücretli deneme vermez (`daily_limit`), kayıt `pending` kalır,
--    deneme hakkı harcanmaz. Ayar yok/bozuksa sınır 0 (kapalı kabul edilir). Tek kilitle yarışsız.
-- 3. Deneme hakkı tükenmiş (attempts>=3) ama `pending` kalmış kayıt (Edge 3. denemede çöktü) artık drain
--    tarafından alınır; claim onu ÜCRETSİZ olarak `needs_admin/retry_limit`'e taşır (C09 sınır 4 kapandı).
-- 4. Sağlık okuması (izleme): gina.content_prereview_health() (SQL editörü / servis) ve rol kapılı
--    public.admin_content_prereview_health() (tam yönetici + içerik operatörü). Kota, defter, kuyruk,
--    sağlayıcı duraklaması, pg_cron işi ve son drain isteklerinin HTTP durumu + uyarı kodları.
-- 5. Drain tetikleyicisi her gerçek isteği (ve eksik Vault sırrını) gina.content_prereview_kicks'e yazar;
--    böylece `verify_jwt` açık dağıtımda 401 veya yanlış sırda 403 izlemede görünür.
--
-- C07'nin yeniden kapıladığı admin_content_prereviews / request_content_prereview / enqueue_content_prereview
-- TANIMLANMAZ. Değişen gövdeler yalnız servis/iç fonksiyonlar: content_prereview_claim, content_prereview_finish,
-- content_prereview_next, gina.kick_content_prereview. Mevcut veriyi yeniden yazmaz; cron zamanlaması değişmez.

insert into public.app_settings(key,value) values('content_prereview.daily_call_limit','25') on conflict do nothing;

-- 1. Defter ------------------------------------------------------------------------------------------
create table gina.content_prereview_calls (
 id bigint generated always as identity primary key,
 -- Edge her claim için yeni UUID üretir; yine de tekil zorunlu değil: finish yalnız (kayıt, lease) açık satırını kapatır.
 lease uuid not null,
 target_kind text not null check(target_kind in('library_package','contribution_set','curriculum_candidate')),
 target_id uuid not null,
 content_hash text not null,
 prompt_version text not null,
 attempt int not null,
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 outcome text not null default 'claimed' check(outcome in('claimed','ai_approved','needs_admin','ai_rejected_suggestion','retry','not_called')),
 error text check(length(error)<=160)
);
create index content_prereview_calls_recent on gina.content_prereview_calls(claimed_at desc);
create index content_prereview_calls_target on gina.content_prereview_calls(target_kind,target_id,content_hash,prompt_version);
create index content_prereview_calls_open on gina.content_prereview_calls(lease) where outcome='claimed';
alter table gina.content_prereview_calls enable row level security;
revoke all on gina.content_prereview_calls from public,anon,authenticated,service_role;

create table gina.content_prereview_kicks (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 request_id bigint,
 note text check(length(note)<=80)
);
create index content_prereview_kicks_recent on gina.content_prereview_kicks(created_at desc);
alter table gina.content_prereview_kicks enable row level security;
revoke all on gina.content_prereview_kicks from public,anon,authenticated,service_role;

-- Günlük sınır: sayı değilse veya yoksa 0 (kapalı). Negatif → 0.
create function gina.content_prereview_daily_limit() returns int language sql stable security definer set search_path='' as $$
 select greatest(coalesce((select case when jsonb_typeof(value)='number' then floor((value#>>'{}')::numeric)::int end
  from public.app_settings where key='content_prereview.daily_call_limit'),0),0);
$$;
-- Son 24 saatte ücretli sayılan denemeler (çağrı yapılmadığı kesin olanlar hariç; bitmemişler dahil).
create function gina.content_prereview_calls_24h() returns int language sql stable security definer set search_path='' as $$
 select count(*)::int from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' and outcome<>'not_called';
$$;
-- Çağrı yapılmadan sonuçlanan hata nedenleri (yapılandırma, duraklama, sağlık okunamadı, eski kaynak).
create function gina.prereview_no_call(p_error text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_error='provider_health_unavailable' or gina.prereview_requeueable(p_error),false);
$$;
revoke all on function gina.content_prereview_daily_limit(),gina.content_prereview_calls_24h(),gina.prereview_no_call(text) from public,anon,authenticated,service_role;

-- 2. Claim: kota + defter; tükenmiş deneme ücretsiz needs_admin ------------------------------------------
create or replace function public.content_prereview_claim(p_kind text,p_id uuid,p_lease uuid,p_prompt_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare src jsonb;h text;row gina.content_prereviews;existed boolean;ctx jsonb;obsolete text;verdict jsonb;lim int;used int;begin
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
 -- H07: günlük kota. Tek küresel kilit: eşzamanlı claim'ler sınırı aşamaz. Durum değişmez, deneme harcanmaz.
 perform pg_advisory_xact_lock(hashtextextended('content_prereview:budget',91));
 lim:=gina.content_prereview_daily_limit();
 used:=gina.content_prereview_calls_24h();
 if used>=lim then return jsonb_build_object('error','daily_limit','limit',lim,'used',used);end if;
 insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,attempts,lease,claimed_at,updated_at)
 values(p_kind,p_id,h,p_prompt_version,1,p_lease,now(),now())
 on conflict(target_kind,target_id) do update set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',attempts=gina.content_prereviews.attempts+1,lease=p_lease,claimed_at=now(),updated_at=now()
 returning * into row;
 insert into gina.content_prereview_calls(lease,target_kind,target_id,content_hash,prompt_version,attempt) values(p_lease,p_kind,p_id,h,p_prompt_version,row.attempts);
 return jsonb_build_object('claimed',true,'content',src,'content_hash',h,'prompt_version',p_prompt_version,'attempts',row.attempts,
  'media_count',gina.content_prereview_media(p_kind,p_id));
end;$$;

-- 3. Finish: deftere sonuç; çağrı yapılmadıysa `not_called` ve deneme iadesi -----------------------------
create or replace function public.content_prereview_finish(p_kind text,p_id uuid,p_lease uuid,p_status text,p_verdict jsonb,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row gina.content_prereviews;notified int:=0;media int;reviewed boolean;media_flag jsonb;no_call boolean;begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if p_status is null or p_status not in('pending','ai_approved','needs_admin','ai_rejected_suggestion') or (p_status<>'pending' and jsonb_typeof(p_verdict) is distinct from 'object') then raise exception 'prereview_status_invalid';end if;
 if p_status<>'pending' and not(p_verdict ?& array['decision_reason','confidence','findings']) then raise exception 'prereview_verdict_invalid';end if;
 select * into row from gina.content_prereviews where target_kind=p_kind and target_id=p_id for update;
 if not found or row.lease is distinct from p_lease or row.prereview_status<>'pending' then raise exception 'lease_lost';end if;
 no_call:=gina.prereview_no_call(p_error) and p_status in('pending','needs_admin');
 if p_status<>'pending' then
  media:=coalesce(gina.content_prereview_media(p_kind,p_id),0);
  reviewed:=coalesce(jsonb_typeof(p_verdict->'media')='object' and (p_verdict->'media'->>'reviewed')='true',false);
  if p_status='ai_approved' and media>0 and not reviewed and p_verdict ? 'media' then raise exception 'prereview_media_unreviewed';end if;
  media_flag:=jsonb_build_object('count',media,'reviewed',reviewed,
   'image_dependent_correctness',case when media=0 then 'not_applicable' when reviewed then 'reviewed' else 'not_proven' end);
 end if;
 update gina.content_prereviews set prereview_status=p_status,
  prereview_verdict=case when p_status='pending' then prereview_verdict else p_verdict||jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version,'media',media_flag) end,
  prereview_at=case when p_status='pending' then prereview_at else now() end,
  -- Çağrı yapılmadı (duraklatılmış sağlayıcı / sağlık okunamadı): ücret yok, deneme hakkı geri verilir.
  attempts=case when p_status='pending' and no_call then greatest(attempts-1,0) else attempts end,
  last_error=left(p_error,160),lease=null,claimed_at=null,updated_at=now()
 where target_kind=p_kind and target_id=p_id returning * into row;
 update gina.content_prereview_calls set finished_at=now(),error=left(p_error,160),
  outcome=case when no_call then 'not_called' when p_status='pending' then 'retry' else p_status end
 where lease=p_lease and target_kind=p_kind and target_id=p_id and outcome='claimed';
 if p_status in('needs_admin','ai_rejected_suggestion') then notified:=gina.content_prereview_notify(p_kind,p_id,row.content_hash,row.prompt_version,p_status);end if;
 if p_status<>'pending' then
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(null,'content_prereview.'||p_status,'gina.content_prereviews',p_kind||':'||p_id::text,
   jsonb_build_object('content_hash',row.content_hash,'prompt_version',row.prompt_version,'confidence',p_verdict->'confidence','decision_reason',p_verdict->'decision_reason','notified',notified,
    'model',p_verdict->'model','provider',p_verdict->'provider','media',media_flag));
 end if;
 return jsonb_build_object('prereview_status',row.prereview_status,'attempts',row.attempts,'notified',notified);
end;$$;

-- 4. Next: tükenmiş denemeli bekleyenler de (claim onları ücretsiz yöneticiye taşır) ------------------------
create or replace function public.content_prereview_next(p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('kind',target_kind,'id',target_id)),'[]') from (
  select target_kind,target_id from gina.content_prereviews where prereview_status='pending' and (lease is null or claimed_at<now()-interval '3 minutes')
  order by (attempts>=3) desc,queued_at limit greatest(1,least(coalesce(p_limit,5),25)))r);
end;$$;
revoke all on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),public.content_prereview_next(int) from public,anon,authenticated;
grant execute on function public.content_prereview_claim(text,uuid,uuid,text),public.content_prereview_finish(text,uuid,uuid,text,jsonb,text),public.content_prereview_next(int) to service_role;

-- 5. Drain tetikleyicisi (her 10 dk, zamanlama C09'daki gibi): tur başına 3 kayıt (Edge duvar saati 150 sn içinde
--    kalsın diye; C09'da 5) ve pg_net istemci zaman aşımı 150 sn (varsayılan 5 sn yanıtı izlemeye düşürmüyordu).
--    Kota doluysa ve taşınacak tükenmiş kayıt yoksa istek yok; istekler kaydedilir --------
create or replace function gina.kick_content_prereview() returns void
language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;v_request bigint;budget boolean;begin
 if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return;end if;
 budget:=gina.content_prereview_calls_24h()<gina.content_prereview_daily_limit();
 if not exists(select 1 from gina.content_prereviews where prereview_status='pending' and (lease is null or claimed_at<now()-interval '3 minutes')
   and (attempts>=3 or budget)) then return;end if;
 delete from gina.content_prereview_kicks where created_at<now()-interval '14 days';
 begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='content_prereview_secret';
 exception when others then v_url:=null;v_secret:=null;
 end;
 if v_url is null or v_secret is null then
  insert into gina.content_prereview_kicks(note) values('vault_secret_missing');return;
 end if;
 begin
  select net.http_post(url:=v_url||'/functions/v1/content-prereview',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',v_secret),
   body:=jsonb_build_object('drain',true,'limit',3),timeout_milliseconds:=150000) into v_request;
  insert into gina.content_prereview_kicks(request_id,note) values(v_request,'posted');
 exception when others then
  insert into gina.content_prereview_kicks(note) values(left('post_failed: '||sqlerrm,80));
 end;
end;$$;
revoke all on function gina.kick_content_prereview() from public,anon,authenticated;

-- 6. Sağlık ------------------------------------------------------------------------------------------
create function gina.content_prereview_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare enabled boolean;ai_on boolean;lim int;used int;unfinished int;stuck int;queue jsonb;cronj jsonb:=null;runs jsonb:='[]';kicks jsonb:='[]';
 providers jsonb;alerts text[]:='{}';bad_http int:=0;missing int:=0;begin
 enabled:=exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true');
 ai_on:=coalesce((select value<>'false'::jsonb from public.app_settings where key='ai.enabled'),true);
 lim:=gina.content_prereview_daily_limit();used:=gina.content_prereview_calls_24h();
 select count(*) into unfinished from gina.content_prereview_calls where outcome='claimed' and claimed_at<now()-interval '3 minutes';
 select count(*) into stuck from gina.content_prereviews where prereview_status='pending' and attempts>=3;
 select jsonb_build_object(
  'pending_ready',count(*) filter(where prereview_status='pending' and attempts<3 and (lease is null or claimed_at<now()-interval '3 minutes')),
  'pending_leased',count(*) filter(where prereview_status='pending' and lease is not null and claimed_at>=now()-interval '3 minutes'),
  'pending_retry_exhausted',count(*) filter(where prereview_status='pending' and attempts>=3),
  'needs_admin',count(*) filter(where prereview_status='needs_admin'),
  'ai_approved',count(*) filter(where prereview_status='ai_approved'),
  'ai_rejected_suggestion',count(*) filter(where prereview_status='ai_rejected_suggestion'),
  'oldest_pending_at',min(queued_at) filter(where prereview_status='pending')) into queue from gina.content_prereviews;
 select coalesce(jsonb_agg(jsonb_build_object('provider',p.id,'paused',gina.ai_provider_paused(p.id)) order by p.id),'[]') into providers from public.ai_providers p;
 begin
  select jsonb_build_object('jobid',j.jobid,'schedule',j.schedule,'active',j.active) into cronj from cron.job j where j.jobname='content-prereview-drain';
  select coalesce(jsonb_agg(x),'[]') into runs from (select jsonb_build_object('status',d.status,'start_time',d.start_time,'message',left(d.return_message,120)) x
   from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='content-prereview-drain' order by d.start_time desc limit 5) s;
 exception when others then cronj:=coalesce(cronj,jsonb_build_object('error','pg_cron_unavailable'));
 end;
 begin
  select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') into kicks from (
   select jsonb_build_object('created_at',k.created_at,'note',k.note,'http_status',r.status_code,'timed_out',r.timed_out,'error',left(r.error_msg,120)) x
   from gina.content_prereview_kicks k left join net._http_response r on r.id=k.request_id order by k.created_at desc limit 10) s;
 exception when others then
  select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') into kicks from (
   select jsonb_build_object('created_at',k.created_at,'note',k.note,'http_status',null) x from gina.content_prereview_kicks k order by k.created_at desc limit 10) s;
 end;
 select count(*) filter(where (x->>'http_status')::int not between 200 and 299),count(*) filter(where x->>'note'='vault_secret_missing')
  into bad_http,missing from jsonb_array_elements(kicks) x where (x->>'created_at')::timestamptz>now()-interval '24 hours';
 if enabled and (cronj is null or cronj ? 'error' or (cronj->>'active')<>'true') then alerts:=array_append(alerts,'drain_not_scheduled');end if;
 if enabled and not ai_on then alerts:=array_append(alerts,'ai_disabled');end if;
 if enabled and lim=0 then alerts:=array_append(alerts,'daily_limit_zero');end if;
 if lim>0 and used>=lim then alerts:=array_append(alerts,'daily_limit_reached');end if;
 if unfinished>0 then alerts:=array_append(alerts,'unfinished_calls');end if;
 if stuck>0 then alerts:=array_append(alerts,'retry_exhausted_pending');end if;
 if bad_http>0 then alerts:=array_append(alerts,'drain_http_error');end if;
 if exists(select 1 from jsonb_array_elements(kicks) x where (x->>'timed_out')='true' and (x->>'created_at')::timestamptz>now()-interval '24 hours') then alerts:=array_append(alerts,'drain_http_timeout');end if;
 if missing>0 then alerts:=array_append(alerts,'vault_secret_missing');end if;
 if exists(select 1 from jsonb_array_elements(providers) p where (p->>'paused')='true') then alerts:=array_append(alerts,'provider_paused');end if;
 if enabled and (queue->>'oldest_pending_at')::timestamptz<now()-interval '1 hour' then alerts:=array_append(alerts,'queue_stalled');end if;
 return jsonb_build_object('enabled',enabled,'ai_enabled',ai_on,'daily_call_limit',lim,'calls_24h',used,'remaining_24h',greatest(lim-used,0),
  'calls_by_outcome_24h',(select coalesce(jsonb_object_agg(outcome,n),'{}') from (select outcome,count(*) n from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' group by outcome) o),
  'top_errors_24h',(select coalesce(jsonb_agg(jsonb_build_object('error',error,'count',n) order by n desc),'[]') from (
    select error,count(*) n from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' and error is not null group by error order by count(*) desc limit 5) e),
  'unfinished_calls',unfinished,'queue',queue,'providers',providers,'cron',cronj,'cron_runs',runs,'kicks',kicks,'alerts',to_jsonb(alerts));
end;$$;
revoke all on function gina.content_prereview_health() from public,anon,authenticated,service_role;

-- Backoffice: tam yönetici + içerik operatörü (C07 matrisinde AI ön inceleme kuyruğunu görenler).
create function public.admin_content_prereview_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_operation_role(array['content']);
 return gina.content_prereview_health();
end;$$;
revoke all on function public.admin_content_prereview_health() from public,anon,service_role;
grant execute on function public.admin_content_prereview_health() to authenticated;
