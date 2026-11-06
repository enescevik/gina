-- QT yayın anahtarı (1A/1B + 2A + 2B toplu yayın, Enes kararı 6 Kasım 2026): Faz 2A ve 2B türlerini açar.
-- Bu migration YALNIZ istemci anahtarları (support.ts PHASE2A/PHASE2B) açık yapı ve 2A/2B'yi bilen Edge
-- prova-generate ile aynı yayında uygulanır. Faz 3 (crossword) kapalı kalır. Geri alma: enabled=false
-- (mevcut soru/cevap/puan silinmez; yeni hazırlama/atama durur).
update public.interaction_types set enabled = true where phase in ('2A', '2B');
