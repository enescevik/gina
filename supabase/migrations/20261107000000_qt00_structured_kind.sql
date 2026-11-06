-- QT00: yapılandırılmış soru ailesi. Enum değeri ayrı migration'da eklenir; aynı
-- işlemde kullanılamaz (PostgreSQL ADD VALUE kuralı). Eski 'multiple_choice' ve
-- 'open_ended' değerleri ve davranışları değişmez. Asıl etkileşim türü
-- question_bank.interaction_type + public.interaction_types kaydında tutulur.
alter type public.question_kind add value if not exists 'structured';
