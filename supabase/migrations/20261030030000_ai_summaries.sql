-- Haftalık AI aile özeti: veri toplama RPC'si (takma adlı) + üretilen özetlerin saklandığı tablo.
-- Kurallar (docs/DECISIONS.md): çocuklar AI ile etkileşmez; girdiler takma adlandırılır
-- (soyad/doğum tarihi/okul/fotoğraf/serbest not gönderilmez); özetler 12 ay saklanır; yalnız ücretli paketlerde.

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  week_start date not null, -- Pazartesi (aile saat diliminde)
  model text not null,
  prompt_version text not null default 'v1',
  input_hash text not null,
  output_json jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'skipped')),
  error text,
  input_tokens int,
  output_tokens int,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, week_start, prompt_version)
);
create index ai_summaries_family_idx on public.ai_summaries (family_id, week_start desc);

alter table public.ai_summaries enable row level security;

create policy ai_summaries_parent_select on public.ai_summaries
  for select to authenticated using (family_id = gina.family_id() and gina.is_parent());
-- Yazma yalnız service_role (Edge Function).

-- 12 ay sonra otomatik imha (saklama-imha politikası): pg_cron günlük.
-- Yerelde pg_cron kapalı olabilir; varsa zamanla, yoksa atla (bulutta etkinleştirilecek).
do $do$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-ai-summaries', '15 3 * * *',
    $job$ delete from public.ai_summaries where created_at < now() - interval '12 months' $job$);
exception when others then
  raise notice 'pg_cron yok, purge-ai-summaries zamanlanmadı: %', sqlerrm;
end
$do$;

-- Takma adlı haftalık veri: Çocuk A/B/C etiketi + yaş (yıl) + görev/yıldız istatistikleri + gelecek hafta yoğunluğu.
-- SECURITY DEFINER: Edge Function service_role ile, veli istemcisi kendi ailesi için çağırabilir.
create or replace function public.get_weekly_summary_data(p_family_id uuid, p_week_start date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with fam as (
    select f.id, f.locale, f.timezone from public.families f
    where f.id = p_family_id
      -- gina.family_id() null = claim bağlamı yok (service_role / test); aksi hâlde yalnız kendi ailesi.
      and (gina.family_id() is null or f.id = gina.family_id() or gina.is_admin())
  ),
  kids as (
    select c.id,
           'Çocuk ' || chr(64 + row_number() over (order by c.sort_order, c.created_at)::int) as alias,
           extract(year from age(make_date(extract(year from c.birth_date)::int, 7, 1)))::int as approx_age,
           c.grade
    from public.children c join fam on c.family_id = fam.id
  ),
  completions as (
    select tc.child_id, tc.status, tc.due_date, tt.title, tt.stars
    from public.task_completions tc
    join public.task_templates tt on tt.id = tc.template_id
    join fam on tc.family_id = fam.id
    where tc.due_date >= p_week_start and tc.due_date < p_week_start + 7
  ),
  stars as (
    select se.child_id, coalesce(sum(se.delta), 0)::int as earned
    from public.star_events se join fam on se.family_id = fam.id
    where se.created_at >= p_week_start and se.created_at < p_week_start + 7
    group by se.child_id
  ),
  next_week as (
    select e.child_id, e.type::text, count(*)::int as cnt
    from public.events e join fam on e.family_id = fam.id
    where e.starts_at >= (p_week_start + 7)::timestamptz
      and e.starts_at < (p_week_start + 14)::timestamptz
    group by e.child_id, e.type
  )
  select jsonb_build_object(
    'week_start', p_week_start,
    'locale', (select locale from fam),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alias', k.alias,
        'age', k.approx_age,
        'grade', k.grade,
        'stars_earned', coalesce(s.earned, 0),
        'tasks', coalesce((
          select jsonb_agg(jsonb_build_object('title', c.title, 'status', c.status, 'date', c.due_date, 'stars', c.stars) order by c.due_date)
          from completions c where c.child_id = k.id
        ), '[]'::jsonb),
        'next_week_events', coalesce((
          select jsonb_object_agg(n.type, n.cnt) from next_week n where n.child_id = k.id
        ), '{}'::jsonb)
      ) order by k.alias)
      from kids k left join stars s on s.child_id = k.id
    ), '[]'::jsonb)
  )
  where exists (select 1 from fam);
$$;

revoke execute on function public.get_weekly_summary_data(uuid, date) from public, anon;
grant execute on function public.get_weekly_summary_data(uuid, date) to authenticated, service_role;
