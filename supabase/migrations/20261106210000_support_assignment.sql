-- B04: destek sorumlusu, bekleme süresi, arama; fikir ürün durumları ve benzer fikir bağı.
-- Aile tarafı sözleşmeleri (create/reply/list_help_tickets/get_help_ticket) DEĞİŞMEZ: sorumlu,
-- fikir durumu, benzer bağ ve ekip notu veli çıktısına girmez. Atama ve fikir durumu görüşme
-- revizyonunu artırmaz; yazılan yanıt taslakları bu yüzden "görüşme değişti" sayılmaz.
-- Bilet türü değişmez: özel destek talebi fikre (ya da tersi) dönüştürülemez.

alter table public.help_tickets
 add column assignee_id uuid references auth.users(id) on delete set null,
 add column assigned_at timestamptz,
 add column idea_stage text check(idea_stage in('new','reviewing','planned','building','shipped','declined')),
 add column similar_to uuid references public.help_tickets(id) on delete set null,
 add constraint help_tickets_idea_fields check(kind='idea' or (idea_stage is null and similar_to is null)),
 add constraint help_tickets_similar_not_self check(similar_to is distinct from id);
update public.help_tickets set idea_stage='new' where kind='idea' and idea_stage is null;
create index help_tickets_assignee_idx on public.help_tickets(assignee_id,updated_at desc) where assignee_id is not null;
create index help_tickets_similar_idx on public.help_tickets(similar_to) where similar_to is not null;
create index help_messages_body_trgm on public.help_messages using gin(body extensions.gin_trgm_ops);
create index help_tickets_subject_trgm on public.help_tickets using gin(subject extensions.gin_trgm_ops);

create function gina.help_ticket_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.kind='idea' and new.idea_stage is null then new.idea_stage:='new';end if;
  return new;
 end if;
 if new.kind<>old.kind then raise exception 'help_kind_immutable' using errcode='22023';end if;
 if new.similar_to is not null and new.similar_to is distinct from old.similar_to
  and not exists(select 1 from public.help_tickets where id=new.similar_to and kind='idea') then
  raise exception 'similar_must_be_idea' using errcode='22023';
 end if;
 if new.assignee_id is null then new.assigned_at:=null;end if;
 return new;
end;$$;
create trigger help_ticket_guard before insert or update on public.help_tickets
 for each row execute function gina.help_ticket_guard();

-- Başka bir kullanıcının canlı destek yetkisi (claim okunamaz: admins satırı veya üyelik).
create function gina.is_support_operator(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and (exists(select 1 from public.admins where user_id=p_user)
  or exists(select 1 from public.operations_members where user_id=p_user and role='support' and revoked_at is null and expires_at>now()));
$$;
create function gina.operator_label(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce(nullif(trim(u.raw_user_meta_data->>'name'),''),split_part(u.email,'@',1),'Ekip üyesi')
 from auth.users u where u.id=p_user;
$$;
-- Veli bekleme başlangıcı: son destek (aileye görünür) yanıtından sonraki ilk veli mesajı.
-- Son aileye görünür mesaj destekten ise veli beklemiyor (null). Ekip notu beklemeyi kapatmaz.
create function gina.help_waiting_since(p_ticket uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 select min(m.created_at) from public.help_messages m
 where m.ticket_id=p_ticket and m.author_role='parent'
  and m.sequence>coalesce((select max(s.sequence) from public.help_messages s
   where s.ticket_id=p_ticket and s.author_role='support' and s.visibility='family'),0);
$$;
revoke all on function gina.is_support_operator(uuid),gina.operator_label(uuid),gina.help_waiting_since(uuid),gina.help_ticket_guard() from public,anon,authenticated;

create function public.admin_support_queue(
 p_kind text default 'support', p_status text default 'open', p_category text default null,
 p_assignee text default 'any', p_query text default null, p_waiting boolean default false,
 p_before_time timestamptz default null, p_before_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q text; me uuid:=auth.uid(); who uuid;
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_kind is null or p_kind not in('support','idea')
 or (p_status is not null and p_status not in('open','in_progress','waiting_parent','completed','all'))
 or (p_category is not null and p_category not in('account','device','learning','billing','other'))
 or p_assignee is null or p_waiting is null
 or (p_before_time is null)<>(p_before_id is null)
 or length(coalesce(p_query,''))>80 then raise exception 'invalid_input' using errcode='22023';end if;
 if p_assignee not in('any','me','none') then
  begin who:=p_assignee::uuid; exception when others then raise exception 'invalid_input' using errcode='22023'; end;
 end if;
 q:=nullif(trim(coalesce(p_query,'')),'');
 if q is not null and length(q)<2 then raise exception 'invalid_input' using errcode='22023';end if;
 if q is not null then q:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';end if;
 return (select coalesce(jsonb_agg(r order by (r->>'updated_at')::timestamptz desc,r->>'id'),'[]') from (
  select jsonb_build_object('id',t.id,'kind',t.kind,'category',t.category,'subject',t.subject,'status',t.status,
   'revision',t.revision,'created_at',t.created_at,'updated_at',t.updated_at,
   'assignee_id',t.assignee_id,'assignee_label',gina.operator_label(t.assignee_id),'assignee_is_me',coalesce(t.assignee_id=me,false),'assigned_at',t.assigned_at,
   'waiting_since',w.since,'idea_stage',t.idea_stage,'similar_to',t.similar_to,
   'similar_count',(select count(*) from public.help_tickets c where c.similar_to=t.id),
   'match',case when q is null then null when t.subject ilike q then 'subject' when t.id::text ilike q then 'id' else 'message' end) r
  from public.help_tickets t
  cross join lateral (select gina.help_waiting_since(t.id) since) w
  where t.kind=p_kind and (p_category is null or t.category=p_category)
   and (p_status is null or p_status='all' or t.status=p_status or (p_status='completed' and t.status in('resolved','closed')))
   and (p_assignee='any' or (p_assignee='me' and t.assignee_id=me) or (p_assignee='none' and t.assignee_id is null) or t.assignee_id=who)
   and (not p_waiting or w.since is not null)
   and (q is null or t.subject ilike q or t.id::text ilike q
        or exists(select 1 from public.help_messages m where m.ticket_id=t.id and m.body ilike q))
   and (p_before_time is null or t.updated_at<p_before_time or (t.updated_at=p_before_time and t.id>p_before_id))
  order by t.updated_at desc,t.id limit 50
 ) x);
end;$$;

create function public.admin_support_operators() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u,'label',gina.operator_label(u),'is_me',u=auth.uid()) order by u<>auth.uid(),gina.operator_label(u)),'[]')
  from (select user_id u from public.admins union select user_id from public.operations_members
        where role='support' and revoked_at is null and expires_at>now()) s
  where exists(select 1 from auth.users where id=s.u and not is_anonymous));
end;$$;

-- Atama: beklenen sorumlu karşılaştırılır (iki operatör aynı anda atarsa ikincisi
-- assignment_changed alır). Aynı istek kimliği yeniden denenirse aynı sonuç döner.
create function public.assign_help_ticket(p_request_id uuid,p_ticket_id uuid,p_expected_assignee uuid,p_assignee uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.help_tickets; payload jsonb; result jsonb;
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_ticket_id is null then raise exception 'invalid_input' using errcode='22023';end if;
 payload:=jsonb_build_object('action','assign','ticket',p_ticket_id,'expected',p_expected_assignee,'assignee',p_assignee);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into t from public.help_tickets where id=p_ticket_id for update;
 if t.id is null then raise exception 'help_not_found' using errcode='22023';end if;
 if t.assignee_id is distinct from p_expected_assignee then raise exception 'assignment_changed' using errcode='P0001';end if;
 if p_assignee is not null and not gina.is_support_operator(p_assignee) then raise exception 'assignee_not_operator' using errcode='22023';end if;
 update public.help_tickets set assignee_id=p_assignee,assigned_at=case when p_assignee is null then null else now() end where id=t.id;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,details)
 values(auth.uid(),'help.assign','help_tickets',t.id::text,t.family_id,jsonb_build_object('from',t.assignee_id,'to',p_assignee));
 result:=jsonb_build_object('id',t.id,'assignee_id',p_assignee,'assignee_label',gina.operator_label(p_assignee));
 perform gina.save_help_receipt(p_request_id,payload,result,t.family_id);
 return result;
end;$$;

-- Fikir ürün durumu ve benzer fikir bağı. Yalnız kind='idea'; destek talebi bu yoldan
-- fikir/kamu listesine taşınamaz. Bağ tek düzeydir: hedefin kökü kullanılır, döngü yasak.
create function public.set_idea_stage(p_request_id uuid,p_ticket_id uuid,p_expected_stage text,p_expected_similar uuid,p_stage text,p_similar_to uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.help_tickets; target public.help_tickets; root uuid; payload jsonb; result jsonb;
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_ticket_id is null or p_stage is null or p_stage not in('new','reviewing','planned','building','shipped','declined') then raise exception 'invalid_input' using errcode='22023';end if;
 payload:=jsonb_build_object('action','idea','ticket',p_ticket_id,'expected',p_expected_stage,'expected_similar',p_expected_similar,'stage',p_stage,'similar',p_similar_to);
 result:=gina.help_receipt(p_request_id,payload);if result is not null then return result;end if;
 select * into t from public.help_tickets where id=p_ticket_id for update;
 if t.id is null then raise exception 'help_not_found' using errcode='22023';end if;
 if t.kind<>'idea' then raise exception 'idea_only' using errcode='22023';end if;
 if t.idea_stage is distinct from p_expected_stage or t.similar_to is distinct from p_expected_similar then raise exception 'idea_changed' using errcode='P0001';end if;
 if p_similar_to is not null then
  select * into target from public.help_tickets where id=p_similar_to;
  if target.id is null or target.kind<>'idea' then raise exception 'similar_must_be_idea' using errcode='22023';end if;
  root:=coalesce(target.similar_to,target.id);
  if root=t.id then raise exception 'similar_cycle' using errcode='22023';end if;
 end if;
 update public.help_tickets set idea_stage=p_stage,similar_to=root where id=t.id;
 insert into public.audit_log(actor_id,action,target_table,target_id,family_id,details)
 values(auth.uid(),'help.idea_stage','help_tickets',t.id::text,t.family_id,jsonb_build_object('from',t.idea_stage,'to',p_stage,'similar_to',root));
 result:=jsonb_build_object('id',t.id,'idea_stage',p_stage,'similar_to',root);
 perform gina.save_help_receipt(p_request_id,payload,result,t.family_id);
 return result;
end;$$;

-- Operatör yan paneli: sorumlu, bekleme, fikir durumu, benzer fikir adayları.
create function public.admin_help_ticket_meta(p_ticket_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.help_tickets;
begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 select * into t from public.help_tickets where id=p_ticket_id;
 if t.id is null then raise exception 'help_not_found' using errcode='22023';end if;
 return jsonb_build_object('id',t.id,'kind',t.kind,'assignee_id',t.assignee_id,'assignee_label',gina.operator_label(t.assignee_id),
  'assignee_is_me',coalesce(t.assignee_id=auth.uid(),false),'assigned_at',t.assigned_at,'waiting_since',gina.help_waiting_since(t.id),
  'idea_stage',t.idea_stage,'similar_to',t.similar_to,
  'similar',case when t.kind<>'idea' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'subject',c.subject,
     'idea_stage',c.idea_stage,'linked',c.linked,'score',c.score) order by c.linked desc,c.score desc),'[]')
   from (select c.id,c.subject,c.idea_stage,(c.id=t.similar_to or c.similar_to=t.id) linked,
     round(extensions.similarity(c.subject,t.subject)::numeric,2) score
     from public.help_tickets c where c.kind='idea' and c.id<>t.id
     and (c.id=t.similar_to or c.similar_to=t.id or extensions.similarity(c.subject,t.subject)>=0.2)
     order by 4 desc,5 desc limit 8) c) end);
end;$$;

revoke all on function public.admin_support_queue(text,text,text,text,text,boolean,timestamptz,uuid),public.admin_support_operators(),
 public.assign_help_ticket(uuid,uuid,uuid,uuid),public.set_idea_stage(uuid,uuid,text,uuid,text,uuid),public.admin_help_ticket_meta(uuid) from public,anon;
grant execute on function public.admin_support_queue(text,text,text,text,text,boolean,timestamptz,uuid),public.admin_support_operators(),
 public.assign_help_ticket(uuid,uuid,uuid,uuid),public.set_idea_stage(uuid,uuid,text,uuid,text,uuid),public.admin_help_ticket_meta(uuid) to authenticated;
