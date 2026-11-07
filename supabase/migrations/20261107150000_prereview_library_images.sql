-- Only trusted service callers with the current review lease can obtain immutable library PNGs.
create function public.content_prereview_library_images(p_id uuid,p_lease uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501';end if;
 if not exists(select 1 from gina.content_prereviews where target_kind='library_package' and target_id=p_id and lease=p_lease and prereview_status='pending' and claimed_at>now()-interval '3 minutes') then raise exception 'prereview_lease_lost';end if;
 if (select count(*) from gina.library_import_sources where package_id=p_id and asset_hash is not null)>8 or (select coalesce(sum(octet_length(a.png)),0) from gina.library_import_sources s join gina.library_import_assets a on a.sha256=s.asset_hash where s.package_id=p_id)>6000000 then raise exception 'prereview_media_limit';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('source_key',s.source_key,'sha256',a.sha256,'base64',replace(encode(a.png,'base64'),E'\n','')) order by s.source_key),'[]') from gina.library_import_sources s join gina.library_import_assets a on a.sha256=s.asset_hash where s.package_id=p_id);
end $$;
revoke all on function public.content_prereview_library_images(uuid,uuid) from public,anon,authenticated;
grant execute on function public.content_prereview_library_images(uuid,uuid) to service_role;

create or replace function gina.prereview_no_call(p_error text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_error in('provider_health_unavailable','prereview_media_unavailable') or gina.prereview_requeueable(p_error),false);
$$;
