-- C07 synthetic additions (disposable gina_c07_* DB only). No real people, addresses or tokens.
begin;
-- Operatör rolleri: içerik / finans / yayın (destek seed.sql'de). Hiçbiri admins tablosunda değil.
insert into public.operations_members(user_id,role,expires_at) values
 ('{{content}}','content',now()+interval '30 days'),
 ('{{finance}}','finance',now()+interval '30 days'),
 ('{{release}}','release',now()+interval '30 days');
-- Aydın ailesi İngilizce kullanır: hazır yanıtlar varsayılan olarak EN gelir.
update public.families set locale='en' where id='b3400000-0000-4000-8000-000000000001';
-- Sorumlusuz tanımı: T2 destek ekibine atanmış (eski tanımda iki talep de "cevaplandı" diye sayılmazdı).
update public.help_tickets set assignee_id='{{support}}',assigned_at=now()-interval '1 hour' where id='b3420000-0000-4000-8000-000000000002';
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body,created_at) values
 ('b3420000-0000-4000-8000-000000000002','{{support}}','support','internal','C07-GIZLI-EKIP-NOTU yalnız ekip',now()-interval '30 minutes');
-- 130 ek aile (finans aramasında ilk 50'nin ötesi).
insert into public.families(id,name,created_by,timezone,created_at)
select ('c0700000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Sentetik aile '||lpad(g::text,3,'0'),'{{p1}}','Europe/Istanbul',now()-g*interval '1 hour'
from generate_series(1,130) g;
-- 230 koleksiyon (içerik listesinde ilk 200'ün ötesi) ve AI'nin yönetici kararı istediği bir senaryo adayı.
insert into public.library_collections(id,title,grade,subject,status,created_at)
select ('c0710000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'C07 koleksiyon '||lpad(g::text,3,'0'),5,'math','draft',now()-g*interval '1 minute'
from generate_series(1,230) g;
insert into gina.curriculum_candidates(id,external_key,source_sha256,candidate,content_hash,status,created_by) values
 ('c0720000-0000-4000-8000-000000000001','c07-senaryo-1',repeat('a',64),'{"label":"5. sınıf matematik 1. dönem 1. yazılı","grade":5,"subject":"math"}',repeat('b',64),'draft','{{admin}}');
insert into gina.content_prereviews(target_kind,target_id,content_hash,prereview_status,prereview_at) values
 ('curriculum_candidate','c0720000-0000-4000-8000-000000000001',repeat('b',64),'needs_admin',now());
-- Push hedefi: Aydın velisinin iki cihazı ve açık oturumu var; Bulut velisinin cihazı var ama duyuru bildirimi kapalı.
insert into public.push_tokens(user_id,family_id,role,platform,token,token_type,locale) values
 ('{{p1}}','b3400000-0000-4000-8000-000000000001','parent','ios','c07-synthetic-token-a','apns','en'),
 ('{{p1}}','b3400000-0000-4000-8000-000000000001','parent','android','c07-synthetic-token-b','fcm','en'),
 ('{{p2}}','b3400000-0000-4000-8000-000000000002','parent','ios','c07-synthetic-token-c','apns','tr');
insert into public.push_preferences(user_id,family_id,announcements) values('{{p2}}','b3400000-0000-4000-8000-000000000002',false);
commit;
