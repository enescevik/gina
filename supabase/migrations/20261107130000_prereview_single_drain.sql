-- A single review may use 130 seconds; three sequential reviews can exceed the 150-second HTTP deadline.
-- Drain one leased item per request to avoid cancelling a later paid call.
CREATE OR REPLACE FUNCTION gina.kick_content_prereview()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   body:=jsonb_build_object('drain',true,'limit',1),timeout_milliseconds:=150000) into v_request;
  insert into gina.content_prereview_kicks(request_id,note) values(v_request,'posted');
 exception when others then
  insert into gina.content_prereview_kicks(note) values(left('post_failed: '||sqlerrm,80));
 end;
end;$function$
;
