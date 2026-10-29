-- Yerel geliştirme ve ilk üretim verisi: uygulama ayarları ve Türkiye resmî tatilleri.
-- Dini bayram ve MEB ara tatil tarihleri yıl bazında backoffice'ten girilir; buradaki sabit tarihli tatiller her yıl aynıdır.

insert into public.app_settings (key, value) values
  ('ai.enabled', 'true'::jsonb),
  ('ai.default_model', '"claude-haiku-5-5"'::jsonb),
  ('ai.weekly_summary_day', '7'::jsonb),
  ('tasks.max_stars', '10'::jsonb),
  ('app.min_supported_version', '"0.1.0"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.holidays (country, kind, name, starts_on, ends_on, school_year) values
  ('TR', 'public', '{"tr": "Yılbaşı", "en": "New Year''s Day"}', '2027-01-01', '2027-01-01', '2026-2027'),
  ('TR', 'public', '{"tr": "Ulusal Egemenlik ve Çocuk Bayramı", "en": "National Sovereignty and Children''s Day"}', '2027-04-23', '2027-04-23', '2026-2027'),
  ('TR', 'public', '{"tr": "Emek ve Dayanışma Günü", "en": "Labour and Solidarity Day"}', '2027-05-01', '2027-05-01', '2026-2027'),
  ('TR', 'public', '{"tr": "Atatürk''ü Anma, Gençlik ve Spor Bayramı", "en": "Commemoration of Atatürk, Youth and Sports Day"}', '2027-05-19', '2027-05-19', '2026-2027'),
  ('TR', 'public', '{"tr": "Demokrasi ve Millî Birlik Günü", "en": "Democracy and National Unity Day"}', '2027-07-15', '2027-07-15', '2026-2027'),
  ('TR', 'public', '{"tr": "Zafer Bayramı", "en": "Victory Day"}', '2027-08-30', '2027-08-30', '2027-2028'),
  ('TR', 'half_day', '{"tr": "Cumhuriyet Bayramı arifesi", "en": "Republic Day eve"}', '2026-10-28', '2026-10-28', '2026-2027'),
  ('TR', 'public', '{"tr": "Cumhuriyet Bayramı", "en": "Republic Day"}', '2026-10-29', '2026-10-29', '2026-2027'),
  ('TR', 'half_day', '{"tr": "Cumhuriyet Bayramı arifesi", "en": "Republic Day eve"}', '2027-10-28', '2027-10-28', '2027-2028'),
  ('TR', 'public', '{"tr": "Cumhuriyet Bayramı", "en": "Republic Day"}', '2027-10-29', '2027-10-29', '2027-2028');
