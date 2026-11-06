-- Admin-only pre-review daily-cap exemption. Disabled until explicitly activated.
-- Customer plan quotas, retry limits, provider budgets and kill switches are unchanged.
insert into public.app_settings(key,value) values ('content_prereview.admin_daily_limit_exempt','false') on conflict do nothing;
alter table gina.content_prereview_calls add column requested_by uuid;
update gina.content_prereview_calls c set requested_by=p.requested_by from gina.content_prereviews p
 where c.target_kind=p.target_kind and c.target_id=p.target_id;
create function gina.content_prereview_admin_exempt(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_settings where key='content_prereview.admin_daily_limit_exempt' and value='true'::jsonb)
 and exists(select 1 from public.admins where user_id=p_user);
$$;
create function gina.content_prereview_budget_calls_24h() returns int
language sql stable security definer set search_path='' as $$
 select count(*)::int from gina.content_prereview_calls
 where claimed_at>now()-interval '24 hours' and outcome<>'not_called'
 and not gina.content_prereview_admin_exempt(requested_by);
$$;
revoke all on function gina.content_prereview_admin_exempt(uuid),gina.content_prereview_budget_calls_24h() from public,anon,authenticated,service_role;

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
 used:=gina.content_prereview_budget_calls_24h();
 if used>=lim and not gina.content_prereview_admin_exempt(row.requested_by) then return jsonb_build_object('error','daily_limit','limit',lim,'used',used);end if;
 insert into gina.content_prereviews(target_kind,target_id,content_hash,prompt_version,attempts,lease,claimed_at,updated_at)
 values(p_kind,p_id,h,p_prompt_version,1,p_lease,now(),now())
 on conflict(target_kind,target_id) do update set content_hash=h,prompt_version=p_prompt_version,prereview_status='pending',attempts=gina.content_prereviews.attempts+1,lease=p_lease,claimed_at=now(),updated_at=now()
 returning * into row;
 insert into gina.content_prereview_calls(lease,target_kind,target_id,content_hash,prompt_version,attempt,requested_by) values(p_lease,p_kind,p_id,h,p_prompt_version,row.attempts,row.requested_by);
 return jsonb_build_object('claimed',true,'content',src,'content_hash',h,'prompt_version',p_prompt_version,'attempts',row.attempts,
  'media_count',gina.content_prereview_media(p_kind,p_id));
end;$$;

create or replace function public.content_prereview_next(p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('kind',target_kind,'id',target_id)),'[]') from (
  select target_kind,target_id from gina.content_prereviews where prereview_status='pending' and (lease is null or claimed_at<now()-interval '3 minutes')
  and (attempts>=3 or gina.content_prereview_budget_calls_24h()<gina.content_prereview_daily_limit() or gina.content_prereview_admin_exempt(requested_by))
  order by (attempts>=3) desc,queued_at limit greatest(1,least(coalesce(p_limit,5),25)))r);
end;$$;
create or replace function gina.kick_content_prereview() returns void
language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;v_request bigint;budget boolean;begin
 if not exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true') then return;end if;
 budget:=gina.content_prereview_budget_calls_24h()<gina.content_prereview_daily_limit();
 if not exists(select 1 from gina.content_prereviews where prereview_status='pending' and (lease is null or claimed_at<now()-interval '3 minutes')
   and (attempts>=3 or budget or gina.content_prereview_admin_exempt(requested_by))) then return;end if;
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

create or replace function gina.content_prereview_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare enabled boolean;ai_on boolean;lim int;used int;unfinished int;stuck int;queue jsonb;cronj jsonb:=null;runs jsonb:='[]';kicks jsonb:='[]';
 providers jsonb;alerts text[]:='{}';bad_http int:=0;missing int:=0;begin
 enabled:=exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true');
 ai_on:=coalesce((select value<>'false'::jsonb from public.app_settings where key='ai.enabled'),true);
 lim:=gina.content_prereview_daily_limit();used:=gina.content_prereview_budget_calls_24h();
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
 return jsonb_build_object('enabled',enabled,'ai_enabled',ai_on,'daily_call_limit',lim,'calls_24h',gina.content_prereview_calls_24h(),'budget_calls_24h',used,
  'admin_daily_limit_exempt',exists(select 1 from public.app_settings where key='content_prereview.admin_daily_limit_exempt' and value='true'::jsonb),'remaining_24h',greatest(lim-used,0),
  'calls_by_outcome_24h',(select coalesce(jsonb_object_agg(outcome,n),'{}') from (select outcome,count(*) n from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' group by outcome) o),
  'top_errors_24h',(select coalesce(jsonb_agg(jsonb_build_object('error',error,'count',n) order by n desc),'[]') from (
    select error,count(*) n from gina.content_prereview_calls where claimed_at>now()-interval '24 hours' and error is not null group by error order by count(*) desc limit 5) e),
  'unfinished_calls',unfinished,'queue',queue,'providers',providers,'cron',cronj,'cron_runs',runs,'kicks',kicks,'alerts',to_jsonb(alerts));
end;$$;
revoke all on function gina.content_prereview_health() from public,anon,authenticated,service_role;
