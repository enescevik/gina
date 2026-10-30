-- Prova: seviye tespiti (dengeli soru seçimi) ve konu bazlı hakimiyet.
-- exams.kind kolonu 20261030040000_prova.sql'de var ('practice' | 'level_test'); burada yalnız RPC'ler eklenir.
-- Yeni tablo yok; RPC'ler security definer ve gina.* yardımcılarıyla aileye/veliye kilitlidir.
-- Tekrar uygulanabilir (drop if exists + create or replace).

drop function if exists public.pick_level_questions(text, smallint, uuid, int, int);
drop function if exists public.create_level_test(uuid, text, smallint, uuid, int, int, text, boolean, smallint);
drop function if exists public.child_topic_mastery(uuid);

-- Zorluk sırası: kolay=0, orta=1, orta_ustu=2, zor=3.
create or replace function gina.difficulty_ord(p public.question_difficulty)
returns int
language sql
immutable
as $$
  select case p when 'kolay' then 0 when 'orta' then 1 when 'orta_ustu' then 2 else 3 end;
$$;

-- Seviye tespiti için dengeli soru seti seçer (önizleme + create_level_test kullanır).
-- Konular: senaryo verilmişse onun satırları (sırasıyla, satırdaki sayı konu başı kota), yoksa
-- ders+sınıftaki tüm konular (p_per_topic). Her konuda zorluklar dönüşümlü seçilir; konu sırası
-- başlangıç zorluğunu kaydırır, böylece toplamda kolay→zor dengeli dağılır. Az sorulan önce gelir.
-- Toplam p_max_questions'la sınırlanır (önce her konudan 1., sonra 2. soru…); sonuç kolaydan zora sıralı.
create or replace function public.pick_level_questions(
  p_subject text,
  p_grade smallint,
  p_blueprint_id uuid default null,
  p_per_topic int default 3,
  p_max_questions int default 24
)
returns table (question_id uuid, topic text, difficulty public.question_difficulty, ord int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_blueprint_id is not null and not exists (
    select 1 from public.exam_blueprints b where b.id = p_blueprint_id and b.family_id = gina.family_id()
  ) then
    raise exception 'blueprint_not_found' using errcode = 'P0001';
  end if;

  return query
  with pool as (
    select q.id, q.topic, q.difficulty, q.times_asked
    from public.question_bank q
    where (q.family_id = gina.family_id() or q.family_id is null)
      and q.grade = p_grade
      and lower(q.subject) = lower(trim(p_subject))
  ),
  topics as (
    -- Senaryodan: satır sırası + satırdaki sayı (0 ise p_per_topic).
    select lower(trim(r.value ->> 'topic')) as tkey,
           (r.ordinality - 1)::int as tidx,
           greatest(1, coalesce(nullif((r.value ->> 'count')::int, 0), p_per_topic)) as quota
    from public.exam_blueprints b,
         jsonb_array_elements(b.rows) with ordinality r(value, ordinality)
    where p_blueprint_id is not null and b.id = p_blueprint_id
    union all
    -- Senaryosuz: havuzdaki tüm konular, alfabetik.
    select t.tkey, (row_number() over (order by t.tkey) - 1)::int, greatest(1, p_per_topic)
    from (select distinct lower(trim(p.topic)) as tkey from pool p) t
    where p_blueprint_id is null
  ),
  ranked as (
    select p.id, p.topic, p.difficulty, t.tidx, t.quota,
           gina.difficulty_ord(p.difficulty) as dord,
           row_number() over (partition by t.tidx, p.difficulty order by p.times_asked, random()) as rn_d
    from pool p
    join topics t on t.tkey = lower(trim(p.topic))
  ),
  per_topic as (
    -- Konu t için zorluk tercih sırası: t, t+2, t+1, t+3 (mod 4) → her konu farklı zorlukla başlar.
    select r.*,
           row_number() over (
             partition by r.tidx
             order by r.rn_d,
                      case mod(r.dord - r.tidx + 400, 4) when 0 then 0 when 2 then 1 when 1 then 2 else 3 end
           ) as trank
    from ranked r
  ),
  capped as (
    select pt.*
    from per_topic pt
    where pt.trank <= pt.quota
    order by pt.trank, pt.tidx
    limit greatest(1, least(p_max_questions, 60))
  )
  select c.id, c.topic, c.difficulty,
         (row_number() over (order by c.dord, c.tidx, c.trank))::int
  from capped c
  order by 4;
end;
$$;

-- Seviye tespiti denemesini oluşturur ve çocuğa atar (exams.kind = 'level_test').
create or replace function public.create_level_test(
  p_child_id uuid,
  p_subject text,
  p_grade smallint,
  p_blueprint_id uuid default null,
  p_per_topic int default 3,
  p_max_questions int default 24,
  p_title text default null,
  p_timed boolean default false,
  p_duration_minutes smallint default null
)
returns public.exams
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_row public.exams%rowtype;
begin
  if not gina.is_parent() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.children c where c.id = p_child_id and c.family_id = gina.family_id()) then
    raise exception 'child_not_found' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_subject), '') = '' then
    raise exception 'subject_required' using errcode = 'P0001';
  end if;
  if p_timed and p_duration_minutes is null then
    raise exception 'duration_required' using errcode = 'P0001';
  end if;

  select array_agg(x.question_id order by x.ord) into v_ids
  from public.pick_level_questions(p_subject, p_grade, p_blueprint_id, p_per_topic, p_max_questions) x;
  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;

  insert into public.exams (family_id, child_id, blueprint_id, title, subject, grade, kind, question_ids, timed, duration_minutes, status, created_by)
  values (
    gina.family_id(), p_child_id, p_blueprint_id,
    coalesce(nullif(trim(p_title), ''), trim(p_subject)),
    trim(p_subject), p_grade, 'level_test', v_ids,
    coalesce(p_timed, false), case when p_timed then p_duration_minutes end,
    'assigned', auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Çocuğun konu bazlı hakimiyeti: bitmiş denemelerdeki (submitted/graded) tüm sorular.
-- Şıklı: doğru 1, yanlış/boş 0. Açık uçlu: coalesce(score, ai_score)/100; puanlanmamışsa «bekleyen» sayılır, skora girmez.
-- score: yakın tarihli denemeler ağır basar (yarı ömür 30 gün), 0-100. accuracy: ağırlıksız oran.
create or replace function public.child_topic_mastery(p_child_id uuid)
returns table (
  subject text,
  grade smallint,
  topic text,
  total int,
  correct numeric,
  pending int,
  accuracy int,
  score int,
  level_total int,
  last_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with items as (
    select q.subject, q.grade, q.topic, e.kind,
           a.finished_at,
           case
             when q.kind = 'multiple_choice' then coalesce(ans.is_correct, false)::int::numeric
             when ans.attempt_id is null then 0 -- boş bırakılan açık uçlu
             -- Nihai puan exam_answers.score (20261030080000_prova_ai: veli puanı > AI); yoksa ham ai_score.
             -- to_jsonb ile okunur ki kolon henüz yokken de fonksiyon derlensin.
             else coalesce((to_jsonb(ans) ->> 'score')::numeric, ans.ai_score::numeric) / 100
           end as value,
           power(0.5, greatest(0, extract(epoch from (now() - coalesce(a.finished_at, a.started_at))) / 86400.0) / 30.0) as w
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join unnest(e.question_ids) qid on true
    join public.question_bank q on q.id = qid
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where a.child_id = p_child_id
      and a.family_id = gina.family_id()
      and gina.is_parent()
      and a.status in ('submitted', 'graded')
  )
  select i.subject, max(i.grade)::smallint, i.topic,
         count(*) filter (where i.value is not null)::int as total,
         round(coalesce(sum(i.value), 0), 2) as correct,
         count(*) filter (where i.value is null)::int as pending,
         case when count(i.value) > 0 then round(100 * avg(i.value))::int end as accuracy,
         case when sum(i.w) filter (where i.value is not null) > 0
              then round(100 * sum(i.w * i.value) / sum(i.w) filter (where i.value is not null))::int end as score,
         count(*) filter (where i.kind = 'level_test' and i.value is not null)::int as level_total,
         max(i.finished_at) as last_at
  from items i
  group by i.subject, i.topic
  order by i.subject, score nulls last, i.topic;
$$;

revoke execute on function
  gina.difficulty_ord(public.question_difficulty),
  public.pick_level_questions(text, smallint, uuid, int, int),
  public.create_level_test(uuid, text, smallint, uuid, int, int, text, boolean, smallint),
  public.child_topic_mastery(uuid)
from public, anon;
grant execute on function
  gina.difficulty_ord(public.question_difficulty),
  public.pick_level_questions(text, smallint, uuid, int, int),
  public.create_level_test(uuid, text, smallint, uuid, int, int, text, boolean, smallint),
  public.child_topic_mastery(uuid)
to authenticated, service_role;
