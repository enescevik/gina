-- A full library package includes answers/rubrics; family plan caps stay unchanged.
insert into public.app_settings(key,value) values('content_prereview.max_input_tokens','24000') on conflict do nothing;
-- This failure occurs during token counting, before paid message generation. Explicit
-- admin requeue is allowed after configuration repair, never an automatic retry.
create or replace function gina.prereview_requeueable(p_reason text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_reason in('ai_disabled','ai_model_unavailable','ai_not_configured','provider_unconfigured','ai_model_unsupported',
  'ai_configuration_unavailable','plan_has_no_ai','ai_temporarily_unavailable','source_superseded','source_withdrawn','source_target_retired','provider_input_too_large'),false);
$$;
revoke all on function gina.prereview_requeueable(text) from public,anon,authenticated,service_role;
