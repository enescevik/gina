-- Run with supabase db query --linked --file ... . All fixtures are rolled back.
-- No existing family, plan, account, question or task is updated.
begin;
select set_config('gina_preflight.user_id',gen_random_uuid()::text,true);
select set_config('gina_preflight.family_id',gen_random_uuid()::text,true);
select set_config('gina_preflight.child_id',gen_random_uuid()::text,true);
insert into auth.users(id,email)
values(current_setting('gina_preflight.user_id')::uuid,'gina-preflight-'||current_setting('gina_preflight.user_id')||'@example.invalid');
insert into public.families(id,name,created_by)
values(current_setting('gina_preflight.family_id')::uuid,'Synthetic rollback check',current_setting('gina_preflight.user_id')::uuid);
insert into public.family_members(family_id,user_id)
values(current_setting('gina_preflight.family_id')::uuid,current_setting('gina_preflight.user_id')::uuid);
insert into public.children(id,family_id,name)
values(current_setting('gina_preflight.child_id')::uuid,current_setting('gina_preflight.family_id')::uuid,'Synthetic child');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('gina_preflight.user_id'),'role','authenticated',
  'gina',jsonb_build_object('family_id',current_setting('gina_preflight.family_id'),'role','parent')
)::text,true);
do $check$
declare
  request_id uuid:=gen_random_uuid();
  checked_child uuid:=current_setting('gina_preflight.child_id')::uuid;
  checked_family uuid:=current_setting('gina_preflight.family_id')::uuid;
  items jsonb:='[{"title":"Synthetic reading","icon":"read-book","stars":2,"days":[1]},{"title":"Synthetic packing","icon":"pack-school-bag","stars":1,"days":[2]},{"title":"Synthetic watering","icon":"water-plants","stars":1,"days":[3]}]';
  first_result jsonb;
  draft_id uuid:=gen_random_uuid();
  draft_request uuid:=gen_random_uuid();
  draft_content jsonb;
  ticket_request uuid:=gen_random_uuid();
  ticket jsonb;
  roles jsonb;
begin
  first_result:=public.save_setup_batch(request_id,'task',items,checked_child);
  if jsonb_array_length(first_result)<>3 then raise exception 'batch_count_failed';end if;
  if public.save_setup_batch(request_id,'task',items,checked_child)<>first_result then raise exception 'receipt_replay_failed';end if;
  if (select count(*) from public.task_templates t where t.family_id=checked_family and t.child_id=checked_child)<>3 then raise exception 'duplicate_record';end if;
  begin
    perform public.save_setup_batch(gen_random_uuid(),'task',items,gen_random_uuid());
    raise exception 'foreign_child_accepted';
  exception when insufficient_privilege then null;
  end;
  perform public.get_prova_entitlement();
  perform public.get_learning_source_policy();
  perform public.get_group_exams();
  draft_content:=jsonb_build_object('childId',checked_child,'grade',5,'title','Synthetic deployment draft','purpose','practice','format','practice','subjects',jsonb_build_array('Matematik'),'topics','[]'::jsonb,'target',1,'minutes',null,'difficulty','orta','kind','mixed','note','','step',0,'blocks','[]'::jsonb);
  first_result:=public.save_prova_draft(draft_request,draft_id,0,draft_content);
  if public.save_prova_draft(draft_request,draft_id,0,draft_content)<>first_result then raise exception 'draft_replay_failed';end if;
  if jsonb_array_length(public.get_prova_drafts(draft_id))<>1 then raise exception 'draft_read_failed';end if;
  if public.learning_progress(checked_child,30,null,null)->'summary'->>'total'<>'0' then raise exception 'progress_empty_failed';end if;
  ticket:=public.create_help_ticket(ticket_request,'support','other','Synthetic deployment check','Synthetic rollback-only support message');
  if public.create_help_ticket(ticket_request,'support','other','Synthetic deployment check','Synthetic rollback-only support message')<>ticket then raise exception 'ticket_replay_failed';end if;
  if jsonb_array_length(public.get_help_ticket((ticket->>'id')::uuid,null)->'messages')<>1 then raise exception 'ticket_read_failed';end if;
  if jsonb_array_length(public.list_help_tickets(false,null,null,0))<>1 then raise exception 'ticket_list_failed';end if;
  perform public.get_help_articles('tr','ios',false);
  roles:=public.my_operation_roles();
  if roles<>'[]'::jsonb then raise exception 'parent_operator_privilege';end if;
  begin
    perform public.list_help_tickets(true,null,null,0);
    raise exception 'operator_access_accepted';
  exception when insufficient_privilege then null;
  end;
end;
$check$;
reset role;
rollback;
select jsonb_build_object('existing_batch_and_idempotency',true,'draft_save_read_and_idempotency',true,'progress_empty_read',true,'help_ticket_read_and_idempotency',true,'help_articles_read',true,'parent_operator_access_denied',true,'fixtures_rolled_back',true) as checks;
