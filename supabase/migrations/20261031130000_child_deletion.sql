-- A child-authored note without child_id would otherwise fail notes' author CHECK on SET NULL.
create or replace function gina.delete_child_authored_notes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notes where author_child_id = old.id;
  return old;
end;
$$;
revoke execute on function gina.delete_child_authored_notes() from public, anon, authenticated, service_role;
create trigger gina_delete_child_authored_notes before delete on public.children
  for each row execute function gina.delete_child_authored_notes();
