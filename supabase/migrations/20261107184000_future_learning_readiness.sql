-- Main can deploy clients ahead of the coordinated SQL/Edge/native release.
-- The client must not offer new operations against an older production schema.
create function public.future_learning_ready() returns boolean
 language sql immutable set search_path='' as $$ select true $$;
revoke all on function public.future_learning_ready() from public,anon;
grant execute on function public.future_learning_ready() to authenticated;
