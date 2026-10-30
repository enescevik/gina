-- Öğretmenle paylaşım (v1): salt okunur paylaşım bağlantısı; öğretmenin hesabı olmaz.
-- docs/TEACHER_SHARE.md işleyişi ve KVKK notlarını anlatır.
-- Bağlantıdaki belirteç (token) 32 rastgele bayttır; veritabanında yalnız SHA-256 özeti tutulur.
-- Düz belirteç create_child_share'den bir kez döner, bir daha hiçbir yerden okunamaz.
-- Görünüm yalnız get_shared_child_view RPC'sinden ve yalnız seçilen kapsamlar (scopes) için asgari veriyle döner:
-- not, PIN, e-posta, doğum tarihi, AI geri bildirimi ASLA dönmez. Yeniden uygulanabilir yazıldı.

-- Tablo -----------------------------------------------------------------------

create table if not exists public.child_shares (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  label text not null check (char_length(label) between 1 and 80), -- ör. öğretmenin adı
  scopes text[] not null check (
    cardinality(scopes) > 0 and scopes <@ array['grades', 'prova', 'tasks_summary']::text[]
  ),
  token_hash bytea not null unique check (octet_length(token_hash) = 32), -- sha256(token)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  check (expires_at > created_at and expires_at <= created_at + interval '180 days')
);
create index if not exists child_shares_child_idx on public.child_shares (child_id, created_at desc);

alter table public.child_shares enable row level security;

-- anon hiçbir şekilde erişemez; veli yalnız token_hash dışındaki kolonları okur.
-- Yazma (oluşturma/iptal) yalnız aşağıdaki RPC'lerle: belirteç sunucuda üretilir.
revoke all on public.child_shares from anon, authenticated, public;
grant select (id, family_id, child_id, created_by, label, scopes, created_at, expires_at, revoked_at, last_viewed_at, view_count)
  on public.child_shares to authenticated;
grant delete on public.child_shares to authenticated;
grant all on public.child_shares to service_role;

drop policy if exists child_shares_parent_select on public.child_shares;
create policy child_shares_parent_select on public.child_shares
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

drop policy if exists child_shares_parent_delete on public.child_shares;
create policy child_shares_parent_delete on public.child_shares
  for delete to authenticated
  using (family_id = gina.family_id() and gina.is_parent());

-- Denetim izi (isteğe bağlı) -----------------------------------------------------
-- public.audit_log başka bir göçte (20261030120000) oluşur; yoksa ya da şeması farklıysa sessizce atlanır.
-- Belirteç ve özeti denetim izine de yazılmaz.
create or replace function gina.share_audit(p_action text, p_share_id uuid, p_family_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.audit_log') is null then
    return;
  end if;
  begin
    execute 'insert into public.audit_log (actor_id, action, target_table, target_id, family_id, details)
             values ($1, $2, ''child_shares'', $3, $4, $5)'
      using auth.uid(), p_action, p_share_id::text, p_family_id, coalesce(p_details, '{}'::jsonb);
  exception when undefined_column or undefined_table or insufficient_privilege then
    null; -- denetim tablosu beklenen şemada değil: paylaşım akışı engellenmez
  end;
end;
$$;

revoke execute on function gina.share_audit(text, uuid, uuid, jsonb) from public, anon, authenticated;

-- Veli RPC'leri ------------------------------------------------------------------

drop function if exists public.create_child_share(uuid, text, text[], integer);
create or replace function public.create_child_share(
  p_child_id uuid,
  p_label text,
  p_scopes text[],
  p_expires_in_days integer default 30
)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
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
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children c where c.id = p_child_id and c.family_id = v_family) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;
  if char_length(v_label) not between 1 and 80 then
    raise exception 'invalid_label' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}') into v_scopes from unnest(p_scopes) s;
  if cardinality(v_scopes) = 0 or not (v_scopes <@ array['grades', 'prova', 'tasks_summary']::text[]) then
    raise exception 'invalid_scopes' using errcode = 'P0001';
  end if;
  if v_days not between 1 and 180 then
    raise exception 'invalid_expiry' using errcode = 'P0001';
  end if;
  -- Kötüye kullanıma karşı çocuk başına en fazla 20 etkin bağlantı.
  if (select count(*) from public.child_shares s
      where s.child_id = p_child_id and s.revoked_at is null and s.expires_at > now()) >= 20 then
    raise exception 'too_many_shares' using errcode = 'P0001';
  end if;

  -- 32 rastgele bayt → base64url (43 karakter, dolgusuz).
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/\n', '-_'), '=');

  insert into public.child_shares (family_id, child_id, created_by, label, scopes, token_hash, expires_at)
  values (v_family, p_child_id, auth.uid(), v_label, v_scopes,
          extensions.digest(v_token, 'sha256'), now() + make_interval(days => v_days))
  returning * into v_row;

  perform gina.share_audit('child_shares.create', v_row.id, v_family,
    jsonb_build_object('child_id', p_child_id, 'scopes', to_jsonb(v_scopes), 'expires_at', v_row.expires_at));

  id := v_row.id;
  token := v_token;
  expires_at := v_row.expires_at;
  return next;
end;
$$;

revoke execute on function public.create_child_share(uuid, text, text[], integer) from public, anon;
grant execute on function public.create_child_share(uuid, text, text[], integer) to authenticated;

create or replace function public.revoke_child_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.child_shares s
     set revoked_at = coalesce(s.revoked_at, now())
   where s.id = p_share_id and s.family_id = gina.family_id()
  returning s.family_id into v_family;
  if v_family is null then
    raise exception 'share_not_found' using errcode = 'P0001';
  end if;
  perform gina.share_audit('child_shares.revoke', p_share_id, v_family, '{}'::jsonb);
end;
$$;

revoke execute on function public.revoke_child_share(uuid) from public, anon;
grant execute on function public.revoke_child_share(uuid) to authenticated;

-- Herkese açık görünüm (anon) ------------------------------------------------------
-- Geçersiz, süresi dolmuş ve iptal edilmiş belirteçler aynı hatayı ('invalid_share') ve
-- benzer gecikmeyi verir: hangi durumun olduğu dışarı sızmaz, tahmin denemesi yavaşlar.
create or replace function public.get_shared_child_view(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
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
       and s.expires_at > now();
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
               where child_id = v_share.child_id
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

  return v_result;
end;
$$;

revoke execute on function public.get_shared_child_view(text) from public;
grant execute on function public.get_shared_child_view(text) to anon, authenticated;
