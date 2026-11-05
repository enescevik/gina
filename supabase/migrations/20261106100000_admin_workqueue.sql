-- B01: yönetici iş kuyruğu, aile arama (keyset), aile hak zaman çizgisi, override önizleme/uygulama.
-- Yetki her çağrıda canlı tablolardan okunur: admins satırı silinen veya operations_members
-- süresi dolan/iptal edilen kullanıcı, JWT süresi bitmeden 'forbidden' alır. Mevcut
-- admin_save_override / admin_grant_override / admin_expire_override yeniden yazılmaz, sarmalanır.
-- Backoffice sayfaları bu dalda bağlanmadı; mevcut admin_search_families(text,int) korunur.

-- Arama indeksleri -------------------------------------------------------------------
-- pg_trgm hem yerel şablonda hem Supabase'de mevcut (1.6). auth.users üzerinde indeks
-- oluşturulmaz (tablo postgres rolüne ait değil); e-posta parçası düz ilike ile aranır ve
-- yalnız eşleşme işareti döner, adres dönmez.
create extension if not exists pg_trgm with schema extensions;
create index if not exists families_name_trgm_idx on public.families using gin (name extensions.gin_trgm_ops);
create index if not exists children_name_trgm_idx on public.children using gin (name extensions.gin_trgm_ops);
create index if not exists families_created_id_idx on public.families (created_at desc, id desc);
create index if not exists star_events_family_created_idx on public.star_events (family_id, created_at desc);
create index if not exists entitlement_overrides_family_created_idx on public.entitlement_overrides (family_id, created_at desc);
create index if not exists store_notifications_store_key_idx on public.store_notifications (platform, store_key, received_at desc) where store_key is not null;

-- Çağıranın canlı rolleri ---------------------------------------------------------------
-- 'admin' yalnız gina.is_admin_strict(); diğerleri operations_members (süresi dolmamış,
-- iptal edilmemiş). Tam yönetici dört operasyon rolünü de taşır.
create function gina.caller_operation_roles() returns text[]
language sql stable security definer set search_path='' as $$
 select case
  when auth.uid() is null or coalesce(gina.role(),'none')='device' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then '{}'::text[]
  when coalesce(gina.is_admin_strict(),false) then array['admin','support','content','finance','release']
  else coalesce((select array_agg(distinct role order by role) from public.operations_members
    where user_id=auth.uid() and revoked_at is null and expires_at>now()),'{}'::text[])
 end;
$$;
revoke all on function gina.caller_operation_roles() from public,anon;
grant execute on function gina.caller_operation_roles() to authenticated,service_role;

create function gina.workqueue_item(p_role text,p_queue text,p_key text,p_count bigint,p_oldest timestamptz,p_reason text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('role',p_role,'queue',p_queue,'key',p_key,'count',coalesce(p_count,0),
  'oldest_since',p_oldest,'oldest_waiting_seconds',case when p_oldest is null then null else greatest(0,extract(epoch from now()-p_oldest))::bigint end,
  'reason',p_reason);
$$;
revoke all on function gina.workqueue_item(text,text,text,bigint,timestamptz,text) from public,anon,authenticated;

-- 1. İş kuyruğu --------------------------------------------------------------------------
-- Her kalem: role, queue, key, count, oldest_since, oldest_waiting_seconds, reason.
-- Yalnız çağıranın rolleri; p_role verilirse o rol (çağıran taşımıyorsa forbidden).
create function public.admin_workqueue(p_role text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare roles text[]:=gina.caller_operation_roles(); items jsonb:='[]'::jsonb; sla interval:=interval '24 hours';
begin
 if cardinality(roles)=0 then raise exception 'forbidden' using errcode='42501';end if;
 if p_role is not null then
  if p_role not in('admin','support','content','finance','release') then raise exception 'invalid_input' using errcode='22023';end if;
  if not (p_role=any(roles)) then raise exception 'forbidden' using errcode='42501';end if;
  roles:=array[p_role];
 end if;

 if 'support'=any(roles) then
  items:=items
   || (select gina.workqueue_item('support','support','tickets_open',count(*),min(updated_at),'parent_waiting')
       from public.help_tickets where kind='support' and status='open')
   || (select gina.workqueue_item('support','support','tickets_unassigned',count(*),min(t.created_at),'no_operator_reply')
       from public.help_tickets t where t.kind='support' and t.status in('open','in_progress')
        and not exists(select 1 from public.help_messages m where m.ticket_id=t.id and m.author_role='support'))
   || (select gina.workqueue_item('support','support','tickets_sla_breached',count(*),min(updated_at),'waiting_over_24h')
       from public.help_tickets where kind='support' and status='open' and updated_at<now()-sla)
   || (select gina.workqueue_item('support','support','ideas_open',count(*),min(updated_at),'idea_untriaged')
       from public.help_tickets where kind='idea' and status='open');
 end if;

 if 'content'=any(roles) then
  items:=items
   || (select gina.workqueue_item('content','review','library_drafts',count(*),min(p.created_at),'awaiting_editorial_review')
       from gina.library_import_packages p
       where not exists(select 1 from gina.library_publications l where l.package_id=p.id)
        and not exists(select 1 from gina.library_import_packages n where n.previous_id=p.id))
   || (select gina.workqueue_item('content','review','contributions_pending',
        (select count(*) from public.question_contributions where status='pending')+(select count(*) from gina.contribution_sets where status='pending'),
        least((select min(created_at) from public.question_contributions where status='pending'),(select min(created_at) from gina.contribution_sets where status='pending')),
        'awaiting_review'))
   || (select gina.workqueue_item('content','review','prereview_needs_admin',count(*),min(coalesce(prereview_at,updated_at)),'ai_prereview_needs_admin')
       from gina.content_prereviews where prereview_status in('needs_admin','ai_rejected_suggestion'))
   || (select gina.workqueue_item('content','review','scenario_revisions',count(*),min(created_at),'scenario_revision_pending')
       from gina.curriculum_candidates where status='draft')
   || (select gina.workqueue_item('content','review','scenario_ready_to_publish',count(*),min(reviewed_at),'scenario_reviewed_not_published')
       from gina.curriculum_candidates where status='reviewed')
   || (select gina.workqueue_item('content','school','education_calendar_drafts',count(*),min(updated_at),'calendar_unpublished_revision')
       from gina.education_calendars where published is null or published_revision is distinct from revision);
 end if;

 if 'finance'=any(roles) then
  items:=items
   || (select gina.workqueue_item('finance','billing','store_notifications_attention',count(*),min(received_at),'store_event_unprocessed_or_failed')
       from public.store_notifications where (processed_at is null or error is not null) and coalesce(lease_until,'-infinity')<=now())
   || (select gina.workqueue_item('finance','billing','reconcile_jobs_failed',count(*),min(created_at),'manual_store_check_failed')
       from gina.store_reconcile_jobs where status='failed')
   || (select gina.workqueue_item('finance','billing','subscriptions_billing_retry',count(*),min(updated_at),'grace_or_on_hold')
       from public.store_subscriptions where status in('grace','on_hold') and expires_at>now()-interval '30 days')
   || (select gina.workqueue_item('finance','billing','overrides_expiring_7d',count(*),min(ends_at),'comp_ends_within_7_days')
       from public.entitlement_overrides where revoked_at is null and starts_at<=now() and ends_at>now() and ends_at<now()+interval '7 days');
 end if;

 if 'release'=any(roles) then
  items:=items
   || (select gina.workqueue_item('release','release','push_attention',count(*),min(created_at),'push_failed_or_unconfigured')
       from public.push_outbox where status in('failed','skipped_unconfigured') and created_at>now()-interval '30 days')
   || (select gina.workqueue_item('release','release','announcements_draft',count(*),min(created_at),'announcement_unpublished')
       from gina.parent_announcements where status='draft');
 end if;

 if 'admin'=any(roles) then
  -- S06 admin_ai_failed_operations ile aynı tanım: failed/uncertain + 3 dk'dan eski working.
  items:=items
   || (select gina.workqueue_item('admin','ai','ai_failed_operations',count(*),min(j.created_at),'ai_failed_or_uncertain')
       from (select created_at from public.ai_operation_jobs where status in('failed','uncertain')
             union all select created_at from public.prova_generation_jobs where status in('failed','uncertain')) j)
   || (select gina.workqueue_item('admin','ai','ai_stale_working',count(*),min(j.created_at),'working_over_3_minutes')
       from (select created_at from public.ai_operation_jobs where status='working' and updated_at<now()-interval '3 minutes'
             union all select created_at from public.prova_generation_jobs where status='working' and updated_at<now()-interval '3 minutes') j);
 end if;

 return jsonb_build_object('as_of',now(),'roles',to_jsonb(roles),'items',items);
end;$$;
revoke all on function public.admin_workqueue(text) from public,anon;
grant execute on function public.admin_workqueue(text) to authenticated;

-- 2. Aile arama (keyset) ------------------------------------------------------------------
-- Rol: admin, support veya finance. Ad/çocuk adı/e-posta parçası/aile kimliği/davet kodu.
-- Cursor: '<created_at>|<id>' (son satırdan); ilk 100 sınırı yok, limit 1..200.
-- E-posta ve çocuk adları dönmez; yalnız 'matched_on' işaretleri döner.
create function public.admin_families_search(p_query text default null,p_cursor text default null,p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare roles text[]:=gina.caller_operation_roles(); q text:=nullif(trim(coalesce(p_query,'')),''); pat text;
 lim int:=least(greatest(coalesce(p_limit,50),1),200); c_ts timestamptz; c_id uuid; rows jsonb; total int;
begin
 if not (roles && array['admin','support','finance']) then raise exception 'forbidden' using errcode='42501';end if;
 if length(coalesce(q,''))>120 then raise exception 'invalid_input' using errcode='22023';end if;
 if p_cursor is not null then
  begin
   c_ts:=split_part(p_cursor,'|',1)::timestamptz; c_id:=split_part(p_cursor,'|',2)::uuid;
  exception when others then raise exception 'cursor_invalid' using errcode='22023';
  end;
 end if;
 pat:=case when q is null then null else '%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%' end;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'),count(*) into rows,total from (
  select f.id,f.name,f.created_at,f.timezone,
   (select count(*)::int from public.family_members m where m.family_id=f.id) member_count,
   (select count(*)::int from public.children c where c.family_id=f.id and c.archived_at is null) child_count,
   (select count(*)::int from public.children c where c.family_id=f.id and c.archived_at is not null) archived_child_count,
   (select count(*)::int from public.devices d where d.family_id=f.id and d.revoked_at is null) device_count,
   e.plan,e.source plan_source,e.expires_at plan_expires_at,
   (select s.status::text from public.store_subscriptions s where s.family_id=f.id order by s.updated_at desc,s.id limit 1) store_status,
   (select count(*)::int from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is null and o.ends_at>now()) active_override_count,
   greatest(f.created_at,
    (select max(se.created_at) from public.star_events se where se.family_id=f.id),
    (select max(tc.completed_at) from public.task_completions tc where tc.family_id=f.id),
    (select max(t.updated_at) from public.help_tickets t where t.family_id=f.id),
    (select max(s.updated_at) from public.store_subscriptions s where s.family_id=f.id),
    (select max(d.last_seen_at) from public.devices d where d.family_id=f.id)) last_activity_at,
   case when q is null then '[]'::jsonb else (select coalesce(jsonb_agg(k),'[]') from (
     select 'id' k where f.id::text=q
     union all select 'invite_code' where f.invite_code=upper(q)
     union all select 'name' where f.name ilike pat
     union all select 'child_name' where exists(select 1 from public.children c where c.family_id=f.id and c.name ilike pat)
     union all select 'email' where length(q)>=3 and exists(select 1 from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id and u.email ilike pat)
    ) m) end matched_on
  from public.families f cross join lateral gina.effective_entitlement(f.id) e
  where (q is null or f.id::text=q or f.invite_code=upper(q) or f.name ilike pat
    or exists(select 1 from public.children c where c.family_id=f.id and c.name ilike pat)
    or (length(q)>=3 and exists(select 1 from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id and u.email ilike pat)))
   and (c_ts is null or (f.created_at,f.id)<(c_ts,c_id))
  order by f.created_at desc,f.id desc limit lim+1
 ) r;
 return jsonb_build_object('as_of',now(),'query',q,'limit',lim,'has_more',total>lim,
  'rows',case when total>lim then rows-(lim) else rows end,
  'next_cursor',case when total>lim then (rows->(lim-1)->>'created_at')||'|'||(rows->(lim-1)->>'id') else null end);
end;$$;
revoke all on function public.admin_families_search(text,text,int) from public,anon;
grant execute on function public.admin_families_search(text,text,int) to authenticated;

-- 3. Aile hak zaman çizgisi ------------------------------------------------------------------
-- Rol: admin veya finance. Sabit aile bağlamı; türler ayrı: store_purchase/store_renewal/
-- store_cancel/store_refund/store_revoke/store_expired/store_grace/store_on_hold/store_paused/
-- store_renewal_resumed/store_refund_declined/store_refund_reversed/store_other (mağaza olayı),
-- store_subscription (abonelik kaydı), comp_granted/comp_revoked/comp_expired (operatör telafisi),
-- store_check_requested (elle doğrulama; iade değildir). Cursor: '<occurred_at>|<kind>|<id>'.
create function gina.store_event_kind(p_platform public.store_platform,p_event_type text) returns text
language sql immutable set search_path='' as $$
 select case
  when p_event_type is null then 'store_other'
  when p_platform='apple' then case
   when p_event_type like 'REFUND_DECLINED%' then 'store_refund_declined'
   when p_event_type like 'REFUND_REVERSED%' then 'store_refund_reversed'
   when p_event_type like 'REFUND%' then 'store_refund'
   when p_event_type like 'REVOKE%' then 'store_revoke'
   when p_event_type like 'GRACE_PERIOD_EXPIRED%' or p_event_type like 'EXPIRED%' then 'store_expired'
   when p_event_type like 'DID_RENEW%' then 'store_renewal'
   when p_event_type like 'SUBSCRIBED%' or p_event_type like 'OFFER_REDEEMED%' then 'store_purchase'
   when p_event_type like 'DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED%' then 'store_cancel'
   when p_event_type like 'DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_ENABLED%' then 'store_renewal_resumed'
   when p_event_type like 'DID_FAIL_TO_RENEW:GRACE_PERIOD%' then 'store_grace'
   when p_event_type like 'DID_FAIL_TO_RENEW%' then 'store_on_hold'
   when p_event_type like 'DID_CHANGE_RENEWAL_PREF%' then 'store_plan_change'
   else 'store_other' end
  else case
   when p_event_type like 'voided%' then 'store_refund'
   when p_event_type in('subscription:1','subscription:2') then 'store_renewal'
   when p_event_type='subscription:3' then 'store_cancel'
   when p_event_type='subscription:4' then 'store_purchase'
   when p_event_type='subscription:5' then 'store_on_hold'
   when p_event_type='subscription:6' then 'store_grace'
   when p_event_type='subscription:7' then 'store_renewal_resumed'
   when p_event_type='subscription:10' then 'store_paused'
   when p_event_type='subscription:12' then 'store_revoke'
   when p_event_type='subscription:13' then 'store_expired'
   else 'store_other' end
  end;
$$;
revoke all on function gina.store_event_kind(public.store_platform,text) from public,anon,authenticated;

create function public.admin_family_entitlement_timeline(p_family_id uuid,p_cursor text default null,p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare roles text[]:=gina.caller_operation_roles(); f public.families; eff record;
 lim int:=least(greatest(coalesce(p_limit,50),1),200); c_ts timestamptz; c_kind text; c_id text; rows jsonb; total int;
begin
 if not (roles && array['admin','finance']) then raise exception 'forbidden' using errcode='42501';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'family_not_found' using errcode='P0001';end if;
 if p_cursor is not null then
  begin
   c_ts:=split_part(p_cursor,'|',1)::timestamptz; c_kind:=split_part(p_cursor,'|',2); c_id:=split_part(p_cursor,'|',3);
   if c_kind='' or c_id='' then raise exception 'cursor_invalid';end if;
  exception when others then raise exception 'cursor_invalid' using errcode='22023';
  end;
 end if;
 select * into eff from gina.effective_entitlement(f.id);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at desc,r.kind desc,r.id desc),'[]'),count(*) into rows,total from (
  select * from (
   select s.created_at occurred_at,'store_subscription'::text kind,s.id::text id,'store'::text family_of,
    jsonb_build_object('subscription_id',s.id,'platform',s.platform,'product_id',s.product_id,'plan',s.plan,'status',s.status,
     'expires_at',s.expires_at,'auto_renewing',s.auto_renewing,'updated_at',s.updated_at) data
   from public.store_subscriptions s where s.family_id=f.id
   union all
   select n.received_at,gina.store_event_kind(n.platform,n.event_type),n.id::text,'store',
    jsonb_build_object('subscription_id',s.id,'platform',n.platform,'plan',s.plan,'event_type',n.event_type,
     'processed',(n.processed_at is not null and n.error is null),
     'error_code',case when n.error is null then null when n.error in('family_not_found','store_not_configured','pending','invalid_jws','processing_failed') then n.error else 'processing_failed' end)
   from public.store_notifications n join public.store_subscriptions s on s.store_key=n.store_key and s.platform=n.platform
   where s.family_id=f.id
   union all
   select o.created_at,'comp_granted',o.id::text,'operator',
    jsonb_build_object('override_id',o.id,'plan',o.plan,'starts_at',o.starts_at,'ends_at',o.ends_at,'reason',o.reason,'granted_by',o.granted_by)
   from public.entitlement_overrides o where o.family_id=f.id
   union all
   select o.revoked_at,'comp_revoked',o.id::text,'operator',
    jsonb_build_object('override_id',o.id,'plan',o.plan,'ends_at',o.ends_at,
     'reason',(select a.reason from public.audit_log a where a.action='entitlement_overrides.expire' and a.target_id=o.id::text order by a.created_at desc limit 1))
   from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is not null
   union all
   select o.ends_at,'comp_expired',o.id::text,'operator',jsonb_build_object('override_id',o.id,'plan',o.plan)
   from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is null and o.ends_at<=now()
   union all
   select j.created_at,'store_check_requested',j.id::text,'operator',
    jsonb_build_object('job_id',j.id,'subscription_id',j.subscription_id,'status',j.status,'code',j.code,'completed_at',j.completed_at,'is_refund',false,'reason',j.reason)
   from gina.store_reconcile_jobs j where j.family_id=f.id
  ) ev
  where c_ts is null or (ev.occurred_at,ev.kind,ev.id)<(c_ts,c_kind,c_id)
  order by ev.occurred_at desc,ev.kind desc,ev.id desc limit lim+1
 ) r;
 return jsonb_build_object('as_of',now(),
  'family',jsonb_build_object('id',f.id,'name',f.name,'timezone',f.timezone,'created_at',f.created_at,
   'effective',jsonb_build_object('plan',eff.plan,'source',eff.source,'expires_at',eff.expires_at)),
  'limit',lim,'has_more',total>lim,
  'events',case when total>lim then rows-(lim) else rows end,
  'next_cursor',case when total>lim then (rows->(lim-1)->>'occurred_at')||'|'||(rows->(lim-1)->>'kind')||'|'||(rows->(lim-1)->>'id') else null end);
end;$$;
revoke all on function public.admin_family_entitlement_timeline(uuid,text,int) from public,anon;
grant execute on function public.admin_family_entitlement_timeline(uuid,text,int) to authenticated;

-- 4. Override önizleme ve idempotent uygulama ------------------------------------------------
-- Yalnız tam yönetici. Önizleme hiçbir şey yazmaz; aile adı/üye/çocuk sayısı yanlış aileyi
-- görünür kılar. 'after' efektif hakkı mevcut adaylar + varsayımsal telafi ile hesaplar.
create function public.admin_override_preview(p_family_id uuid,p_plan public.plan_code,p_until timestamptz,p_reason text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f public.families; before_e record; after_e record; before_p public.plans; after_p public.plans;
 blockers text[]:='{}'; conflicts jsonb; changes jsonb; presets jsonb; reason_ok boolean;
begin
 perform gina.assert_admin();
 if p_family_id is null or p_plan is null then raise exception 'invalid_input' using errcode='22023';end if;
 select * into f from public.families where id=p_family_id;
 if f.id is null then raise exception 'family_not_found' using errcode='P0001';end if;
 reason_ok:=length(trim(coalesce(p_reason,''))) between 3 and 1000;
 if p_plan='free' then blockers:=array_append(blockers,'override_plan_free');end if;
 if not reason_ok then blockers:=array_append(blockers,'override_reason_required');end if;
 if p_until is null or not isfinite(p_until) or p_until<=now() then blockers:=array_append(blockers,'override_ends_at_invalid');
 elsif p_until>now()+interval '2 years' then blockers:=array_append(blockers,'override_too_long');end if;

 select * into before_e from gina.effective_entitlement(f.id);
 select * into after_e from (
  with candidates as (
   select s.plan,'beta'::text source,a.expires_at,100 priority
   from public.beta_plan_selections s
   join public.beta_test_access a on a.user_id=s.selected_by and a.family_id=s.family_id
   join public.family_members m on m.user_id=a.user_id and m.family_id=a.family_id and m.role='parent'
   where s.family_id=f.id and a.expires_at>now()
   union all
   select s.plan,'store',s.expires_at,gina.plan_rank(s.plan)
   from public.store_subscriptions s where s.family_id=f.id and s.status in('active','grace') and s.expires_at>now()
   union all
   select o.plan,'comp',o.ends_at,gina.plan_rank(o.plan)
   from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is null and o.starts_at<=now() and o.ends_at>now()
   union all
   select p_plan,'comp',p_until,gina.plan_rank(p_plan) where p_plan<>'free' and p_until>now()
   union all select 'free'::public.plan_code,'free',null,-1
  ) select plan,source,expires_at from candidates order by priority desc,expires_at desc nulls last limit 1
 ) x;
 -- Girdi geçersizken 'plan_not_above_current' eklenmez; önce girdi hatası gösterilir.
 if cardinality(blockers)=0 and after_e.plan=before_e.plan and after_e.source is not distinct from before_e.source and after_e.expires_at is not distinct from before_e.expires_at then
  blockers:=array_append(blockers,'plan_not_above_current');
 end if;
 select * into before_p from public.plans where code=before_e.plan;
 select * into after_p from public.plans where code=after_e.plan;
 changes:=(select coalesce(jsonb_agg(jsonb_build_object('limit',k,'before',b,'after',a,
   'direction',case when b is not distinct from a then 'same'
    when k='ai_weekly' then case when a='true' then 'opens' else 'closes' end
    when a is null then 'opens' when b is null then 'closes'
    when a::numeric>b::numeric then 'opens' else 'closes' end)),'[]')
  from (values
   ('max_children',before_p.max_children::text,after_p.max_children::text),
   ('max_devices',before_p.max_devices::text,after_p.max_devices::text),
   ('max_active_tasks_per_child',before_p.max_active_tasks_per_child::text,after_p.max_active_tasks_per_child::text),
   ('max_notes',before_p.max_notes::text,after_p.max_notes::text),
   ('history_days',before_p.history_days::text,after_p.history_days::text),
   ('ai_weekly',before_p.ai_weekly::text,after_p.ai_weekly::text)) v(k,b,a));
 conflicts:=(select coalesce(jsonb_agg(jsonb_build_object('override_id',o.id,'plan',o.plan,'starts_at',o.starts_at,'ends_at',o.ends_at,'reason',o.reason,
   'relation',case when o.starts_at>now() then 'scheduled'
    when gina.plan_rank(o.plan)>gina.plan_rank(p_plan) then 'higher_plan_active'
    when o.plan=p_plan and o.ends_at>=coalesce(p_until,o.ends_at) then 'same_plan_covers_request'
    when o.plan=p_plan then 'same_plan_shorter'
    else 'lower_plan_active' end) order by o.ends_at desc,o.id),'[]')
  from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is null and o.ends_at>now());
 if cardinality(blockers)=0 and exists(select 1 from jsonb_array_elements(conflicts) c where c->>'relation' in('higher_plan_active','same_plan_covers_request')) then
  blockers:=array_append(blockers,'plan_not_above_current');
 end if;
 presets:=(select jsonb_agg(jsonb_build_object('days',d,'until',(((now() at time zone f.timezone)::date+d)::timestamp at time zone f.timezone)) order by d) from unnest(array[7,30,90]) d);
 return jsonb_build_object('as_of',now(),
  'family',jsonb_build_object('id',f.id,'name',f.name,'timezone',f.timezone,'created_at',f.created_at,
   'member_count',(select count(*) from public.family_members m where m.family_id=f.id),
   'child_count',(select count(*) from public.children c where c.family_id=f.id and c.archived_at is null)),
  'request',jsonb_build_object('plan',p_plan,'until',p_until,'reason_ok',reason_ok),
  'before',jsonb_build_object('plan',before_e.plan,'source',before_e.source,'expires_at',before_e.expires_at),
  'after',jsonb_build_object('plan',after_e.plan,'source',after_e.source,'expires_at',after_e.expires_at),
  'reverts_to',jsonb_build_object('plan',before_e.plan,'source',before_e.source,'expires_at',before_e.expires_at,'note','store_state_unchanged_assumed'),
  'changes',changes,'conflicts',conflicts,'presets',presets,
  'blockers',to_jsonb(blockers),'can_apply',cardinality(blockers)=0,
  'replace_required',cardinality(blockers)=0 and jsonb_array_length(conflicts)>0);
end;$$;
revoke all on function public.admin_override_preview(uuid,public.plan_code,timestamptz,text) from public,anon;
grant execute on function public.admin_override_preview(uuid,public.plan_code,timestamptz,text) to authenticated;

-- Aynı anahtar + aynı girdi → aynı sonuç (admin_save_override makbuzu). Aynı anahtar farklı
-- girdi/aktör → request_conflict. Aile kilidi iki yöneticinin aynı aileye aynı anda telafi
-- yazmasını sıralar: ikincisi önizlemede çakışmayı görür ('override_conflict') ya da
-- p_replace_conflicts ile mevcut telafileri sonlandırıp yenisini yazar.
create function public.admin_override_apply(p_family_id uuid,p_plan public.plan_code,p_until timestamptz,p_reason text,p_idempotency_key uuid,p_replace_conflicts boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r gina.override_commands; preview jsonb; command jsonb; result jsonb; replaced uuid[]:='{}'; c record; blocker text;
begin
 perform gina.assert_admin();
 if p_idempotency_key is null or p_family_id is null or p_plan is null or p_replace_conflicts is null then raise exception 'invalid_input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('override_family:'||p_family_id::text,74));
 select * into r from gina.override_commands where request_id=p_idempotency_key;
 if found then
  if r.actor_id<>auth.uid() or r.family_id<>p_family_id or r.payload->>'action'<>'grant' or r.payload->>'plan'<>p_plan::text
   or (r.payload->>'ends_at')::timestamptz<>p_until or r.payload->>'reason'<>trim(p_reason) then raise exception 'request_conflict';end if;
  return r.result||jsonb_build_object('replayed',true);
 end if;
 preview:=public.admin_override_preview(p_family_id,p_plan,p_until,p_reason);
 if jsonb_array_length(preview->'blockers')>0 then
  blocker:=preview->'blockers'->>0;
  raise exception '%',blocker using errcode='P0001';
 end if;
 if jsonb_array_length(preview->'conflicts')>0 then
  if not p_replace_conflicts then raise exception 'override_conflict' using errcode='P0001';end if;
  for c in select (x->>'override_id')::uuid id from jsonb_array_elements(preview->'conflicts') x loop
   perform public.admin_expire_override(c.id,trim(p_reason)||' [replaced:'||p_idempotency_key::text||']');
   replaced:=replaced||c.id;
  end loop;
 end if;
 command:=jsonb_build_object('action','grant','family_id',p_family_id::text,'plan',p_plan::text,'reason',trim(p_reason),
  'starts_at',to_jsonb(now())#>>'{}','ends_at',to_jsonb(p_until)#>>'{}');
 result:=public.admin_save_override(p_idempotency_key,command);
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details)
 values(auth.uid(),'entitlement_overrides.apply','entitlement_overrides',result->>'override_id',p_family_id,trim(p_reason),
  jsonb_build_object('idempotency_key',p_idempotency_key,'before',preview->'before','after',preview->'after','replaced',to_jsonb(replaced)));
 return result||jsonb_build_object('replayed',false,'before',preview->'before','after',preview->'after','replaced',to_jsonb(replaced));
end;$$;
revoke all on function public.admin_override_apply(uuid,public.plan_code,timestamptz,text,uuid,boolean) from public,anon;
grant execute on function public.admin_override_apply(uuid,public.plan_code,timestamptz,text,uuid,boolean) to authenticated;
