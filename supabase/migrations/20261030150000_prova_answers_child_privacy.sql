-- PROVA.md: AI/veli geri bildirimi çocuğa yalnız veli onayıyla ulaşır. Çocuk cihazı cevap satırlarını
-- doğrudan okumaz (feedback, ai_feedback, ai_details sızmasın); çözme akışı RPC'lerle yürür ve sonuç
-- özeti exam_attempts'ten okunur. Onaylı geri bildirimi çocuğa göstermek ileride ayrı bir RPC ile gelir.
drop policy if exists exam_answers_device_select on public.exam_answers;
