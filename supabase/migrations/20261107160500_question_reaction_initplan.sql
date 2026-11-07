-- Preserve published F1 migration; align new policies with existing InitPlan rule.
drop policy question_reactions_read on public.question_reactions;
drop policy question_reactions_insert on public.question_reactions;
drop policy question_reactions_delete on public.question_reactions;
create policy question_reactions_read on public.question_reactions for select to authenticated
 using ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid()));
create policy question_reactions_insert on public.question_reactions for insert to authenticated
 with check ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid())
 and exists(select 1 from public.question_bank q where q.id=question_id and q.family_id=(select gina.family_id())));
create policy question_reactions_delete on public.question_reactions for delete to authenticated
 using ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid()));
