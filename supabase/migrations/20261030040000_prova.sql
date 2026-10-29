-- Prova modülü: soru kütüphanesi, senaryolar (blueprint), denemeler, cevaplar.
-- docs/PROVA.md işleyişi anlatır. Çocuk cihazı yalnız kendine atanmış denemeleri görür ve
-- cevaplarını RPC ile yazar; kütüphane, senaryolar ve sonuç değerlendirmesi veli alanındadır.

create type public.question_kind as enum ('multiple_choice', 'open_ended');
create type public.question_difficulty as enum ('kolay', 'orta', 'orta_ustu', 'zor');
create type public.exam_status as enum ('draft', 'ready', 'assigned', 'completed');
create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');

-- Soru kütüphanesi -----------------------------------------------------------

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade, -- null = global (admin) içerik
  grade smallint not null check (grade between 1 and 12),
  subject text not null,
  topic text not null,
  scenario_code text, -- ör. 'Senaryo 2'
  kind public.question_kind not null,
  difficulty public.question_difficulty not null default 'orta',
  stem text not null, -- soru metni
  choices jsonb, -- şıklı: [{"key":"A","text":"..."}, ...]
  correct_key text, -- şıklı: doğru şık
  expected_answer text, -- açık uçlu: beklenen cevap
  solution text, -- çözüm yolu
  explanation text, -- anlatım
  source_urls text[] not null default '{}',
  provenance jsonb not null default '{}'::jsonb, -- {generator, model, prompt, prompt_version, requested_by}
  times_asked int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'multiple_choice' or (choices is not null and correct_key is not null))
);
create index question_bank_lookup_idx on public.question_bank (grade, subject, topic);
create index question_bank_family_idx on public.question_bank (family_id);
create trigger question_bank_set_updated_at before update on public.question_bank
  for each row execute function gina.set_updated_at();

-- Senaryolar (MEB konu-soru dağılım tabloları) --------------------------------------

create table public.exam_blueprints (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  grade smallint not null check (grade between 1 and 12),
  subject text not null,
  name text not null, -- 'Senaryo 2'
  rows jsonb not null default '[]'::jsonb, -- [{"topic":"...","count":3}, ...]
  source_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index exam_blueprints_family_idx on public.exam_blueprints (family_id, subject);

-- Denemeler ------------------------------------------------------------------

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  blueprint_id uuid references public.exam_blueprints (id) on delete set null,
  title text not null,
  subject text not null,
  grade smallint not null,
  kind text not null default 'practice' check (kind in ('practice', 'level_test')),
  question_ids uuid[] not null default '{}',
  timed boolean not null default false,
  duration_minutes smallint check (duration_minutes between 1 and 240),
  status public.exam_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not timed or duration_minutes is not null)
);
create index exams_child_idx on public.exams (child_id, status);
create trigger exams_set_updated_at before update on public.exams
  for each row execute function gina.set_updated_at();

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  deadline_at timestamptz, -- süreli denemede started_at + süre
  mc_total int,
  mc_correct int,
  ai_feedback jsonb, -- {konu_bazli: [...], eksikler: [...], oneriler: [...]} (prova-grade yazar)
  created_at timestamptz not null default now()
);
create index exam_attempts_exam_idx on public.exam_attempts (exam_id, child_id);

create table public.exam_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete cascade,
  answer_key text, -- şıklı
  answer_text text, -- açık uçlu
  is_correct boolean, -- şıklı: otomatik
  ai_score smallint check (ai_score between 0 and 100),
  ai_feedback text,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- RLS ------------------------------------------------------------------------

alter table public.question_bank enable row level security;
alter table public.exam_blueprints enable row level security;
alter table public.exams enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;

-- Kütüphane: veli kendi ailesininkini yönetir; global (family_id null) içerik herkese okunur, admin yazar.
create policy question_bank_parent_all on public.question_bank
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());
create policy question_bank_global_select on public.question_bank
  for select to authenticated using (family_id is null);
create policy question_bank_admin_all on public.question_bank
  for all to authenticated using (gina.is_admin()) with check (gina.is_admin());
-- Cihaz: yalnız atanmış denemesindeki soruları RPC üzerinden görür (aşağıda get_attempt_questions).

create policy exam_blueprints_parent_all on public.exam_blueprints
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());

create policy exams_parent_all on public.exams
  for all to authenticated
  using (family_id = gina.family_id() and gina.is_parent())
  with check (family_id = gina.family_id() and gina.is_parent());
create policy exams_device_select on public.exams
  for select to authenticated
  using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id() and status in ('assigned', 'completed'));

create policy exam_attempts_parent_select on public.exam_attempts
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
create policy exam_attempts_device_select on public.exam_attempts
  for select to authenticated using (family_id = gina.family_id() and gina.is_device() and child_id = gina.child_id());
-- Yazma yalnız RPC.

create policy exam_answers_parent_select on public.exam_answers
  for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.family_id = gina.family_id() and gina.is_parent()));
create policy exam_answers_device_select on public.exam_answers
  for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.family_id = gina.family_id() and gina.is_device() and a.child_id = gina.child_id()));

-- RPC'ler ----------------------------------------------------------------------

-- Deneme çözen taraf (cihaz ya da veli-telefonu çocuk modu) soruları şıksız cevap anahtarı OLMADAN alır.
create or replace function public.get_attempt_questions(p_exam_id uuid)
returns table (id uuid, kind public.question_kind, difficulty public.question_difficulty, stem text, choices jsonb, ord int)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.kind, q.difficulty, q.stem,
         case when q.kind = 'multiple_choice'
              then (select jsonb_agg(c - 'is_correct') from jsonb_array_elements(q.choices) c)
              else null end as choices,
         u.ord::int as ord
  from public.exams e
  join unnest(e.question_ids) with ordinality u(qid, ord) on true
  join public.question_bank q on q.id = u.qid
  where e.id = p_exam_id
    and e.family_id = gina.family_id()
    and (gina.is_parent() or (gina.is_device() and e.child_id = gina.child_id()))
    and e.status in ('assigned', 'completed')
  order by u.ord;
$$;

-- Denemeyi başlatır (tek aktif attempt).
create or replace function public.start_exam_attempt(p_exam_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.exams%rowtype;
  v_child uuid;
  v_row public.exam_attempts%rowtype;
begin
  select * into v_exam from public.exams where id = p_exam_id and family_id = gina.family_id();
  if v_exam.id is null or v_exam.status <> 'assigned' then
    raise exception 'exam_not_assigned' using errcode = 'P0001';
  end if;
  if gina.is_device() then
    v_child := gina.child_id();
  elsif gina.is_parent() then
    v_child := v_exam.child_id; -- telefonda çocuk modu
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_child is distinct from v_exam.child_id then
    raise exception 'wrong_child' using errcode = 'P0001';
  end if;

  select * into v_row from public.exam_attempts
    where exam_id = p_exam_id and child_id = v_child and status = 'in_progress'
    limit 1;
  if v_row.id is not null then
    return v_row; -- devam eden deneme
  end if;

  insert into public.exam_attempts (family_id, exam_id, child_id, deadline_at)
  values (
    v_exam.family_id, v_exam.id, v_child,
    case when v_exam.timed then now() + make_interval(mins => v_exam.duration_minutes) end
  )
  returning * into v_row;
  update public.question_bank set times_asked = times_asked + 1 where id = any (v_exam.question_ids);
  return v_row;
end;
$$;

-- Cevap yazar; şıklıyı anında puanlar. Süre dolduysa reddeder.
create or replace function public.submit_exam_answer(p_attempt_id uuid, p_question_id uuid, p_answer_key text default null, p_answer_text text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_question public.question_bank%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id();
  if v_attempt.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if gina.is_device() and v_attempt.child_id <> gina.child_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (gina.is_device() or gina.is_parent()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = 'P0001';
  end if;
  if v_attempt.deadline_at is not null and now() > v_attempt.deadline_at then
    update public.exam_attempts set status = 'submitted', finished_at = v_attempt.deadline_at where id = p_attempt_id;
    raise exception 'time_up' using errcode = 'P0001';
  end if;

  select * into v_question from public.question_bank where id = p_question_id;
  if v_question.id is null or not exists (
    select 1 from public.exams e where e.id = v_attempt.exam_id and p_question_id = any (e.question_ids)
  ) then
    raise exception 'question_not_in_exam' using errcode = 'P0001';
  end if;

  insert into public.exam_answers (attempt_id, question_id, answer_key, answer_text, is_correct)
  values (
    p_attempt_id, p_question_id, p_answer_key, p_answer_text,
    case when v_question.kind = 'multiple_choice' then p_answer_key = v_question.correct_key end
  )
  on conflict (attempt_id, question_id) do update
    set answer_key = excluded.answer_key,
        answer_text = excluded.answer_text,
        is_correct = excluded.is_correct,
        answered_at = now();
end;
$$;

-- Denemeyi bitirir; şıklı özetini yazar. Açık uçlular prova-grade (Faz B) ile puanlanır.
create or replace function public.finish_exam_attempt(p_attempt_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id();
  if v_attempt.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if gina.is_device() and v_attempt.child_id <> gina.child_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (gina.is_device() or gina.is_parent()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    return v_attempt;
  end if;

  update public.exam_attempts a
  set status = 'submitted',
      finished_at = now(),
      mc_total = (
        select count(*) from public.exams e
        join unnest(e.question_ids) qid on true
        join public.question_bank q on q.id = qid
        where e.id = a.exam_id and q.kind = 'multiple_choice'
      ),
      mc_correct = (
        select count(*) from public.exam_answers ans
        where ans.attempt_id = a.id and ans.is_correct
      )
  where a.id = p_attempt_id
  returning * into v_attempt;

  update public.exams set status = 'completed' where id = v_attempt.exam_id;
  return v_attempt;
end;
$$;

revoke execute on function
  public.get_attempt_questions(uuid), public.start_exam_attempt(uuid),
  public.submit_exam_answer(uuid, uuid, text, text), public.finish_exam_attempt(uuid)
from public, anon;
grant execute on function
  public.get_attempt_questions(uuid), public.start_exam_attempt(uuid),
  public.submit_exam_answer(uuid, uuid, text, text), public.finish_exam_attempt(uuid)
to authenticated, service_role;

-- Realtime: deneme durumu değişince veli/çocuk ekranları yenilenir.
alter publication supabase_realtime add table public.exam_attempts;
