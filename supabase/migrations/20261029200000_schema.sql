-- Gina şeması v1: aile, üyeler, çocuklar, cihazlar, etkinlikler, görevler, yıldızlar, notlar, puanlar.
-- Kural: her satır family_id taşır; yetki sınırı RLS'dedir (20261029200100_rls.sql).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists gina;
grant usage on schema gina to authenticated, service_role;

-- Enum'lar -----------------------------------------------------------------

create type public.member_role as enum ('parent', 'guardian');
create type public.event_type as enum ('school', 'activity', 'holiday', 'exam', 'family', 'doctor', 'birthday', 'other');
create type public.completion_status as enum ('done', 'approved', 'returned');
create type public.note_visibility as enum ('private', 'family', 'child', 'teacher');
create type public.grade_kind as enum ('exam', 'homework', 'project', 'oral', 'performance');
create type public.time_of_day as enum ('morning', 'afternoon', 'evening', 'any');

-- Yardımcılar ----------------------------------------------------------------

create or replace function gina.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Aile ---------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  timezone text not null default 'Europe/Istanbul',
  locale text not null default 'tr',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'parent',
  display_name text,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
-- MVP: bir kullanıcı tek aileye üyedir.
create unique index family_members_user_idx on public.family_members (user_id);

-- Ebeveyn PIN'i (telefonda çocuk modundan çıkış, cihaz ayarları). Hash'ler ayrı tabloda tutulur ve istemciye hiç verilmez.
create table public.parent_pins (
  family_id uuid primary key references public.families (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- Çocuklar -------------------------------------------------------------------

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  birth_date date,
  grade smallint check (grade between 0 and 12),
  avatar text not null default 'avatar-default',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index children_family_idx on public.children (family_id);

create table public.child_pins (
  child_id uuid primary key references public.children (id) on delete cascade,
  pin_hash text not null,
  failed_count smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Cihazlar (çocuk tableti = anonim Supabase kullanıcısı) ------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Tablet',
  active_child_id uuid references public.children (id) on delete set null,
  paired_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);
create index devices_family_idx on public.devices (family_id);

create table public.device_pairings (
  code text primary key,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  device_name text not null default 'Tablet',
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);

-- Takvim ---------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete cascade, -- null = tüm aile
  type public.event_type not null default 'other',
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  rrule text, -- RFC 5545 RRULE; null = tek seferlik. Ders programı = type 'school' + haftalık RRULE.
  location text,
  notes text,
  visible_to_child boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_family_start_idx on public.events (family_id, starts_at);
create trigger events_set_updated_at before update on public.events
  for each row execute function gina.set_updated_at();

create table public.event_exceptions (
  event_id uuid not null references public.events (id) on delete cascade,
  occurrence_date date not null,
  cancelled boolean not null default true,
  primary key (event_id, occurrence_date)
);

-- Görevler -------------------------------------------------------------------

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  icon text not null default 'task-custom',
  stars smallint not null default 1 check (stars between 0 and 10),
  days_of_week smallint[] not null default '{1,2,3,4,5,6,7}', -- ISO: 1 = Pazartesi … 7 = Pazar
  time_of_day public.time_of_day not null default 'any',
  starts_on date not null default current_date,
  ends_on date,
  requires_approval boolean not null default true,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (days_of_week <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(days_of_week) > 0)
);
create index task_templates_child_idx on public.task_templates (child_id) where active;
create trigger task_templates_set_updated_at before update on public.task_templates
  for each row execute function gina.set_updated_at();

-- Görev örnekleri tabloya yazılmaz; yalnız gerçekleşen eylemler tutulur.
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  template_id uuid not null references public.task_templates (id) on delete cascade,
  due_date date not null,
  status public.completion_status not null default 'done',
  client_id uuid not null unique, -- çevrimdışı kuyruğun idempotency anahtarı
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  unique (template_id, due_date)
);
create index task_completions_child_date_idx on public.task_completions (child_id, due_date desc);
create index task_completions_pending_idx on public.task_completions (family_id) where status = 'done';

-- Yıldız defteri (append-only) -------------------------------------------------

create table public.star_events (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('task_approved', 'task_returned', 'reward', 'bonus', 'adjust')),
  completion_id uuid references public.task_completions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index star_events_child_idx on public.star_events (child_id, created_at desc);

-- Notlar ---------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  author_child_id uuid references public.children (id) on delete set null,
  subject text,
  title text,
  body text not null default '',
  visibility public.note_visibility not null default 'family',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_user_id is not null or author_child_id is not null)
);
create index notes_family_child_idx on public.notes (family_id, child_id, updated_at desc);
create trigger notes_set_updated_at before update on public.notes
  for each row execute function gina.set_updated_at();

-- Puanlar --------------------------------------------------------------------

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  subject text not null,
  kind public.grade_kind not null default 'exam',
  score numeric(6, 2) not null check (score >= 0),
  max_score numeric(6, 2) not null default 100 check (max_score > 0),
  graded_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index grades_child_idx on public.grades (child_id, graded_on desc);

-- Yönetim ve ortak veri ---------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'TR',
  kind text not null check (kind in ('public', 'religious', 'school_break', 'half_day')),
  name jsonb not null, -- {"tr": "...", "en": "..."}
  starts_on date not null,
  ends_on date not null,
  school_year text,
  check (ends_on >= starts_on)
);
create index holidays_range_idx on public.holidays (country, starts_on, ends_on);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
