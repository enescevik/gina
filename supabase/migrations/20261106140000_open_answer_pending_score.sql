-- P04 puanlama kuralı düzeltmesi (Q00-A2-1 P0, Q00-A2-2 P1; docs/release/experience-review/SCREEN-REVIEW-MATRIX-A2.md).
-- Eski kural: açık uçlu cevapta yalnız answer_text'e bakılır; boş metin = 0 puan = "puanlandı". Yalnız çizimle
-- (answer_document) verilen cevap boş sayılıp 0 alıyor, deneme 'graded' oluyordu; veli "0/100 · 2/2 puanlandı"
-- görürken çocuk "ebeveynin inceleyecek" görüyordu.
-- Yeni kural (docs/CLAUDE-REMAINING-WORK.md P04 kabul: "eksik puan ara sonuç, sıfır değil"):
--   * metin VEYA çizim/metin kutusu olan açık uçlu cevap → puan bekliyor (score null, open_pending);
--   * ne metin ne çizim olan cevap → "cevap yok" (score null, open_unanswered); otomatik 0 verilmez, veli
--     incelemede açıkça 0 verebilir (score_open_answer / save_answer_review mevcut yol);
--   * score_pct yalnız puanlanmış sorulardan (şıklı + puanlı açık uçlu) hesaplanır; provisional = eksik var;
--   * şıklı sorular etkilenmez; deneme ancak tüm açık uçlular puanlıysa 'graded' olur (enum değişmez; "pending_review"
--     türetilmiş durumdur: status='submitted' ve provisional).
-- Geçmiş kayıtlar: bu migration hiçbir denemeyi yeniden hesaplamaz. Yalnız yeni finish / recompute çağrıları
-- (bitirme, veli puanı, AI puanı) yeni kuralı uygular. Geriye dönük düzeltme ayrı karardır.
-- Tekrar uygulanabilir.

alter table public.exam_attempts add column if not exists open_pending int;    -- puan bekleyen açık uçlu (cevap var)
alter table public.exam_attempts add column if not exists open_unanswered int; -- cevap yok (ne metin ne çizim)
alter table public.exam_attempts add column if not exists provisional boolean; -- eksik puan var: score_pct ara sonuç

comment on column public.exam_attempts.open_graded is 'Puanı olan açık uçlu soru sayısı (boş cevap otomatik 0 sayılmaz; 2026-11-06 P04).';
comment on column public.exam_attempts.open_pending is 'Cevabı (metin/çizim) olan, puanı bekleyen açık uçlu soru sayısı.';
comment on column public.exam_attempts.open_unanswered is 'Ne metin ne çizim içeren açık uçlu soru sayısı; veli açıkça 0 verebilir.';
comment on column public.exam_attempts.provisional is 'true: açık uçlularda eksik puan var, score_pct yalnız puanlı sorulardan hesaplanan ara sonuç.';

-- Açık uçlu cevapta değerlendirilecek bir şey var mı? Metin ya da defterde en az bir çizgi / dolu metin kutusu.
-- Yalnız yapıştırılmış kaynak görseli ('source') cevap sayılmaz (education_reports ile aynı kural).
create or replace function gina.open_answer_present(p_text text, p_document jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(p_text), '') is not null
      or exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(p_document -> 'elements') = 'array' then p_document -> 'elements' else '[]'::jsonb end
        ) e
        where e ->> 'type' = 'stroke'
           or (e ->> 'type' = 'text' and nullif(trim(e ->> 'text'), '') is not null)
      );
$$;
revoke all on function gina.open_answer_present(text, jsonb) from public, anon;
grant execute on function gina.open_answer_present(text, jsonb) to authenticated, service_role;

-- Tek açık uçlu cevabın durumu: graded | pending | unanswered.
create or replace function gina.open_answer_state(p_score smallint, p_text text, p_document jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_score is not null then 'graded'
    when gina.open_answer_present(p_text, p_document) then 'pending'
    else 'unanswered'
  end;
$$;
revoke all on function gina.open_answer_state(smallint, text, jsonb) from public, anon;
grant execute on function gina.open_answer_state(smallint, text, jsonb) to authenticated, service_role;

-- Deneme toplamlarını yeniden hesaplar; tüm açık uçlular puanlıysa durumu 'graded' yapar.
-- Boş açık uçlu cevap artık 0 sayılmaz: 'cevap yok' olarak ayrı sayılır ve puan bekler.
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
             else ans.score::int -- açık uçlu: yalnız verilmiş puan; boş/çizim → null (bekliyor)
           end as value,
           case when q.kind = 'open_ended' then gina.open_answer_state(ans.score, ans.answer_text, ans.answer_document) end as open_state
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
    join unnest(e.question_ids) qid on true
    join public.question_bank q on q.id = qid
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where a.id = p_attempt_id
  ),
  agg as (
    select count(*) filter (where kind = 'open_ended')::int as open_total,
           count(*) filter (where open_state = 'graded')::int as open_graded,
           count(*) filter (where open_state = 'pending')::int as open_pending,
           count(*) filter (where open_state = 'unanswered')::int as open_unanswered,
           round(avg(value))::smallint as score_pct -- yalnız puanlı maddeler; hiç yoksa null
    from items
  )
  update public.exam_attempts a
  set open_total = agg.open_total,
      open_graded = agg.open_graded,
      open_pending = agg.open_pending,
      open_unanswered = agg.open_unanswered,
      score_pct = agg.score_pct,
      provisional = (agg.open_graded < agg.open_total),
      status = case
        when a.status in ('submitted', 'graded') and agg.open_graded = agg.open_total then 'graded'::public.attempt_status
        when a.status = 'graded' then 'submitted'::public.attempt_status
        else a.status end,
      graded_at = case
        when a.status in ('submitted', 'graded') and agg.open_graded = agg.open_total then coalesce(a.graded_at, now())
        else null end
  from agg
  where a.id = p_attempt_id
  returning a.* into v_row;
  return v_row;
end;
$$;
revoke execute on function gina.recompute_attempt_totals(uuid) from public, anon, authenticated;
grant execute on function gina.recompute_attempt_totals(uuid) to service_role;

-- Bitirme: yanıt artık yeniden hesaplanmış toplamları taşır (AFTER tetikleyici de aynı sonucu üretir; idempotent).
create or replace function public.finish_exam_attempt(p_attempt_id uuid)
returns public.exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and family_id = gina.family_id() for update;
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
  where a.id = p_attempt_id;

  update public.exams set status = 'completed' where id = v_attempt.exam_id;
  return gina.recompute_attempt_totals(p_attempt_id);
end;
$$;

-- Konu bazlı sonuç: boş açık uçlu artık 0 değil, puan bekleyen (pending) sayılır. İmza değişmez.
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
             else ans.score::int
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

-- Deneme özeti (veli, çocuk cihazı, servis). Geriye uyumlu: mevcut sütunlar + pending_open_count,
-- unanswered_open_count, provisional, review_state. Eski kayıtlarda (yeni sütunlar null) saklı değerler yorumlanır,
-- yeniden hesap yapılmaz: graded kayıt graded kalır.
-- open_answers (soru başına durum/puan) yalnız veli ve servis için döner.
create or replace function public.get_attempt_summary(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.exam_attempts%rowtype;
  v_full boolean;
  v_open_total int;
  v_open_graded int;
  v_pending int;
  v_unanswered int;
  v_provisional boolean;
  v_open_answers jsonb;
begin
  select * into a from public.exam_attempts x
  where x.id = p_attempt_id
    and (
      (gina.is_parent() and x.family_id = gina.family_id())
      or (gina.is_device() and x.family_id = gina.family_id() and x.child_id = gina.child_id())
      or gina.is_service()
    );
  if a.id is null then
    raise exception 'attempt_not_found' using errcode = 'P0001';
  end if;
  v_full := gina.is_parent() or gina.is_service();

  v_open_total := coalesce(a.open_total, 0);
  v_open_graded := coalesce(a.open_graded, 0);
  -- Eski satırlar: open_pending null → eksik olanların hepsi "bekliyor" (eski kuralda boşlar zaten 0 sayılmıştı).
  v_pending := coalesce(a.open_pending, greatest(v_open_total - v_open_graded, 0));
  v_unanswered := coalesce(a.open_unanswered, 0);
  v_provisional := coalesce(a.provisional, v_open_graded < v_open_total);

  if v_full then
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id', q.id,
             'position', qid.ord,
             'state', gina.open_answer_state(ans.score, ans.answer_text, ans.answer_document),
             'score', ans.score,
             'graded_by', ans.graded_by,
             'has_text', nullif(trim(ans.answer_text), '') is not null,
             'has_document', coalesce(jsonb_array_length(ans.answer_document -> 'elements'), 0) > 0
           ) order by qid.ord), '[]'::jsonb)
    into v_open_answers
    from public.exams e
    join unnest(e.question_ids) with ordinality qid(id, ord) on true
    join public.question_bank q on q.id = qid.id
    left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id
    where e.id = a.exam_id and q.kind = 'open_ended';
  end if;

  return jsonb_build_object(
    'id', a.id,
    'exam_id', a.exam_id,
    'child_id', a.child_id,
    'status', a.status,
    'review_state', case
      when a.status = 'in_progress' then 'in_progress'
      when a.status = 'graded' then 'graded'
      else 'pending_review' end,
    'mc_total', a.mc_total,
    'mc_correct', a.mc_correct,
    'open_total', a.open_total,
    'open_graded', a.open_graded,
    'pending_open_count', v_pending,
    'unanswered_open_count', v_unanswered,
    'provisional', v_provisional,
    'score_pct', a.score_pct,
    'started_at', a.started_at,
    'finished_at', a.finished_at,
    'graded_at', a.graded_at
  ) || case when v_full then jsonb_build_object('open_answers', v_open_answers) else '{}'::jsonb end;
end;
$$;
revoke all on function public.get_attempt_summary(uuid) from public, anon;
grant execute on function public.get_attempt_summary(uuid) to authenticated, service_role;

-- Bilinçli olarak YOK: geçmiş 'submitted'/'graded' denemeler için recompute döngüsü. Eski puanlar değişmez.
