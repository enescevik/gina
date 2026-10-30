-- Resimli v3 koleksiyon setiyle eşleşen rozet ikonları (PR #10: badge-tooth-care eklendi).
update public.badge_definitions set icon = 'badge-tooth-care' where slug = 'dis-parlatan';

-- Seti kullanan ek rozetler (planlı bakım kuralıyla; geçmişe toplu ödül yok — onay anında değerlendirilir).
insert into public.badge_definitions (slug, title_i18n, icon, rule, sort_order) values
  ('duzenli', '{"tr": "Düzenli", "en": "Tidy"}', 'badge-tidy', '{"kind": "planned_care", "params": {"icon": "tidy-room", "count": 10}}', 4),
  ('matematik-yildizi', '{"tr": "Matematik Yıldızı", "en": "Math Star"}', 'badge-math-star', '{"kind": "planned_care", "params": {"icon": "homework-math", "count": 10}}', 5),
  ('erken-kus', '{"tr": "Erken Kuş", "en": "Early Bird"}', 'badge-early-bird', '{"kind": "planned_care", "params": {"icon": "make-bed", "count": 14}}', 6)
on conflict (slug) do nothing;
