-- Preserve the parent-only reaction rules while evaluating request identity once, not per row.
alter policy question_reactions_read on public.question_reactions
 using ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid()));
alter policy question_reactions_insert on public.question_reactions
 with check ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid())
 and exists(select 1 from public.question_bank q where q.id=question_id and q.family_id=(select gina.family_id())));
alter policy question_reactions_delete on public.question_reactions
 using ((select gina.is_parent()) and family_id=(select gina.family_id()) and parent_user_id=(select auth.uid()));
