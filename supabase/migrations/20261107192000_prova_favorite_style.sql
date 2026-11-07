-- The generation provider sees structural preferences only. Keep private reactions,
-- question IDs, answer keys, wording and provenance outside the returned payload.
create function public.get_prova_favorite_shapes(
  p_family_id uuid, p_parent_id uuid, p_subject text, p_grade integer
) returns table(kind text, difficulty text, cognitive_demand text)
language plpgsql stable security definer set search_path='' as $$
begin
  if gina.is_service() is not true or not exists (
    select 1 from public.family_members m
    where m.family_id=p_family_id and m.user_id=p_parent_id
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_subject is null or length(p_subject) not between 1 and 80 or p_grade is null or p_grade not between 1 and 12 then
    raise exception 'invalid_input';
  end if;

  return query
  with recent as (
    select q.kind::text as shape_kind, q.difficulty::text as shape_difficulty,
      case when q.provenance->>'cognitive_demand' in (
        'hatirlama','anlama','uygulama','analiz','degerlendirme','yaratma'
      ) then q.provenance->>'cognitive_demand' end as demand,
      r.created_at
    from public.question_reactions r
    join public.question_bank q on q.id=r.question_id and q.family_id=r.family_id
    where r.family_id=p_family_id and r.parent_user_id=p_parent_id
      and q.subject=p_subject and q.grade=p_grade
    order by r.created_at desc,r.question_id
    limit 12
  )
  select shape_kind, shape_difficulty, demand from recent
  group by shape_kind,shape_difficulty,demand
  order by count(*) desc,max(created_at) desc,shape_kind,shape_difficulty,demand
  limit 3;
end;$$;
revoke all on function public.get_prova_favorite_shapes(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.get_prova_favorite_shapes(uuid,uuid,text,integer) to service_role;

create function public.get_prova_favorite_style_available() returns boolean
language sql stable security definer set search_path='' as $$select coalesce(gina.is_parent(),false)$$;
revoke all on function public.get_prova_favorite_style_available() from public, anon, service_role;
grant execute on function public.get_prova_favorite_style_available() to authenticated;
