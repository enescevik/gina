-- Synthetic B01 UI fixture (disposable gina_b01ui_* DB only).
insert into public.admins(user_id) values('{{admin}}');
insert into public.operations_members(user_id,role,expires_at) values('{{finance}}','finance',now()+interval '30 days');
insert into public.families(id,name,created_by,timezone,created_at) values
 ('b0100000-0000-4000-8000-000000000001','Kaya ailesi','{{parent}}','Europe/Istanbul',now()-interval '200 days'),
 ('b0100000-0000-4000-8000-000000000002','Kaya Aile Evi','{{parent}}','Europe/Istanbul',now()-interval '199 days');
insert into public.family_members(family_id,user_id) values('b0100000-0000-4000-8000-000000000001','{{parent}}');
insert into public.children(id,family_id,name,grade) values
 ('b0200000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','Elif',5),
 ('b0200000-0000-4000-8000-000000000002','b0100000-0000-4000-8000-000000000001','Can',3),
 ('b0200000-0000-4000-8000-000000000003','b0100000-0000-4000-8000-000000000002','Deniz',4);
insert into public.families(id,name,created_by,created_at)
 select ('b0300000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Sayfa '||lpad(g::text,3,'0'),'{{parent}}',now()-make_interval(mins=>g) from generate_series(1,130) g;
insert into public.help_tickets(id,family_id,created_by,kind,category,subject,status,created_at,updated_at) values
 ('b0400000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','{{parent}}','support','billing','Paket görünmüyor','open',now()-interval '2 days',now()-interval '2 days'),
 ('b0400000-0000-4000-8000-000000000002','b0100000-0000-4000-8000-000000000001','{{parent}}','idea','learning','Yeni ders','open',now()-interval '5 hours',now()-interval '5 hours');
insert into public.help_messages(ticket_id,author_id,author_role,visibility,body) values
 ('b0400000-0000-4000-8000-000000000001','{{parent}}','parent','family','Plus aldım ama görünmüyor');
insert into public.store_subscriptions(id,family_id,purchaser_user_id,platform,product_id,plan,store_key,status,expires_at,auto_renewing,created_at,last_source,notified_at)
 values('b0500000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','{{parent}}','apple','gina_plus_monthly','plus','b01ui-apple-key-1','active',now()+interval '20 days',false,now()-interval '40 days','notification',now()-interval '2 days');
insert into public.store_notifications(id,platform,event_key,event_type,store_key,payload,processed_at,received_at) values
 ('b0600000-0000-4000-8000-000000000001','apple','b01ui-evt-1','SUBSCRIBED:INITIAL_BUY','b01ui-apple-key-1','{"verified":true}',now()-interval '40 days',now()-interval '40 days'),
 ('b0600000-0000-4000-8000-000000000002','apple','b01ui-evt-2','DID_RENEW','b01ui-apple-key-1','{"verified":true}',now()-interval '10 days',now()-interval '10 days'),
 ('b0600000-0000-4000-8000-000000000003','apple','b01ui-evt-3','REFUND','b01ui-apple-key-1','{"verified":true}',null,now()-interval '1 day'),
 ('b0600000-0000-4000-8000-000000000004','apple','b01ui-evt-4','DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED','b01ui-apple-key-1','{"verified":true}',now()-interval '2 days',now()-interval '2 days');
insert into public.entitlement_overrides(id,family_id,plan,reason,granted_by,starts_at,ends_at,revoked_at,created_at) values
 ('b0700000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','pro','Önceki telafi (destek #12)','{{admin}}',now()-interval '30 days',now()-interval '20 days',null,now()-interval '30 days'),
 ('b0700000-0000-4000-8000-000000000002','b0100000-0000-4000-8000-000000000001','pro','Yanlış aileye verilmişti','{{admin}}',now()-interval '5 days',now()+interval '5 days',now()-interval '4 days',now()-interval '5 days');
insert into gina.store_reconcile_jobs(id,actor_id,family_id,subscription_id,reason,status,code,created_at,completed_at)
 values('b0800000-0000-4000-8000-000000000001','{{finance}}','b0100000-0000-4000-8000-000000000001','b0500000-0000-4000-8000-000000000001','Veli iade dedi, mağazadan kontrol','failed','store_not_configured',now()-interval '3 days',now()-interval '3 days');
insert into public.push_outbox(family_id,audience,kind,status,attempts,created_at) values('b0100000-0000-4000-8000-000000000001','parents','task_approved','failed',3,now()-interval '6 hours');
insert into public.ai_operation_jobs(family_id,action,input_hash,lease,status,error_code,created_at) values('b0100000-0000-4000-8000-000000000001','grade','h-b01ui',gen_random_uuid(),'failed','provider_error',now()-interval '2 hours');
