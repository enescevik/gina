-- Synthetic B03/B04 UI fixture (disposable gina_b34_* DB only). No real people or addresses.
insert into public.admins(user_id) values('{{admin}}');
insert into public.operations_members(user_id,role,expires_at) values('{{support}}','support',now()+interval '30 days');
insert into public.families(id,name,created_by,timezone) values
 ('b3400000-0000-4000-8000-000000000001','Aydın ailesi','{{p1}}','Europe/Istanbul'),
 ('b3400000-0000-4000-8000-000000000002','Bulut ailesi','{{p2}}','Europe/Istanbul'),
 ('b3400000-0000-4000-8000-000000000003','Çınar ailesi','{{p3}}','Europe/Istanbul'),
 ('b3400000-0000-4000-8000-000000000004','Duru ailesi','{{p4}}','Europe/Istanbul');
insert into public.family_members(family_id,user_id) values
 ('b3400000-0000-4000-8000-000000000001','{{p1}}'),('b3400000-0000-4000-8000-000000000002','{{p2}}'),
 ('b3400000-0000-4000-8000-000000000003','{{p3}}'),('b3400000-0000-4000-8000-000000000004','{{p4}}');
insert into public.children(id,family_id,name,grade) values
 ('b3410000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','Ada',5),
 ('b3410000-0000-4000-8000-000000000002','b3400000-0000-4000-8000-000000000002','Bora',5),
 ('b3410000-0000-4000-8000-000000000003','b3400000-0000-4000-8000-000000000003','Cem',5),
 ('b3410000-0000-4000-8000-000000000004','b3400000-0000-4000-8000-000000000004','Defne',5);

-- Destek: veli 26 saattir bekliyor (ekip notu beklemeyi kapatmaz), cevaplanmış talep, fikirler.
insert into public.help_tickets(id,family_id,created_by,kind,category,subject,status,created_at,updated_at) values
 ('b3420000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','{{p1}}','support','billing','Plus paketim görünmüyor','open',now()-interval '3 days',now()-interval '26 hours'),
 ('b3420000-0000-4000-8000-000000000002','b3400000-0000-4000-8000-000000000002','{{p2}}','support','device','Tablet eşleştirme kodu reddediliyor','in_progress',now()-interval '1 day',now()-interval '2 hours'),
 ('b3420000-0000-4000-8000-000000000003','b3400000-0000-4000-8000-000000000001','{{p1}}','idea','learning','Matematik oyunları ekleyin','open',now()-interval '5 days',now()-interval '5 days'),
 ('b3420000-0000-4000-8000-000000000004','b3400000-0000-4000-8000-000000000003','{{p3}}','idea','learning','Matematik oyunu eklenebilir mi','open',now()-interval '4 days',now()-interval '4 days'),
 ('b3420000-0000-4000-8000-000000000005','b3400000-0000-4000-8000-000000000004','{{p4}}','idea','other','Karanlık tema','open',now()-interval '3 days',now()-interval '3 days');
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body,created_at) values
 ('b3420000-0000-4000-8000-000000000001','{{p1}}','parent','family','Satın aldım ama uygulamada Plus görünmüyor.',now()-interval '3 days'),
 ('b3420000-0000-4000-8000-000000000001','{{support}}','support','family','Kontrol ediyoruz, kısa süre içinde döneceğiz.',now()-interval '2 days'),
 ('b3420000-0000-4000-8000-000000000001','{{p1}}','parent','family','Hâlâ görünmüyor, yardımcı olur musunuz?',now()-interval '26 hours'),
 ('b3420000-0000-4000-8000-000000000001','{{support}}','support','internal','Mağaza makbuzu eksik görünüyor; finans ekibine soruldu.',now()-interval '20 hours'),
 ('b3420000-0000-4000-8000-000000000002','{{p2}}','parent','family','Tablet kodu kabul etmiyor.',now()-interval '1 day'),
 ('b3420000-0000-4000-8000-000000000002','{{support}}','support','family','Yeni bir kod üretip hemen girmeyi deneyebilir misiniz?',now()-interval '2 hours'),
 ('b3420000-0000-4000-8000-000000000003','{{p1}}','parent','family','Çocuğum oyunla daha iyi öğreniyor.',now()-interval '5 days'),
 ('b3420000-0000-4000-8000-000000000004','{{p3}}','parent','family','Toplama için oyun olsa güzel olur.',now()-interval '4 days'),
 ('b3420000-0000-4000-8000-000000000005','{{p4}}','parent','family','Akşam ekran çok parlak.',now()-interval '3 days');

-- Yardım yazısı: yayında v1, ayrı taslak v2 (taslak canlıyı değiştirmez).
insert into public.help_articles(id,slug,locale,platform,revision,published_revision) values
 ('b3430000-0000-4000-8000-000000000001','paket-gorunmuyor','tr','all',2,null);
insert into public.help_article_versions(article_id,revision,title,body,created_by,reviewed_by,reviewed_at) values
 ('b3430000-0000-4000-8000-000000000001',1,'Paketim görünmüyor',E'## Kısa cevap\nSatın alımı yapan hesapla giriş yapıp satın alımları geri yükleyin.\n\n## Adımlar\n1. Ebeveyn uygulamasında Ayarlar bölümünü açın.\n2. Paket sayfasında Satın alımları geri yükle seçeneğine dokunun.\n\n## Bağlantılar\n- [Paket ayarları](gina://settings/plan)','{{admin}}','{{admin}}',now()-interval '2 days'),
 ('b3430000-0000-4000-8000-000000000001',2,'Paketim görünmüyor',E'## Kısa cevap\nTASLAK: Mağaza hesabınızı kontrol edin, ardından satın alımları geri yükleyin.\n\n## Adımlar\n1. Mağaza hesabınızın aynı olduğunu kontrol edin.\n2. Ayarlar > Paket > Satın alımları geri yükle.','{{admin}}',null,null);
update public.help_articles set published_revision=1 where id='b3430000-0000-4000-8000-000000000001';

-- Kanal hazırlığı: e-posta ayarlı ama görev raporu/sırlar eksik; SMS gönderen adı yok.
insert into public.app_settings(key,value) values
 ('channels.email.provider','"resend"'),('channels.email.from_address','"destek@example.invalid"'),
 ('channels.email.sender_domain_verified','true'),('channels.sms.provider','"generic"')
on conflict(key) do update set value=excluded.value;
insert into gina.channel_provider_status(channel,provider,configured,missing,reported_at) values
 ('email','resend',false,'{RESEND_API_KEY}',now()),('push','apns',false,'{APNS_KEY}',now())
on conflict(channel) do update set provider=excluded.provider,configured=excluded.configured,missing=excluded.missing,reported_at=excluded.reported_at;
insert into gina.contact_channels(user_id,kind,value) values('{{p1}}','email','p1@example.invalid');

-- Duyuru taslağı (e-posta kanalı seçili) ve push kayıtları.
insert into gina.parent_announcements(id,title,body,push,channels,expires_on,status,revision,created_by) values
 ('b3440000-0000-4000-8000-000000000001','Birlikte Prova haftası','Bu hafta 5. sınıflar için Birlikte Prova açık. Katılım isteğe bağlıdır.',true,array['email'],current_date+14,'draft',1,'{{admin}}');
insert into public.push_outbox(family_id,audience,kind,payload,status,attempts,created_at) values
 ('b3400000-0000-4000-8000-000000000001','parents','parent_announcement','{}','failed',3,now()-interval '6 hours'),
 ('b3400000-0000-4000-8000-000000000002','parents','task_approved','{}','sent',1,now()-interval '1 day');
