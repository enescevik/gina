-- Anonymous device sessions cannot become parents through onboarding RPCs.
create or replace function public.create_family(p_name text,p_display_name text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); family uuid;
begin
 if actor is null then raise exception 'not_authenticated' using errcode='28000';end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'parent_account_required' using errcode='42501';end if;
 -- Same lock as invitations prevents concurrent requests creating duplicate families.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,7));
 if exists(select 1 from public.family_members where user_id=actor) then raise exception 'already_member';end if;
 if exists(select 1 from public.devices where auth_user_id=actor) then raise exception 'device_user';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 80 then raise exception 'invalid_input';end if;
 insert into public.families(name,created_by) values(trim(p_name),actor) returning id into family;
 insert into public.family_members(family_id,user_id,role,display_name) values(family,actor,'parent',p_display_name);
 return family;
end;$$;
revoke all on function public.create_family(text,text) from public,anon;
grant execute on function public.create_family(text,text) to authenticated;
