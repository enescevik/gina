-- One server-side inventory of configured AI flow bindings, including inactive models.
create function gina.ai_model_bindings() returns table(flow_id text,flow_label text,plan_code text,model_id text,enabled boolean,model_active boolean)
language sql stable security definer set search_path='' as $$
 with configured as (
  select p.code::text plan_code,coalesce(s.model_id,p.ai_model) model_id,
   coalesce(s.enabled,true) and coalesce((select value<>'false'::jsonb from public.app_settings where key='ai.enabled'),true) enabled
  from public.plans p left join public.ai_settings s on s.plan_code=p.code
 ), bindings as (
  select 'plan:'||c.plan_code flow_id,'Paket AI işlemleri'::text flow_label,c.* from configured c
  union all
  select 'content_prereview','İçerik ön inceleme',c.plan_code,c.model_id,
   c.enabled and exists(select 1 from public.app_settings where key='content_prereview.enabled' and value='true'::jsonb)
  from configured c where c.plan_code=coalesce((select case when jsonb_typeof(value)='string' then value#>>'{}' end from public.app_settings where key='content_prereview.plan'),'pro')
 )
 select b.*,coalesce(m.active,false) model_active from bindings b left join public.ai_models m on m.id=b.model_id;
$$;
revoke all on function gina.ai_model_bindings() from public,anon,authenticated,service_role;

create or replace function public.admin_model_disable_preview(p_model_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m public.ai_models; affected public.plan_code[];
begin
 perform gina.assert_admin();
 select * into m from public.ai_models where id=p_model_id;
 if m.id is null then raise exception 'model_not_found'; end if;
 select coalesce(array_agg(distinct b.plan_code::public.plan_code order by b.plan_code::public.plan_code),'{}') into affected from gina.ai_model_bindings() b where b.enabled and b.model_id=p_model_id;
 return jsonb_build_object(
  'model_id',p_model_id,'provider',m.provider,'active',m.active,
  'affected_plans',to_jsonb(affected),
  'affected_flows',(select coalesce(jsonb_agg(to_jsonb(b) order by b.flow_id),'[]') from gina.ai_model_bindings() b where b.model_id=p_model_id),
  'affected_features',(select coalesce(jsonb_agg(jsonb_build_object('feature',f,'inputs',inputs,'plans',ps) order by f),'[]') from (
    select e.feature f, jsonb_agg(distinct e.input_kind) inputs, to_jsonb(array_agg(distinct e.plan order by e.plan)) ps
    from (select r.feature, r.input_kind, p.plan from public.ai_feature_requirements r, unnest(r.plans) p(plan) where p.plan = any(affected)) e group by e.feature) q),
  'alternatives',(select coalesce(jsonb_agg(a.id order by a.id),'[]') from public.ai_models a
    where a.id<>p_model_id and a.active and a.provider=m.provider and (gina.ai_model_support(a)->>'supported')::boolean),
  'jobs_last_30d',(select coalesce(jsonb_object_agg(action,n),'{}') from (
    select action,count(*) n from public.ai_operation_jobs where created_at>now()-interval '30 days' group by action) j));
end; $$;
revoke all on function public.admin_model_disable_preview(text) from public, anon;
grant execute on function public.admin_model_disable_preview(text) to authenticated;

create or replace function public.admin_ai_policy_matrix() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'global_enabled', coalesce((select value from public.app_settings where key='ai.enabled') <> 'false'::jsonb, true),
  'flows',(select coalesce(jsonb_agg(to_jsonb(b) order by b.flow_id),'[]') from gina.ai_model_bindings() b),
  'providers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.ai_providers p),
  'models',(select coalesce(jsonb_agg((to_jsonb(m) || jsonb_build_object('support',gina.ai_model_support(m))) order by m.id),'[]') from public.ai_models m),
  'features',(select coalesce(jsonb_agg(to_jsonb(r) order by r.feature,r.input_kind),'[]') from public.ai_feature_requirements r),
  'plans',(select coalesce(jsonb_agg(jsonb_build_object(
     'plan_code',s.plan_code,'enabled',s.enabled,'model_id',s.model_id,'max_input_tokens',s.max_input_tokens,'max_output_tokens',s.max_output_tokens,'prompt_version',s.prompt_version,
     'prova_ai_generate_monthly',pl.prova_ai_generate_monthly,'setup_ai_monthly',pl.setup_ai_monthly,
     'policies',(select coalesce(jsonb_agg(to_jsonb(o) - 'plan_code' order by o.action),'[]') from public.ai_operation_policies o where o.plan_code=s.plan_code)
    ) order by s.plan_code),'[]') from public.ai_settings s join public.plans pl on pl.code=s.plan_code));
end; $$;
revoke all on function public.admin_ai_policy_matrix() from public, anon;
grant execute on function public.admin_ai_policy_matrix() to authenticated;

