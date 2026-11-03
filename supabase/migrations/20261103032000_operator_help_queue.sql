-- Operator filters apply before pagination. Keyset pagination avoids offset
-- drift when another family creates/updates an unrelated ticket.
create function public.list_operator_help_tickets(
 p_kind text default 'support', p_status text default 'open', p_category text default null,
 p_before_time timestamptz default null, p_before_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('support','idea')
 or (p_status is not null and p_status not in('open','in_progress','waiting_parent','completed','all'))
 or (p_category is not null and p_category not in('account','device','learning','billing','other'))
 or (p_before_time is null)<>(p_before_id is null) then raise exception 'invalid_input';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
  select id,kind,category,subject,status,revision,created_at,updated_at from public.help_tickets
  where kind=p_kind and (p_category is null or category=p_category)
   and (p_status is null or p_status='all' or status=p_status or (p_status='completed' and status in('resolved','closed')))
   and (p_before_time is null or updated_at<p_before_time or (updated_at=p_before_time and id>p_before_id))
  order by updated_at desc,id limit 50
 )t);
end;$$;
revoke all on function public.list_operator_help_tickets(text,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.list_operator_help_tickets(text,text,text,timestamptz,uuid) to authenticated;
