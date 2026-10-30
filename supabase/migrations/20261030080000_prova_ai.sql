-- Prova AI + veli değerlendirmesi: açık uçlu puanlama (AI / veli), deneme toplamları,
-- çalışma planları, AI kullanım günlüğü ve sunucu tarafı Prova paket kapısı.
-- Kurallar (docs/DECISIONS.md, docs/PROVA.md): çocuk AI ile etkileşmez; AI yalnız veli alanından
-- Edge Function'larla (prova-generate / prova-grade / prova-plan) tetiklenir ve service_role ile yazar.
-- Paket kapısı: ücretsiz = seviye tespiti + ayda 1 kütüphane denemesi; Plus = senaryolu deneme + AI üretim;
-- Pro = + açık uçlu AI değerlendirme + çalışma planı + kitapçık.
-- Tekrar uygulanabilir (if not exists / drop if exists + create or replace).

-- Paket kolonları (backoffice plans tablosundan düzenler) --------------------------------

alter table public.plans add column if not exists prova_monthly_exams smallint; -- null = sınırsız (yalnız 'practice')
alter table public.plans add column if not exists prova_scenarios boolean not null default false;
alter table public.plans add column if not exists prova_ai_generate_monthly smallint not null default 0; -- aylık AI soru kotası
alter table public.plans add column if not exists prova_ai_grading boolean not null default false;
alter table public.plans add column if not exists prova_study_plan boolean not null default false;
alter table public.plans add column if not exists prova_booklet boolean not null default false;

update public.plans set prova_monthly_exams = 1, prova_scenarios = false, prova_ai_generate_monthly = 0,
  prova_ai_grading = false, prova_study_plan = false, prova_booklet = false where code = 'free';
update public.plans set prova_monthly_exams = null, prova_scenarios = true, prova_ai_generate_monthly = 100,
  prova_ai_grading = false, prova_study_plan = false, prova_booklet = false where code = 'plus';
update public.plans set prova_monthly_exams = null, prova_scenarios = true, prova_ai_generate_monthly = 300,
  prova_ai_grading = true, prova_study_plan = true, prova_booklet = true where code = 'pro';

-- Cevap puanlama kolonları ---------------------------------------------------------

-- ai_score/ai_feedback: AI'nin ham çıktısı. score/feedback: geçerli (nihai) puan; veli puanı AI'yi ezer.
alter table public.exam_answers add column if not exists score smallint check (score between 0 and 100);
alter table public.exam_answers add column if not exists feedback text;
alter table public.exam_answers add column if not exists graded_by text check (graded_by in ('ai', 'parent'));
alter table public.exam_answers add column if not exists graded_at timestamptz;
alter table public.exam_answers add column if not exists ai_details jsonb; -- {eksikler: [], iyilestirme_onerileri: []}

-- Deneme toplamları: open_total = açık uçlu soru sayısı, open_graded = puanı olan (boş cevap 0 sayılır),
-- score_pct = tüm denemenin 0-100 puanı (şıklı doğru = 100, açık uçlu = score; puanlanmamışlar hariç).
alter table public.exam_attempts add column if not exists open_total int;
alter table public.exam_attempts add column if not exists open_graded int;
alter table public.exam_attempts add column if not exists score_pct smallint;
alter table public.exam_attempts add column if not exists graded_at timestamptz;

-- Çalışma planları ----------------------------------------------------------------

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  attempt_id uuid references public.exam_attempts (id) on delete set null,
  subject text not null,
  grade smallint not null,
  weak_topics jsonb not null default '[]'::jsonb, -- [{topic, pct, total}]
  plan jsonb not null default '{}'::jsonb, -- {ozet, gunler: [{gun, konu, etkinlik, sure_dk}], gorev_onerileri: [...]}
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  model text,
  prompt_version text,
  input_hash text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_plans_family_idx on public.study_plans (family_id, child_id, created_at desc);
drop trigger if exists study_plans_set_updated_at on public.study_plans;
create trigger study_plans_set_updated_at before update on public.study_plans
  for each row execute function gina.set_updated_at();

alter table public.study_plans enable row level security;
drop policy if exists study_plans_parent_select on public.study_plans;
create policy study_plans_parent_select on public.study_plans
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
drop policy if exists study_plans_parent_delete on public.study_plans;
create policy study_plans_parent_delete on public.study_plans
  for delete to authenticated using (family_id = gina.family_id() and gina.is_parent());
-- Yazma: service_role (prova-plan); durum değişikliği set_study_plan_status RPC'siyle. Cihaz göremez.

-- AI kullanım günlüğü (kota + maliyet izi) ------------------------------------------------

create table if not exists public.prova_ai_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  action text not null check (action in ('generate', 'grade', 'plan')),
  model text,
  items int not null default 0, -- üretilen soru / puanlanan cevap / plan sayısı
  input_tokens int,
  output_tokens int,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists prova_ai_usage_family_idx on public.prova_ai_usage (family_id, action, created_at desc);

alter table public.prova_ai_usage enable row level security;
drop policy if exists prova_ai_usage_parent_select on public.prova_ai_usage;
create policy prova_ai_usage_parent_select on public.prova_ai_usage
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
drop policy if exists prova_ai_usage_admin_select on public.prova_ai_usage;
create policy prova_ai_usage_admin_select on public.prova_ai_usage
  for select to authenticated using (gina.is_admin());

-- Yardımcılar -------------------------------------------------------------------

-- Ailenin etkin paketi, claim kontrolü OLMADAN (yalnız iç kullanım: tetikleyiciler, service_role RPC'leri).
-- get_family_entitlement ile aynı öncelik: aktif mağaza aboneliği (grace dahil) > aktif komp > free.
create or replace function gina.family_plan_of(p_family_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = public
as $$
  select pl.* from public.plans pl
  where pl.code = coalesce((
    select u.plan from (
      select s.plan, s.expires_at from public.store_subscriptions s
      where s.family_id = p_family_id and s.status in ('active', 'grace') and s.expires_at > now()
      union all
      select o.plan, o.ends_at from public.entitlement_overrides o
      where o.family_id = p_family_id and o.revoked_at is null and o.starts_at <= now() and o.ends_at > now()
    ) u
    order by gina.plan_rank(u.plan) desc, u.expires_at desc
    limit 1
  ), 'free'::public.plan_code);
$$;

-- Ailenin yerel ayının başlangıcı (UTC zaman damgası olarak).
create or replace function gina.family_month_start(p_family_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select (date_trunc('month', now() at time zone tz) at time zone tz)
  from (select coalesce((select f.timezone from public.families f where f.id = p_family_id), 'Europe/Istanbul') as tz) x;
$$;

-- Çağıran service_role mı (Edge Function)?
create or replace function gina.is_service()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

revoke execute on function gina.family_plan_of(uuid), gina.family_month_start(uuid), gina.is_service() from public, anon;
grant execute on function gina.family_plan_of(uuid), gina.family_month_start(uuid), gina.is_service() to authenticated, service_role;

-- Prova yetkisi + bu ayki kullanım. Veli kendi ailesi için (parametresiz), service_role herhangi bir aile için.
create or replace function public.get_prova_entitlement(p_family_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_plan public.plans;
  v_month timestamptz;
begin
  if gina.is_parent() then
    v_family := gina.family_id();
  elsif gina.is_service() or gina.is_admin() then
    v_family := p_family_id;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_family is null then
    raise exception 'family_required' using errcode = 'P0001';
  end if;

  v_plan := gina.family_plan_of(v_family);
  v_month := gina.family_month_start(v_family);
  return jsonb_build_object(
    'plan', v_plan.code,
    'monthly_exams_limit', v_plan.prova_monthly_exams,
    'monthly_exams_used', (
      select count(*) from public.exams e
      where e.family_id = v_family and e.kind = 'practice' and e.created_at >= v_month
    ),
    'scenarios', v_plan.prova_scenarios,
    'ai_generate_limit', v_plan.prova_ai_generate_monthly,
    'ai_generate_used', (
      select coalesce(sum(u.items), 0) from public.prova_ai_usage u
      where u.family_id = v_family and u.action = 'generate' and u.created_at >= v_month
    ),
    'ai_grading', v_plan.prova_ai_grading,
    'study_plan', v_plan.prova_study_plan,
    'booklet', v_plan.prova_booklet
  );
end;
$$;

-- Paket kapısı: kütüphane denemesi (practice) sınırı ve senaryo kullanımı. Seviye tespiti serbest.
create or replace function gina.enforce_prova_exam_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans;
  v_count int;
begin
  if new.kind <> 'practice' then
    return new;
  end if;
  v_plan := gina.family_plan_of(new.family_id);
  if new.blueprint_id is not null and not v_plan.prova_scenarios then
    raise exception 'plan_limit_prova_scenarios' using errcode = 'P0001';
  end if;
  if v_plan.prova_monthly_exams is not null then
    select count(*) into v_count from public.exams e
      where e.family_id = new.family_id and e.kind = 'practice'
        and e.created_at >= gina.family_month_start(new.family_id);
    if v_count >= v_plan.prova_monthly_exams then
      raise exception 'plan_limit_prova_exams' using errcode = 'P0001',
        detail = format('limit=%s', v_plan.prova_monthly_exams);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists exams_prova_plan_limit on public.exams;
create trigger exams_prova_plan_limit before insert on public.exams
  for each row execute function gina.enforce_prova_exam_limits();

-- Deneme toplamlarını yeniden hesaplar; tüm açık uçlular puanlıysa durumu 'graded' yapar.
create or replace function gina.recompute_attempt_totals(p_attempt_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.exam_attempts%rowtype;
begin
  with items as (
    select q.kind,
           case
             when q.kind = 'multiple_choice' then case when coalesce(ans.is_correct, false) then 100 else 0 end
             when ans.score is not null then ans.score
             when coalesce(trim(ans.answer_text), '') = '' then 0 -- boş açık uçlu: 0
             else null -- puan bekliyor
           end as value
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join unnest(e.question_ids) qid on true
    join public.question_bank q on q.id = qid
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where a.id = p_attempt_id
  ),
  agg as (
    select count(*) filter (where kind = 'open_ended')::int as open_total,
           count(*) filter (where kind = 'open_ended' and value is not null)::int as open_graded,
           round(avg(value))::smallint as score_pct
    from items
  )
  update public.exam_attempts a
  set open_total = agg.open_total,
      open_graded = agg.open_graded,
      score_pct = agg.score_pct,
      status = case
        when a.status in ('submitted', 'graded') and agg.open_graded = agg.open_total then 'graded'::public.attempt_status
        when a.status = 'graded' then 'submitted'::public.attempt_status
        else a.status end,
      graded_at = case when a.status in ('submitted', 'graded') and agg.open_graded = agg.open_total then now() else null end
  from agg
  where a.id = p_attempt_id
  returning a.* into v_row;
  return v_row;
end;
$$;

revoke execute on function gina.recompute_attempt_totals(uuid) from public, anon, authenticated;
grant execute on function gina.recompute_attempt_totals(uuid) to service_role;

-- Bitirilen denemede toplamları hemen doldur (şıklı-only denemeler doğrudan 'graded' olur).
create or replace function gina.after_attempt_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform gina.recompute_attempt_totals(new.id);
  return null;
end;
$$;

drop trigger if exists exam_attempts_recompute on public.exam_attempts;
create trigger exam_attempts_recompute after update of status on public.exam_attempts
  for each row when (old.status = 'in_progress' and new.status = 'submitted')
  execute function gina.after_attempt_finished();

-- RPC'ler --------------------------------------------------------------------------

-- Veli açık uçlu bir cevabı elle puanlar (AI puanını ezer); deneme toplamlarını yeniler.
drop function if exists public.score_open_answer(uuid, uuid, smallint, text);
create or replace function public.score_open_answer(p_attempt_id uuid, p_question_id uuid, p_score smallint, p_feedback text default null)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'invalid_score' using errcode = 'P0001';
  end if;
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id();
  if v_attempt.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'attempt_not_finished' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.exams e join public.question_bank q on q.id = p_question_id
    where e.id = v_attempt.exam_id and p_question_id = any (e.question_ids) and q.kind = 'open_ended'
  ) then
    raise exception 'question_not_open_ended' using errcode = 'P0001';
  end if;

  insert into public.exam_answers (attempt_id, question_id, score, feedback, graded_by, graded_at)
  values (p_attempt_id, p_question_id, p_score, nullif(trim(p_feedback), ''), 'parent', now())
  on conflict (attempt_id, question_id) do update
    set score = excluded.score,
        feedback = excluded.feedback,
        graded_by = 'parent',
        graded_at = now();

  return gina.recompute_attempt_totals(p_attempt_id);
end;
$$;

-- prova-grade (service_role) AI puanlarını yazar. Veli puanı varsa score/feedback'e dokunmaz.
-- p_grades: [{question_id, score, kisa_geri_bildirim, eksikler: [], iyilestirme_onerileri: []}]
create or replace function public.apply_ai_grades(p_attempt_id uuid, p_grades jsonb, p_summary jsonb default null)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  g jsonb;
  v_score smallint;
begin
  if not gina.is_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for g in select * from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) loop
    v_score := greatest(0, least(100, round((g ->> 'score')::numeric)))::smallint;
    update public.exam_answers ans
    set ai_score = v_score,
        ai_feedback = g ->> 'kisa_geri_bildirim',
        ai_details = jsonb_build_object(
          'eksikler', coalesce(g -> 'eksikler', '[]'::jsonb),
          'iyilestirme_onerileri', coalesce(g -> 'iyilestirme_onerileri', '[]'::jsonb)
        ),
        score = case when ans.graded_by = 'parent' then ans.score else v_score end,
        feedback = case when ans.graded_by = 'parent' then ans.feedback else g ->> 'kisa_geri_bildirim' end,
        graded_by = case when ans.graded_by = 'parent' then 'parent' else 'ai' end,
        graded_at = case when ans.graded_by = 'parent' then ans.graded_at else now() end
    where ans.attempt_id = p_attempt_id and ans.question_id = (g ->> 'question_id')::uuid;
  end loop;
  if p_summary is not null then
    update public.exam_attempts set ai_feedback = p_summary where id = p_attempt_id;
  end if;
  return gina.recompute_attempt_totals(p_attempt_id);
end;
$$;

-- Denemenin konu bazlı sonucu (çalışma planı ve inceleme ekranı). pct: 0-100, pending: puan bekleyen.
create or replace function public.get_attempt_topic_stats(p_attempt_id uuid)
returns table (topic text, total int, pending int, pct int)
language sql
stable
security definer
set search_path = public
as $$
  with items as (
    select q.topic,
           case
             when q.kind = 'multiple_choice' then case when coalesce(ans.is_correct, false) then 100 else 0 end
             when ans.score is not null then ans.score
             when coalesce(trim(ans.answer_text), '') = '' then 0
             else null
           end as value
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join unnest(e.question_ids) qid on true
    join public.question_bank q on q.id = qid
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where a.id = p_attempt_id
      and ((gina.is_parent() and a.family_id = gina.family_id()) or gina.is_service())
  )
  select i.topic, count(*)::int, count(*) filter (where i.value is null)::int,
         case when count(i.value) > 0 then round(avg(i.value))::int end
  from items i
  group by i.topic
  order by 4 nulls last, 1;
$$;

-- Veli planı onaylar / arşivler.
create or replace function public.set_study_plan_status(p_plan_id uuid, p_status text)
returns public.study_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.study_plans%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'approved', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.study_plans set status = p_status
    where id = p_plan_id and family_id = gina.family_id()
    returning * into v_row;
  if v_row.id is null then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

revoke execute on function
  public.get_prova_entitlement(uuid),
  public.score_open_answer(uuid, uuid, smallint, text),
  public.apply_ai_grades(uuid, jsonb, jsonb),
  public.get_attempt_topic_stats(uuid),
  public.set_study_plan_status(uuid, text)
from public, anon;
grant execute on function
  public.get_prova_entitlement(uuid),
  public.score_open_answer(uuid, uuid, smallint, text),
  public.get_attempt_topic_stats(uuid),
  public.set_study_plan_status(uuid, text)
to authenticated, service_role;
revoke execute on function public.apply_ai_grades(uuid, jsonb, jsonb) from authenticated;
grant execute on function public.apply_ai_grades(uuid, jsonb, jsonb) to service_role;

-- Var olan bitmiş denemelerin toplamlarını doldur.
do $do$
declare r record;
begin
  for r in select id from public.exam_attempts where status in ('submitted', 'graded') and open_total is null loop
    perform gina.recompute_attempt_totals(r.id);
  end loop;
end
$do$;
