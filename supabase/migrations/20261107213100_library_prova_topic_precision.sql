-- A programme sentence often lists the whole unit. Match its explicit outcome
-- code, while keeping free-text matches tied to the individual question title.
create or replace function gina.library_topic_label(p text) returns text
language sql immutable set search_path='' as $$
  select btrim(regexp_replace(lower(translate(
    coalesce(substring(p from '^([A-ZÇĞİÖŞÜ]+([.][A-Z0-9]+)+)[.]?[[:space:]]'), p, ''),
    'İIıÇçŞşĞğÖöÜüÂâÎîÛûÉé','iiiccssggoouuaaiiuuee'
  )), '[^a-z0-9]+', ' ', 'g'));
$$;
