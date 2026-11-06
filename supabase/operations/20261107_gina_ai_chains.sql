-- Seed after 20261107030000 and all nine Edge deployments. Does NOT enable routing.
-- Re-running preserves operator edits and existing assignments.
begin;
insert into public.ai_chains(id,name,attempt_seconds,total_seconds) values
 ('a1000000-0000-4000-8000-000000000001','Değerlendirme · Sol → Sonnet → Opus',45,120),
 ('a1000000-0000-4000-8000-000000000002','Genel metin · Sonnet → Sol → Haiku',45,120),
 ('a1000000-0000-4000-8000-000000000003','Belge ve görsel · Sonnet → Haiku',60,130),
 ('a1000000-0000-4000-8000-000000000004','Soru üretimi · Sonnet → Sol → Opus',90,130)
on conflict(id) do nothing;
insert into public.ai_chain_steps(chain_id,position,model_id)
select c.id,s.position,s.model_id from (values
 ('a1000000-0000-4000-8000-000000000001'::uuid,1,'gpt-6.1-sol'),
 ('a1000000-0000-4000-8000-000000000001'::uuid,2,'claude-sonnet-5-5'),
 ('a1000000-0000-4000-8000-000000000001'::uuid,3,'claude-opus-5-5'),
 ('a1000000-0000-4000-8000-000000000002'::uuid,1,'claude-sonnet-5-5'),
 ('a1000000-0000-4000-8000-000000000002'::uuid,2,'gpt-6.1-sol'),
 ('a1000000-0000-4000-8000-000000000002'::uuid,3,'claude-haiku-5-5'),
 ('a1000000-0000-4000-8000-000000000003'::uuid,1,'claude-sonnet-5-5'),
 ('a1000000-0000-4000-8000-000000000003'::uuid,2,'claude-haiku-5-5'),
 ('a1000000-0000-4000-8000-000000000004'::uuid,1,'claude-sonnet-5-5'),
 ('a1000000-0000-4000-8000-000000000004'::uuid,2,'gpt-6.1-sol'),
 ('a1000000-0000-4000-8000-000000000004'::uuid,3,'claude-opus-5-5')
) s(chain_id,position,model_id) join public.ai_chains c on c.id=s.chain_id
where not exists(select 1 from public.ai_chain_steps x where x.chain_id=c.id);
insert into public.ai_chain_assignments(usage_key,chain_id) values
 ('open_ended_grading','a1000000-0000-4000-8000-000000000001'),
 ('study_plan','a1000000-0000-4000-8000-000000000002'),
 ('weekly_summary','a1000000-0000-4000-8000-000000000002'),
 ('setup_suggestions','a1000000-0000-4000-8000-000000000002'),
 ('content_prereview','a1000000-0000-4000-8000-000000000002'),
 ('notebook_review','a1000000-0000-4000-8000-000000000003'),
 ('timetable_import','a1000000-0000-4000-8000-000000000003'),
 ('learning_plan_import','a1000000-0000-4000-8000-000000000003'),
 ('question_generation','a1000000-0000-4000-8000-000000000004')
on conflict(usage_key) do nothing;
commit;
