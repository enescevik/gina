-- QT00 — yapılandırılmış soru türleri veri ve güvenlik sözleşmesi.
-- Plan: docs/learning/PROVA-QUESTION-TYPES-PLAN.md §4; sözleşme: docs/learning/PROVA-QUESTION-TYPES-CONTRACT.md.
--
-- * Eski kind ('multiple_choice' / 'open_ended') ve satırlar olduğu gibi kalır; hiçbir eski satır
--   güncellenmez (backfill yok). Yeni türlerde kind='structured' + interaction_type + schema_version + payload.
-- * payload yalnız öğrenciye açılabilecek içerik; doğru cevap/tolerans/alternatif/ağırlık
--   public.question_answer_keys tablosunda (cihaz/çocuk erişimi yok; yazma yalnız RPC).
-- * Atanmış sınavda soru sürümü, puanlama politikası, ağırlık ve içerik hash'i
--   gina.exam_item_bindings ile sabitlenir.

-- 1) Yönetilen tür kaydı -------------------------------------------------------------------
create table public.interaction_types (
  type text primary key check (type ~ '^[a-z][a-z_]{2,31}$'),
  family text not null check (family in ('legacy', 'structured')),
  schema_version smallint not null check (schema_version between 1 and 99),
  policy text not null,
  policy_version smallint not null check (policy_version between 1 and 99),
  auto_scorable boolean not null,
  -- Alıştırma türü: OYSS/ortak yazılı (assessment_track='meb_common') sınavına kendiliğinden alınmaz.
  practice_only boolean not null,
  phase text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.interaction_types is
  'QT00 yönetilen etkileşim türleri. Serbest tür metni yok; question_bank.interaction_type bu tabloya bağlıdır.';
insert into public.interaction_types(type, family, schema_version, policy, policy_version, auto_scorable, practice_only, phase) values
  ('multiple_choice', 'legacy', 1, 'legacy_choice', 1, true, false, 'legacy'),
  ('open_ended', 'legacy', 1, 'legacy_open', 1, false, false, 'legacy'),
  ('true_false', 'structured', 1, 'per_item', 1, true, true, '1A'),
  ('fill_blank', 'structured', 1, 'per_item', 1, true, true, '1A'),
  ('matching', 'structured', 1, 'per_item', 1, true, true, '1A'),
  ('numeric', 'structured', 1, 'numeric', 1, true, false, '1A'),
  ('ordering', 'structured', 1, 'pairwise_order', 1, true, true, '1B'),
  ('classification', 'structured', 1, 'per_item', 1, true, true, '1B');
-- Doğrudan tablo erişimi yok (politika yok); istemciler public.get_interaction_types() ile okur.
alter table public.interaction_types enable row level security;
revoke all on public.interaction_types from anon, authenticated;

-- 2) question_bank sütunları (eski satırlar NULL kalır; etkin tür = coalesce(interaction_type, kind)) ---
alter table public.question_bank
  add column interaction_type text references public.interaction_types(type),
  add column schema_version smallint,
  add column payload jsonb;
alter table public.question_bank add constraint question_bank_interaction_shape check (
  case when kind = 'structured'
    then interaction_type is not null and interaction_type not in ('multiple_choice', 'open_ended')
      and schema_version is not null and jsonb_typeof(payload) = 'object'
      and choices is null and correct_key is null
    else (interaction_type is null or interaction_type = kind::text) and payload is null
  end);
comment on column public.question_bank.payload is
  'QT00: öğrenciye açılabilecek yapılandırılmış içerik (sürümlü). Doğru cevap burada TUTULMAZ; bkz. question_answer_keys.';

create function gina.question_interaction(p_kind public.question_kind, p_type text) returns text
language sql immutable set search_path to '' as $$ select coalesce(p_type, p_kind::text) $$;

-- 3) Özel değerlendirme anahtarı ---------------------------------------------------------------
create table public.question_answer_keys (
  -- Ertelenmiş FK: anahtar sorudan önce yazılır, böylece bütünlük denetimi IMMEDIATE modda da çalışır.
  question_id uuid primary key references public.question_bank(id) on delete cascade deferrable initially deferred,
  family_id uuid references public.families(id) on delete cascade,
  interaction_type text not null references public.interaction_types(type),
  schema_version smallint not null,
  key jsonb not null check (jsonb_typeof(key) = 'object' and length(key::text) <= 16000),
  policy text not null,
  policy_version smallint not null,
  points numeric(6,2) not null default 1 check (points > 0 and points <= 100),
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.question_answer_keys is
  'QT00 özel cevap anahtarı/puan politikası. Çocuk cihazı erişemez; yalnız aile velisi/yönetici okur, yazma RPC ile.';
create index question_answer_keys_family_idx on public.question_answer_keys(family_id);
-- Politika yok: çocuk/cihaz ve diğer aileler hiçbir yoldan okuyamaz. Veli/yönetici
-- public.get_question_answer_keys(ids) ile okur; yazma yalnız SECURITY DEFINER RPC.
alter table public.question_answer_keys enable row level security;
revoke all on public.question_answer_keys from anon, authenticated;

-- 4) Doğrulama yardımcıları --------------------------------------------------------------------
create function gina.qt_valid_id(t text) returns boolean
language sql immutable set search_path to '' as $$ select coalesce(t ~ '^[a-z][a-z0-9_]{0,23}$', false) $$;

-- Dizi: [{id,text}] tam bu iki alan; benzersiz geçerli id; 1..max_text karakter metin.
-- Geçersizse NULL, geçerliyse id dizisi.
create function gina.qt_entry_ids(arr jsonb, max_count int, max_text int, extra text[] default '{}') returns text[]
language plpgsql immutable set search_path to '' as $$
declare e jsonb; ids text[] := '{}'; k text;
begin
  if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr) > max_count then return null; end if;
  for e in select value from jsonb_array_elements(arr) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'id') is distinct from 'string'
       or jsonb_typeof(e->'text') is distinct from 'string' then return null; end if;
    for k in select jsonb_object_keys(e) loop
      if k not in ('id', 'text') and not (k = any(extra)) then return null; end if;
    end loop;
    if not gina.qt_valid_id(e->>'id') or e->>'id' = any(ids)
       or length(btrim(e->>'text')) not between 1 and max_text then return null; end if;
    ids := array_append(ids, e->>'id');
  end loop;
  return ids;
end $$;

create function gina.qt_only_keys(o jsonb, allowed text[]) returns boolean
language sql immutable set search_path to '' as $$
  select jsonb_typeof(o) = 'object' and not exists (select 1 from jsonb_object_keys(o) k where not (k = any(allowed)))
$$;

-- Ağırlık nesnesi: {alt_madde_id: pozitif sayı ≤ 10}; yalnız bilinen id'ler.
create function gina.qt_weights_ok(w jsonb, ids text[]) returns boolean
language plpgsql immutable set search_path to '' as $$
declare k text; v jsonb;
begin
  if w is null or jsonb_typeof(w) = 'null' then return true; end if;
  if jsonb_typeof(w) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(w) loop
    if not (k = any(ids)) or jsonb_typeof(v) <> 'number' or (v::text)::numeric <= 0 or (v::text)::numeric > 10 then return false; end if;
  end loop;
  return true;
end $$;

-- Kontrollü sayı ayrıştırıcı (ifade çalıştırmaz). Desteklenen: tam sayı, ondalık (virgül VEYA nokta),
-- binlik ayraçlı nokta (1.250 / 12.500,5), kesir (3/4), tam sayılı kesir (1 3/4), baştaki eksi.
-- Belirsiz/çoklu ayraç, boşluklu sayı ve diğer her şey NULL (geçersiz) döner.
create function gina.qt_parse_number(t text) returns numeric
language plpgsql immutable set search_path to '' as $$
declare s text; neg boolean := false; m text[]; d numeric;
begin
  if t is null then return null; end if;
  s := btrim(normalize(t, NFC));
  s := replace(s, U&'\2212', '-');
  if length(s) = 0 or length(s) > 40 then return null; end if;
  if left(s, 1) = '-' then neg := true; s := btrim(substr(s, 2)); end if;
  if s ~ '^[0-9]+$' then d := s::numeric;
  elsif s ~ '^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$' then d := replace(replace(s, '.', ''), ',', '.')::numeric;
  elsif s ~ '^[0-9]+[.,][0-9]+$' then d := replace(s, ',', '.')::numeric;
  elsif s ~ '^[0-9]+/[0-9]+$' then
    m := regexp_match(s, '^([0-9]+)/([0-9]+)$');
    if m[2]::numeric = 0 then return null; end if;
    d := m[1]::numeric / m[2]::numeric;
  elsif s ~ '^[0-9]+ [0-9]+/[0-9]+$' then
    m := regexp_match(s, '^([0-9]+) ([0-9]+)/([0-9]+)$');
    if m[3]::numeric = 0 or m[2]::numeric >= m[3]::numeric then return null; end if;
    d := m[1]::numeric + m[2]::numeric / m[3]::numeric;
  else return null; end if;
  return case when neg then -d else d end;
exception when others then return null;
end $$;

-- Türkçe metin karşılaştırma: NFC + kırp + boşluk sadeleştirme. Büyük/küçük harf yalnız istenirse
-- tr-TR kuralıyla (I/ı, İ/i). ı/i, ş/s, ğ/g ASCII eşitlemesi YOK; fuzzy YOK.
create function gina.qt_norm_text(t text, p_case_insensitive boolean) returns text
language sql immutable set search_path to '' as $$
  select case when p_case_insensitive
    then lower(regexp_replace(btrim(normalize(coalesce(t, ''), NFC)), '\s+', ' ', 'g') collate "tr-TR-x-icu")
    else regexp_replace(btrim(normalize(coalesce(t, ''), NFC)), '\s+', ' ', 'g') end
$$;

-- Tür içeriği + anahtar doğrulaması. Boş dizi = geçerli. Kodlar sözleşme dokümanındadır.
create function gina.qt_content_errors(p_type text, p_version int, p_payload jsonb, p_key jsonb)
returns text[] language plpgsql immutable set search_path to '' as $$
declare
  err text[] := '{}'; ids text[]; ids2 text[]; cats text[]; e jsonb; k text; v jsonb; n int;
  used text[]; seg_blanks text[] := '{}'; o jsonb; caps jsonb; cnt jsonb := '{}'; t text;
begin
  if p_version is distinct from 1 then return array['schema_version_unsupported']; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text) > 16000 then return array['payload_invalid']; end if;
  if jsonb_typeof(p_key) is distinct from 'object' or length(p_key::text) > 16000 then return array['key_invalid']; end if;

  if p_type = 'true_false' then
    if not gina.qt_only_keys(p_payload, array['statements']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(p_payload->'statements', 10, 500);
    if ids is null then return array['statements_invalid']; end if;
    if cardinality(ids) < 1 then err := array_append(err, 'statements_count'); end if;
    if not gina.qt_only_keys(p_key, array['answers', 'weights']) or jsonb_typeof(p_key->'answers') is distinct from 'object' then return array_append(err, 'key_invalid'); end if;
    for k, v in select * from jsonb_each(p_key->'answers') loop
      if not (k = any(ids)) then err := array_append(err, 'key_unknown_id'); end if;
      if jsonb_typeof(v) <> 'boolean' then err := array_append(err, 'key_value_invalid'); end if;
    end loop;
    if exists (select 1 from unnest(ids) i where not (p_key->'answers' ? i)) then err := array_append(err, 'key_missing_id'); end if;
    if not gina.qt_weights_ok(p_key->'weights', ids) then err := array_append(err, 'weights_invalid'); end if;

  elsif p_type = 'fill_blank' then
    if not gina.qt_only_keys(p_payload, array['segments', 'input', 'bank', 'bank_reuse']) then return array['payload_unknown_field']; end if;
    if coalesce(p_payload->>'input', '') not in ('bank', 'keyboard') then err := array_append(err, 'input_invalid'); end if;
    if jsonb_typeof(p_payload->'segments') is distinct from 'array' or jsonb_array_length(p_payload->'segments') not between 2 and 40 then return array_append(err, 'segments_invalid'); end if;
    for e in select value from jsonb_array_elements(p_payload->'segments') loop
      if e->>'type' = 'text' and gina.qt_only_keys(e, array['type', 'text']) and jsonb_typeof(e->'text') = 'string' and length(e->>'text') between 1 and 1000 then null;
      elsif e->>'type' = 'blank' and gina.qt_only_keys(e, array['type', 'id']) and gina.qt_valid_id(e->>'id') and not (e->>'id' = any(seg_blanks)) then
        seg_blanks := array_append(seg_blanks, e->>'id');
      else return array_append(err, 'segments_invalid'); end if;
    end loop;
    if cardinality(seg_blanks) not between 1 and 10 then err := array_append(err, 'blanks_count'); end if;
    if p_payload->>'input' = 'bank' then
      ids := gina.qt_entry_ids(p_payload->'bank', 16, 80);
      if ids is null or cardinality(ids) < 2 then err := array_append(err, 'bank_invalid'); end if;
      if coalesce(jsonb_typeof(p_payload->'bank_reuse'), 'boolean') <> 'boolean' then err := array_append(err, 'bank_reuse_invalid'); end if;
    elsif p_payload ? 'bank' or p_payload ? 'bank_reuse' then err := array_append(err, 'bank_not_allowed');
    end if;
    if not gina.qt_only_keys(p_key, array['blanks', 'case_insensitive', 'weights']) or jsonb_typeof(p_key->'blanks') is distinct from 'object'
       or coalesce(jsonb_typeof(p_key->'case_insensitive'), 'boolean') <> 'boolean' then return array_append(err, 'key_invalid'); end if;
    used := '{}';
    for k, v in select * from jsonb_each(p_key->'blanks') loop
      if not (k = any(seg_blanks)) then err := array_append(err, 'key_unknown_id'); continue; end if;
      if p_payload->>'input' = 'bank' then
        if not gina.qt_only_keys(v, array['tokens']) or jsonb_typeof(v->'tokens') <> 'array' or jsonb_array_length(v->'tokens') not between 1 and 4
           or exists (select 1 from jsonb_array_elements(v->'tokens') x where jsonb_typeof(x) <> 'string' or not (x #>> '{}' = any(coalesce(ids, '{}'))))
        then err := array_append(err, 'key_value_invalid');
        else used := used || array(select x #>> '{}' from jsonb_array_elements(v->'tokens') x); end if;
      else
        if not gina.qt_only_keys(v, array['accepted']) or jsonb_typeof(v->'accepted') <> 'array' or jsonb_array_length(v->'accepted') not between 1 and 8
           or exists (select 1 from jsonb_array_elements(v->'accepted') x where jsonb_typeof(x) <> 'string' or length(btrim(x #>> '{}')) not between 1 and 120)
        then err := array_append(err, 'key_value_invalid'); end if;
      end if;
    end loop;
    if exists (select 1 from unnest(seg_blanks) i where not (p_key->'blanks' ? i)) then err := array_append(err, 'key_missing_id'); end if;
    -- Tekrar kullanım kapalıysa her boşluğun ilk kabulü farklı kelime olmalı (çözülebilirlik).
    if p_payload->>'input' = 'bank' and not coalesce((p_payload->>'bank_reuse')::boolean, false)
       and (select count(distinct p_key->'blanks'->i->'tokens'->>0) from unnest(seg_blanks) i) < cardinality(seg_blanks)
    then err := array_append(err, 'bank_unsolvable'); end if;
    if not gina.qt_weights_ok(p_key->'weights', seg_blanks) then err := array_append(err, 'weights_invalid'); end if;

  elsif p_type = 'matching' then
    if not gina.qt_only_keys(p_payload, array['left', 'right', 'policy']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(p_payload->'left', 8, 300);
    ids2 := gina.qt_entry_ids(p_payload->'right', 10, 300);
    if ids is null or ids2 is null or cardinality(ids) < 2 or cardinality(ids2) < 2 then return array['sides_invalid']; end if;
    if ids && ids2 then err := array_append(err, 'duplicate_id'); end if;
    if coalesce(p_payload->>'policy', '') not in ('one_to_one', 'many_to_one') then err := array_append(err, 'policy_invalid'); end if;
    if p_payload->>'policy' = 'one_to_one' and cardinality(ids2) < cardinality(ids) then err := array_append(err, 'right_too_few'); end if;
    if not gina.qt_only_keys(p_key, array['pairs', 'weights']) or jsonb_typeof(p_key->'pairs') is distinct from 'object' then return array_append(err, 'key_invalid'); end if;
    for k, v in select * from jsonb_each(p_key->'pairs') loop
      if not (k = any(ids)) then err := array_append(err, 'key_unknown_id');
      elsif jsonb_typeof(v) <> 'string' or not (v #>> '{}' = any(ids2)) then err := array_append(err, 'key_value_invalid'); end if;
    end loop;
    if exists (select 1 from unnest(ids) i where not (p_key->'pairs' ? i)) then err := array_append(err, 'key_missing_id'); end if;
    if p_payload->>'policy' = 'one_to_one'
       and (select count(distinct value #>> '{}') from jsonb_each(p_key->'pairs')) <> (select count(*) from jsonb_each(p_key->'pairs'))
    then err := array_append(err, 'key_not_one_to_one'); end if;
    if not gina.qt_weights_ok(p_key->'weights', ids) then err := array_append(err, 'weights_invalid'); end if;

  elsif p_type = 'numeric' then
    if not gina.qt_only_keys(p_payload, array['units', 'unit_required']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(coalesce(p_payload->'units', '[]'), 8, 20);
    if ids is null then return array['units_invalid']; end if;
    if coalesce(jsonb_typeof(p_payload->'unit_required'), 'null') <> 'boolean' then err := array_append(err, 'unit_required_invalid'); end if;
    if (p_payload->>'unit_required')::boolean is true and cardinality(ids) = 0 then err := array_append(err, 'units_missing'); end if;
    if not gina.qt_only_keys(p_key, array['value', 'unit', 'unit_factors', 'abs_tolerance', 'rel_tolerance', 'unit_weight', 'process_required']) then return array_append(err, 'key_invalid'); end if;
    if jsonb_typeof(p_key->'value') is distinct from 'string' or gina.qt_parse_number(p_key->>'value') is null then err := array_append(err, 'key_value_invalid'); end if;
    for t in select unnest(array['abs_tolerance', 'rel_tolerance', 'unit_weight']) loop
      if p_key ? t and (jsonb_typeof(p_key->t) <> 'number' or (p_key->>t)::numeric < 0
         or (t = 'rel_tolerance' and (p_key->>t)::numeric > 0.5) or (t = 'unit_weight' and (p_key->>t)::numeric > 0.5)) then err := array_append(err, 'tolerance_invalid'); end if;
    end loop;
    if p_key ? 'process_required' and jsonb_typeof(p_key->'process_required') <> 'boolean' then err := array_append(err, 'key_invalid'); end if;
    if (p_payload->>'unit_required')::boolean is true then
      if not (coalesce(p_key->>'unit', '') = any(ids)) then err := array_append(err, 'key_unit_invalid'); end if;
      if p_key ? 'unit_factors' then
        if jsonb_typeof(p_key->'unit_factors') <> 'object' then err := array_append(err, 'unit_factors_invalid');
        else
          for k, v in select * from jsonb_each(p_key->'unit_factors') loop
            if not (k = any(ids)) or jsonb_typeof(v) <> 'number' or (v::text)::numeric <= 0 then err := array_append(err, 'unit_factors_invalid'); end if;
          end loop;
          if (p_key->'unit_factors'->>(p_key->>'unit'))::numeric is distinct from 1 then err := array_append(err, 'unit_factors_invalid'); end if;
        end if;
      end if;
    elsif p_key ? 'unit' or p_key ? 'unit_factors' or coalesce((p_key->>'unit_weight')::numeric, 0) > 0 then err := array_append(err, 'unit_not_required');
    end if;

  elsif p_type = 'ordering' then
    if not gina.qt_only_keys(p_payload, array['items', 'mode']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(p_payload->'items', 10, 300);
    if ids is null or cardinality(ids) < 2 then return array['items_invalid']; end if;
    if coalesce(p_payload->>'mode', '') not in ('sequence', 'sentence') then err := array_append(err, 'mode_invalid'); end if;
    if not gina.qt_only_keys(p_key, array['orders']) or jsonb_typeof(p_key->'orders') is distinct from 'array'
       or jsonb_array_length(p_key->'orders') not between 1 and 5 then return array_append(err, 'key_invalid'); end if;
    for o in select value from jsonb_array_elements(p_key->'orders') loop
      if jsonb_typeof(o) <> 'array' or jsonb_array_length(o) <> cardinality(ids)
         or (select count(distinct x #>> '{}') from jsonb_array_elements(o) x where jsonb_typeof(x) = 'string' and x #>> '{}' = any(ids)) <> cardinality(ids)
      then err := array_append(err, 'order_invalid'); end if;
    end loop;
    if (select count(distinct value::text) from jsonb_array_elements(p_key->'orders')) <> jsonb_array_length(p_key->'orders') then err := array_append(err, 'order_duplicate'); end if;

  elsif p_type = 'classification' then
    if not gina.qt_only_keys(p_payload, array['items', 'categories']) then return array['payload_unknown_field']; end if;
    ids := gina.qt_entry_ids(p_payload->'items', 16, 200);
    if jsonb_typeof(p_payload->'categories') is distinct from 'array' then return array['categories_invalid']; end if;
    cats := gina.qt_entry_ids((select jsonb_agg(c - 'capacity') from jsonb_array_elements(p_payload->'categories') c), 5, 80);
    if ids is null or cardinality(ids) < 2 then return array['items_invalid']; end if;
    if cats is null or cardinality(cats) < 2 then return array['categories_invalid']; end if;
    if ids && cats then err := array_append(err, 'duplicate_id'); end if;
    for e in select value from jsonb_array_elements(p_payload->'categories') loop
      if not gina.qt_only_keys(e, array['id', 'text', 'capacity']) then err := array_append(err, 'categories_invalid'); end if;
      if e ? 'capacity' and (jsonb_typeof(e->'capacity') <> 'number' or (e->>'capacity')::numeric <> trunc((e->>'capacity')::numeric) or (e->>'capacity')::int not between 1 and 16)
      then err := array_append(err, 'capacity_invalid'); end if;
    end loop;
    if not gina.qt_only_keys(p_key, array['membership', 'weights']) or jsonb_typeof(p_key->'membership') is distinct from 'object' then return array_append(err, 'key_invalid'); end if;
    for k, v in select * from jsonb_each(p_key->'membership') loop
      if not (k = any(ids)) then err := array_append(err, 'key_unknown_id');
      elsif jsonb_typeof(v) <> 'string' or not (v #>> '{}' = any(cats)) then err := array_append(err, 'key_value_invalid');
      else cnt := jsonb_set(cnt, array[v #>> '{}'], to_jsonb(coalesce((cnt->>(v #>> '{}'))::int, 0) + 1)); end if;
    end loop;
    if exists (select 1 from unnest(ids) i where not (p_key->'membership' ? i)) then err := array_append(err, 'key_missing_id'); end if;
    for e in select value from jsonb_array_elements(p_payload->'categories') loop
      if e ? 'capacity' and coalesce((cnt->>(e->>'id'))::int, 0) > (e->>'capacity')::int then err := array_append(err, 'capacity_exceeded'); end if;
    end loop;
    if not gina.qt_weights_ok(p_key->'weights', ids) then err := array_append(err, 'weights_invalid'); end if;

  else
    return array['type_unknown'];
  end if;
  return array(select distinct x from unnest(err) x order by 1);
exception when others then
  return array['content_invalid'];
end $$;

-- İçerik hash'i: kök + payload + anahtar + politika + ağırlık. Atamada sabitlenir.
create function gina.qt_content_hash(p_stem text, p_type text, p_version int, p_payload jsonb, p_key jsonb,
  p_policy text, p_policy_version int, p_points numeric) returns text
language sql immutable set search_path to '' as $$
  select encode(extensions.digest(jsonb_build_object('stem', p_stem, 'type', p_type, 'v', p_version, 'payload', p_payload,
    'key', p_key, 'policy', p_policy, 'policy_version', p_policy_version, 'points', p_points::numeric(6,2))::text, 'sha256'), 'hex')
$$;

-- 5) Bütünlük: yapılandırılmış soru ↔ anahtar (işlem sonunda) ------------------------------------
create function gina.check_structured_question() returns trigger
language plpgsql security definer set search_path to '' as $$
declare qid uuid; q public.question_bank; k public.question_answer_keys; t public.interaction_types; errs text[];
begin
  if tg_table_name = 'question_bank' then qid := new.id; else qid := new.question_id; end if;
  select * into q from public.question_bank where id = qid;
  if q.id is null then return null; end if; -- silinmiş soru (cascade)
  select * into k from public.question_answer_keys where question_id = qid;
  if q.kind <> 'structured' then
    if k.question_id is not null then raise exception 'answer_key_for_legacy_question'; end if;
    return null;
  end if;
  if k.question_id is null then raise exception 'structured_key_missing'; end if;
  select * into t from public.interaction_types where type = q.interaction_type;
  -- enabled burada denetlenmez: tür sonradan kapatılsa da mevcut satırlar (times_asked vb.) güncellenebilmeli.
  if t.type is null or t.family <> 'structured' then raise exception 'interaction_type_unavailable'; end if;
  if k.interaction_type <> q.interaction_type or k.schema_version <> q.schema_version or q.schema_version <> t.schema_version
     or k.policy <> t.policy or k.policy_version <> t.policy_version or k.family_id is distinct from q.family_id then
    raise exception 'structured_key_mismatch';
  end if;
  errs := gina.qt_content_errors(q.interaction_type, q.schema_version, q.payload, k.key);
  if cardinality(errs) > 0 then raise exception 'question_structure_invalid' using detail = array_to_string(errs, ','); end if;
  if k.content_hash <> gina.qt_content_hash(q.stem, q.interaction_type, q.schema_version, q.payload, k.key, k.policy, k.policy_version, k.points) then
    raise exception 'structured_hash_mismatch';
  end if;
  return null;
end $$;
create constraint trigger structured_question_check after insert or update on public.question_bank
  deferrable initially deferred for each row execute function gina.check_structured_question();
create constraint trigger structured_key_check after insert or update on public.question_answer_keys
  deferrable initially deferred for each row execute function gina.check_structured_question();

-- Anahtar, soru kullanılmaya başladıktan sonra değişemez/silinemez (guard_used_question ile aynı kural).
create function gina.guard_used_answer_key() returns trigger
language plpgsql security definer set search_path to '' as $$
declare qid uuid := case when tg_op = 'INSERT' then new.question_id else old.question_id end;
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.question_bank where id = old.question_id) then return old; end if;
  if exists (select 1 from public.exams e where e.question_ids @> array[qid]
             and (e.content_locked_at is not null or exists (select 1 from public.exam_attempts where exam_id = e.id)))
     or exists (select 1 from gina.exam_item_bindings b where b.question_id = qid) then
    raise exception 'question_in_use';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

-- 6) Atama sürüm bağı ----------------------------------------------------------------------------
create table gina.exam_item_bindings (
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  interaction_type text not null,
  schema_version smallint not null,
  policy text not null,
  policy_version smallint not null,
  points numeric(6,2) not null,
  content_hash text not null,
  bound_at timestamptz not null default now(),
  primary key (exam_id, question_id)
);
comment on table gina.exam_item_bindings is
  'QT00: atanan sınavdaki her sorunun sabit tür/şema/politika/ağırlık/içerik hash bağı. Başlamış sınav sessizce yeniden puanlanmaz.';
create index exam_item_bindings_question_idx on gina.exam_item_bindings(question_id);
alter table gina.exam_item_bindings enable row level security;
revoke all on gina.exam_item_bindings from public, anon, authenticated;

create trigger answer_key_used_guard before update or delete on public.question_answer_keys
  for each row execute function gina.guard_used_answer_key();

create function gina.qt_legacy_hash(q public.question_bank) returns text
language sql immutable set search_path to '' as $$
  select encode(extensions.digest(jsonb_build_object('stem', q.stem, 'kind', q.kind, 'choices', q.choices,
    'correct_key', q.correct_key, 'expected_answer', q.expected_answer)::text, 'sha256'), 'hex')
$$;

create function gina.bind_exam_items() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.content_locked_at is null then return null; end if;
  insert into gina.exam_item_bindings(exam_id, question_id, interaction_type, schema_version, policy, policy_version, points, content_hash)
  select new.id, q.id, gina.question_interaction(q.kind, q.interaction_type), coalesce(k.schema_version, 1),
         coalesce(k.policy, t.policy), coalesce(k.policy_version, t.policy_version), coalesce(k.points, 1),
         coalesce(k.content_hash, gina.qt_legacy_hash(q))
  from unnest(new.question_ids) qid
  join public.question_bank q on q.id = qid
  join public.interaction_types t on t.type = gina.question_interaction(q.kind, q.interaction_type)
  left join public.question_answer_keys k on k.question_id = q.id
  on conflict (exam_id, question_id) do nothing;
  return null;
end $$;
create trigger exams_bind_items after insert or update of status, question_ids, content_locked_at on public.exams
  for each row execute function gina.bind_exam_items();

-- 7) OYSS/ortak yazılı ayrımı: alıştırma türleri meb_common sınavına sessizce alınmaz/çevrilmez.
create function gina.guard_exam_interaction_types() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  -- Yalnız içerik/iz değişiminde veya atamaya geçişte; 'completed' geçişi (bitirme) engellenmez.
  if tg_op = 'UPDATE' and new.question_ids = old.question_ids and new.assessment_track is not distinct from old.assessment_track
     and not (new.status = 'assigned' and old.status is distinct from 'assigned') then return new; end if;
  if new.assessment_track = 'meb_common' and exists (
    select 1 from public.question_bank q join public.interaction_types t on t.type = gina.question_interaction(q.kind, q.interaction_type)
    where q.id = any(new.question_ids) and t.practice_only) then
    raise exception 'interaction_type_not_allowed_for_track' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.question_bank q join public.interaction_types t on t.type = gina.question_interaction(q.kind, q.interaction_type)
    where q.id = any(new.question_ids) and not t.enabled) then
    raise exception 'interaction_type_unavailable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger exams_interaction_type_guard before insert or update on public.exams
  for each row execute function gina.guard_exam_interaction_types();

-- 8) exam_answers: sürümlü yapılandırılmış cevap -------------------------------------------------
alter table public.exam_answers
  add column answer jsonb,
  add column score_exact numeric(7,4),
  add column score_details jsonb,
  add column scored_policy text;
alter table public.exam_answers add constraint exam_answers_answer_shape check (
  answer is null or (jsonb_typeof(answer) = 'object' and length(answer::text) <= 8000
    and jsonb_typeof(answer->'type') = 'string' and (answer->>'v') = '1'));
alter table public.exam_answers add constraint exam_answers_score_exact_check check (score_exact is null or (score_exact >= 0 and score_exact <= 100));
alter table public.exam_answers drop constraint exam_answers_graded_by_check;
alter table public.exam_answers add constraint exam_answers_graded_by_check check (graded_by = any (array['ai', 'parent', 'auto']));
comment on column public.exam_answers.answer is
  'QT00: sürümlü yapılandırılmış cevap {type, v, ...}. Eski answer_key/answer_text/answer_document korunur; yapılandırılmış soruda tek yetkili kaynak budur.';
comment on column public.exam_answers.score_exact is 'QT01: tek final yuvarlamadan önceki kesin soru puanı (0-100).';

-- Revizyon ve hash zinciri yeni cevabı kapsar. Eski satırların hash'i DEĞİŞMEZ (answer NULL ise eski biçim).
create or replace function gina.bump_answer_revision() returns trigger
language plpgsql set search_path to '' as $function$
begin
 if tg_op='INSERT' then new.edit_revision:=1;
 elsif (new.answer_key,new.answer_text,new.answer_document,new.answer) is distinct from (old.answer_key,old.answer_text,old.answer_document,old.answer) then new.edit_revision:=old.edit_revision+1;
 else new.edit_revision:=old.edit_revision;end if;
 return new;
end;$function$;

create or replace function gina.answer_fingerprint(a public.exam_answers) returns text
language sql immutable set search_path to '' as $function$
 select encode(extensions.digest((jsonb_build_object('key',a.answer_key,'text',a.answer_text,'document',a.answer_document,'revision',a.edit_revision)
   || case when a.answer is null then '{}'::jsonb else jsonb_build_object('answer',a.answer) end)::text,'sha256'),'hex');
$function$;

-- Toplu (grup) sınavlar bu fazda yapılandırılmış tür taşımaz: açık ret (sessiz kabul yok).
create or replace function gina.guard_group_answer() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare a public.exam_attempts;g public.group_exams;key text;kind text;
begin
 select * into a from public.exam_attempts where id=new.attempt_id;
 select c.* into g from public.group_exam_entries e join public.group_exams c on c.id=e.group_id where e.exam_id=a.exam_id;
 if g.id is null then return new;end if;
 if new.answer is not null then raise exception 'interaction_type_unavailable';end if;
 if tg_op='INSERT' or (new.answer_key,new.answer_text,new.answer_document,new.question_id,new.attempt_id) is distinct from(old.answer_key,old.answer_text,old.answer_document,old.question_id,old.attempt_id) then
  if g.status<>'published' or a.status<>'in_progress' or now()>a.deadline_at or now()>=g.ends_at then raise exception 'group_answer_closed';end if;
  if new.answer_key is not null and new.answer_key not in('A','B','C','D') then raise exception 'invalid_input';end if;
 end if;
 select q.content->>'correct_key',q.content->>'kind' into key,kind from public.group_exam_entries e join public.group_exam_entry_questions eq on eq.entry_id=e.id
 join public.group_exam_questions q on q.group_id=e.group_id and q.ord=eq.ord where e.exam_id=a.exam_id and eq.question_id=new.question_id;
 if kind is null then raise exception 'question_not_in_exam';end if;
 new.is_correct:=case when kind='multiple_choice' then coalesce(new.answer_key=key,false) else null end;
 return new;
end;$function$;

-- 9) Cihaz tür desteği bildirimi (veli atama uyarısı için; yetki değildir) -------------------------
alter table public.devices add column question_types text[], add column question_types_at timestamptz;
