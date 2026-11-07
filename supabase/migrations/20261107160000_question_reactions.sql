-- F1: explicit, removable parent preferences. No child signal, score or AI side effect.
create table public.question_reactions (
 family_id uuid not null references public.families(id) on delete cascade,
 parent_user_id uuid not null references auth.users(id) on delete cascade,
 question_id uuid not null references public.question_bank(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (family_id,parent_user_id,question_id)
);
alter table public.question_reactions enable row level security;
revoke all on public.question_reactions from public,anon,authenticated;
grant select,delete on public.question_reactions to authenticated;
grant insert(family_id,parent_user_id,question_id) on public.question_reactions to authenticated;
-- No client UPDATE: creation time and ownership cannot be rewritten.
create policy question_reactions_read on public.question_reactions for select to authenticated
 using (gina.is_parent() and family_id=gina.family_id() and parent_user_id=auth.uid());
create policy question_reactions_insert on public.question_reactions for insert to authenticated
 with check (gina.is_parent() and family_id=gina.family_id() and parent_user_id=auth.uid()
 and exists(select 1 from public.question_bank q where q.id=question_id and q.family_id=gina.family_id()));
create policy question_reactions_delete on public.question_reactions for delete to authenticated
 using (gina.is_parent() and family_id=gina.family_id() and parent_user_id=auth.uid());
create index question_reactions_recent on public.question_reactions(family_id,parent_user_id,created_at desc,question_id);
