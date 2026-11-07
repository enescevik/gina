alter table public.child_shares
  add column outcome_snapshot jsonb,
  drop constraint child_shares_scopes_check,
  add constraint child_shares_scopes_check check (
    cardinality(scopes)>0 and scopes <@ array['grades','prova','tasks_summary','learning_outcomes']::text[]
  ),
  add constraint child_shares_outcome_snapshot_scope check (
    ('learning_outcomes'=any(scopes))=(outcome_snapshot is not null)
  );

create function public.preview_teacher_outcome_share(p_child_id uuid, p_subject text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  grade integer;
  report jsonb;
  snapshot jsonb;
begin
  if gina.is_parent() is not true then raise exception 'forbidden' using errcode='42501'; end if;
  select c.grade into grade from public.children c
    where c.id=p_child_id and c.family_id=gina.family_id() and c.archived_at is null;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;

  if p_subject is null then
    report:=public.learning_progress_education(p_child_id,30,null,grade,'all');
    return jsonb_build_object('subjects',coalesce((
      select jsonb_agg(subject order by subject) from (
        select distinct item->>'subject' as subject
        from jsonb_array_elements(report->'topics') item
      ) options
    ),'[]'::jsonb));
  end if;

  report:=public.learning_outcome_observations(p_child_id,30,p_subject,grade,'all');
  snapshot:=jsonb_build_object('subject',p_subject,'days',30,'rows',coalesce((
    select jsonb_agg(row.value order by row.position)
    from (
      select jsonb_build_object(
        'outcomes',item->'outcomes','grade',item->'grade',
        'scored',item->'scored','mean_points',item->'mean_points'
      ) as value,position
      from jsonb_array_elements(report) with ordinality r(item,position)
      where item->>'mean_points' is not null
        and not exists (
          select 1 from jsonb_array_elements_text(item->'outcomes') label
          where label !~ '^[[:alnum:]][[:alnum:]._-]{0,79}$'
        )
      order by position
      limit 20
    ) row
  ),'[]'::jsonb));
  return jsonb_build_object('snapshot',snapshot,'hash',encode(extensions.digest(snapshot::text,'sha256'),'hex'));
end;$$;
revoke all on function public.preview_teacher_outcome_share(uuid,text) from public, anon, service_role;
grant execute on function public.preview_teacher_outcome_share(uuid,text) to authenticated;

create function gina.create_child_share_record(
  p_child_id uuid,
  p_label text,
  p_scopes text[],
  p_expires_in_days integer,
  p_snapshot jsonb
)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_family uuid := gina.family_id();
  v_label text := btrim(coalesce(p_label, ''));
  v_scopes text[];
  v_days integer := coalesce(p_expires_in_days, 30);
  v_token text;
  v_row public.child_shares%rowtype;
begin
  if gina.is_parent() is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.children c where c.id=p_child_id and c.family_id=v_family and c.archived_at is null for share;
  if not found then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_label) not between 1 and 80 then
    raise exception 'invalid_label' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_scopes from unnest(p_scopes) s;
  if cardinality(v_scopes) = 0 or not (v_scopes <@ array['grades', 'prova', 'tasks_summary','learning_outcomes']::text[]) then
    raise exception 'invalid_scopes' using errcode = 'P0001';
  end if;
  if ('learning_outcomes'=any(v_scopes)) is distinct from (p_snapshot is not null) then
    raise exception 'invalid_scopes' using errcode='P0001';
  end if;
  if v_days not between 1 and 180 then
    raise exception 'invalid_expiry' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,193));
  -- Kötüye kullanıma karşı çocuk başına en fazla 20 etkin bağlantı.
  if (select count(*) from public.child_shares s
      where s.child_id = p_child_id and s.revoked_at is null and s.expires_at > now()) >= 20 then
    raise exception 'too_many_shares' using errcode = 'P0001';
  end if;

  -- 32 rastgele bayt → base64url (43 karakter, dolgusuz).
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/\n', '-_'), '=');

  insert into public.child_shares (family_id, child_id, created_by, label, scopes, token_hash, expires_at, outcome_snapshot)
  values (v_family, p_child_id, auth.uid(), v_label, v_scopes,
          extensions.digest(v_token, 'sha256'), now() + make_interval(days => v_days), p_snapshot)
  returning * into v_row;

  perform gina.share_audit('child_shares.create', v_row.id, v_family,
    jsonb_build_object('child_id', p_child_id, 'scopes', to_jsonb(v_scopes), 'expires_at', v_row.expires_at));

  id := v_row.id;
  token := v_token;
  expires_at := v_row.expires_at;
  return next;
end;
$$;

revoke all on function gina.create_child_share_record(uuid,text,text[],integer,jsonb) from public, anon, authenticated, service_role;

create or replace function public.create_child_share(
  p_child_id uuid, p_label text, p_scopes text[], p_expires_in_days integer default 30
) returns table(id uuid, token text, expires_at timestamptz)
language sql security definer set search_path='' as $$
  select * from gina.create_child_share_record(p_child_id,p_label,p_scopes,p_expires_in_days,null)
$$;

create function public.create_child_outcome_share(
  p_child_id uuid, p_label text, p_scopes text[], p_expires_in_days integer,
  p_subject text, p_preview_hash text
) returns table(id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  preview jsonb := public.preview_teacher_outcome_share(p_child_id,p_subject);
begin
  if p_subject is null or p_preview_hash is distinct from preview->>'hash' then
    raise exception 'outcome_preview_changed';
  end if;
  if jsonb_array_length(preview#>'{snapshot,rows}')=0 then raise exception 'outcome_share_empty'; end if;
  return query select * from gina.create_child_share_record(
    p_child_id,p_label,p_scopes,p_expires_in_days,preview->'snapshot'
  );
end;$$;
revoke all on function public.create_child_outcome_share(uuid,text,text[],integer,text,text) from public, anon, service_role;
grant execute on function public.create_child_outcome_share(uuid,text,text[],integer,text,text) to authenticated;

create or replace function public.get_shared_child_view(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_share public.child_shares%rowtype;
  v_child record;
  v_tz text;
  v_result jsonb;
begin
  -- Biçim kontrolü sorgudan önce; özet her durumda hesaplanır (zamanlama farkı küçük kalsın).
  if p_token is not null and p_token ~ '^[A-Za-z0-9_-]{43}$' then
    select * into v_share from public.child_shares s
     where s.token_hash = extensions.digest(p_token, 'sha256')
       and s.revoked_at is null
       and s.expires_at > now()
       and exists(select 1 from public.children c where c.id=s.child_id and c.family_id=s.family_id and c.archived_at is null)
     for update;
  else
    perform extensions.digest(coalesce(p_token, ''), 'sha256');
  end if;

  if v_share.id is null then
    perform pg_sleep(0.15 + random() * 0.1);
    raise exception 'invalid_share' using errcode = 'P0001';
  end if;

  update public.child_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_share.id;

  select split_part(btrim(c.name), ' ', 1) as first_name, c.grade into v_child
    from public.children c where c.id = v_share.child_id;
  select f.timezone into v_tz from public.families f where f.id = v_share.family_id;

  v_result := jsonb_build_object(
    'child', jsonb_build_object('first_name', v_child.first_name, 'grade', v_child.grade),
    'label', v_share.label,
    'scopes', to_jsonb(v_share.scopes),
    'expires_at', v_share.expires_at,
    'generated_at', now()
  );

  if 'grades' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('grades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'subject', g.subject, 'score', g.score, 'max_score', g.max_score, 'date', g.graded_on)
             order by g.graded_on desc, g.created_at desc)
        from (select * from public.grades
               where child_id = v_share.child_id and withdrawn_at is null
               order by graded_on desc, created_at desc
               limit 100) g
    ), '[]'::jsonb));
  end if;

  if 'prova' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('prova', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', a.title, 'subject', a.subject, 'date', a.finished_on,
               'mc_correct', a.mc_correct, 'mc_total', a.mc_total, 'topics', a.topics)
             order by a.finished_at desc)
        from (
          select e.title, e.subject, at.finished_at,
                 (at.finished_at at time zone coalesce(v_tz, 'Europe/Istanbul'))::date as finished_on,
                 at.mc_correct, at.mc_total,
                 coalesce((
                   select jsonb_agg(jsonb_build_object('topic', t.topic, 'correct', t.correct, 'total', t.total) order by t.topic)
                     from (
                       select q.topic,
                              count(*) filter (where ans.is_correct)::int as correct,
                              count(*)::int as total
                         from public.exam_answers ans
                         join public.question_bank q on q.id = ans.question_id
                        where ans.attempt_id = at.id and q.kind = 'multiple_choice'
                        group by q.topic
                     ) t
                 ), '[]'::jsonb) as topics
            from public.exam_attempts at
            join public.exams e on e.id = at.exam_id
           where at.child_id = v_share.child_id
             and at.status in ('submitted', 'graded')
             and at.finished_at is not null
           order by at.finished_at desc
           limit 30
        ) a
    ), '[]'::jsonb));
  end if;

  if 'tasks_summary' = any (v_share.scopes) then
    v_result := v_result || jsonb_build_object('tasks_summary', (
      select jsonb_build_object(
               'days', 30,
               'completed', count(*) filter (where tc.status in ('done', 'approved'))::int,
               'approved', count(*) filter (where tc.status = 'approved')::int,
               'returned', count(*) filter (where tc.status = 'returned')::int)
        from public.task_completions tc
       where tc.child_id = v_share.child_id
         and tc.due_date > (now() at time zone coalesce(v_tz, 'Europe/Istanbul'))::date - 30
    ));
  end if;

  if 'learning_outcomes' = any(v_share.scopes) then
    v_result := v_result || jsonb_build_object('learning_outcomes',v_share.outcome_snapshot);
  end if;
  return v_result;
end;
$$;
