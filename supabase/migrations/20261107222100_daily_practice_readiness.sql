-- Release the daily practice and reading preferences independently of the wider learning rollout.
create function public.daily_practice_ready() returns boolean
 language sql immutable set search_path='' as $$ select true $$;
revoke all on function public.daily_practice_ready() from public,anon,service_role;
grant execute on function public.daily_practice_ready() to authenticated;
