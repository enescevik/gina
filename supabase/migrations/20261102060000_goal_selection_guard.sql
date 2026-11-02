-- Validate the child before cancelling any goal; serialize choices and make retries harmless.
create or replace function public.set_child_goal(p_reward_id uuid,p_acting_child_id uuid default null)
returns public.child_goals language plpgsql security definer set search_path='' as $$
declare v_child uuid; v_row public.child_goals;
begin
 if gina.is_device() then v_child:=gina.child_id();
 elsif gina.is_parent() then v_child:=p_acting_child_id;
 else raise exception 'forbidden' using errcode='42501'; end if;
 if v_child is null then raise exception 'no_child'; end if;
 perform 1 from public.children where id=v_child and family_id=gina.family_id() for update;
 if not found then raise exception 'child_not_found' using errcode='42501'; end if;
 if not exists(select 1 from public.family_rewards where id=p_reward_id and family_id=gina.family_id() and active) then raise exception 'reward_not_found'; end if;
 select * into v_row from public.child_goals where child_id=v_child and status='active' and reward_id=p_reward_id;
 if found then return v_row; end if;
 update public.child_goals set status='cancelled',decided_at=now() where child_id=v_child and status='active';
 insert into public.child_goals(family_id,child_id,reward_id,created_by) values(gina.family_id(),v_child,p_reward_id,auth.uid()) returning * into v_row;
 return v_row;
end; $$;
