-- GINA account-specific catalog snapshot, not a global seed migration.
-- Discovered through authenticated Models API on 2026-11-07; no credentials or user data.
-- Safe to repeat: existing model configuration is preserved; production routes never change.
-- Apply only to the verified GINA deployment using the release Management API helper.
insert into public.ai_models(id,provider,display_name,active,notes) values
 ('chat-latest','openai_compatible','chat-latest',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('chatgpt-image-latest','openai_compatible','chatgpt-image-latest',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4.1','openai_compatible','gpt-4.1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4.1-2025-04-14','openai_compatible','gpt-4.1-2025-04-14',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4.1-mini','openai_compatible','gpt-4.1-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4.1-mini-2025-04-14','openai_compatible','gpt-4.1-mini-2025-04-14',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o','openai_compatible','gpt-4o',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-2024-08-06','openai_compatible','gpt-4o-2024-08-06',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-2024-11-20','openai_compatible','gpt-4o-2024-11-20',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini','openai_compatible','gpt-4o-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-2024-07-18','openai_compatible','gpt-4o-mini-2024-07-18',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-transcribe','openai_compatible','gpt-4o-mini-transcribe',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-transcribe-2025-03-20','openai_compatible','gpt-4o-mini-transcribe-2025-03-20',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-transcribe-2025-12-15','openai_compatible','gpt-4o-mini-transcribe-2025-12-15',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-tts','openai_compatible','gpt-4o-mini-tts',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-tts-2025-03-20','openai_compatible','gpt-4o-mini-tts-2025-03-20',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-mini-tts-2025-12-15','openai_compatible','gpt-4o-mini-tts-2025-12-15',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-transcribe','openai_compatible','gpt-4o-transcribe',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-4o-transcribe-diarize','openai_compatible','gpt-4o-transcribe-diarize',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5','openai_compatible','gpt-5',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-2025-08-07','openai_compatible','gpt-5-2025-08-07',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-mini','openai_compatible','gpt-5-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-mini-2025-08-07','openai_compatible','gpt-5-mini-2025-08-07',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-nano','openai_compatible','gpt-5-nano',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-nano-2025-08-07','openai_compatible','gpt-5-nano-2025-08-07',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-pro','openai_compatible','gpt-5-pro',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-pro-2025-10-06','openai_compatible','gpt-5-pro-2025-10-06',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-search-api','openai_compatible','gpt-5-search-api',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5-search-api-2025-10-14','openai_compatible','gpt-5-search-api-2025-10-14',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.1','openai_compatible','gpt-5.1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.1-2025-11-13','openai_compatible','gpt-5.1-2025-11-13',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.2','openai_compatible','gpt-5.2',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.2-2025-12-11','openai_compatible','gpt-5.2-2025-12-11',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.2-pro','openai_compatible','gpt-5.2-pro',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.2-pro-2025-12-11','openai_compatible','gpt-5.2-pro-2025-12-11',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.3-codex','openai_compatible','gpt-5.3-codex',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4','openai_compatible','gpt-5.4',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-2026-03-05','openai_compatible','gpt-5.4-2026-03-05',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-mini','openai_compatible','gpt-5.4-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-mini-2026-03-17','openai_compatible','gpt-5.4-mini-2026-03-17',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-nano','openai_compatible','gpt-5.4-nano',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-nano-2026-03-17','openai_compatible','gpt-5.4-nano-2026-03-17',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-pro','openai_compatible','gpt-5.4-pro',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.4-pro-2026-03-05','openai_compatible','gpt-5.4-pro-2026-03-05',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.5','openai_compatible','gpt-5.5',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.5-2026-04-23','openai_compatible','gpt-5.5-2026-04-23',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.5-pro','openai_compatible','gpt-5.5-pro',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.5-pro-2026-04-23','openai_compatible','gpt-5.5-pro-2026-04-23',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.6-luna','openai_compatible','gpt-5.6-luna',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.6-sol','openai_compatible','gpt-5.6-sol',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-5.6-terra','openai_compatible','gpt-5.6-terra',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-6-astra','openai_compatible','gpt-6-astra',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-6-luna','openai_compatible','gpt-6-luna',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-6-sol','openai_compatible','gpt-6-sol',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-6.1-sol','openai_compatible','gpt-6.1-sol',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-6.1-terra','openai_compatible','gpt-6.1-terra',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-audio','openai_compatible','gpt-audio',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-audio-1.5','openai_compatible','gpt-audio-1.5',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-audio-2025-08-28','openai_compatible','gpt-audio-2025-08-28',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-audio-mini','openai_compatible','gpt-audio-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-audio-mini-2025-12-15','openai_compatible','gpt-audio-mini-2025-12-15',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-1-mini','openai_compatible','gpt-image-1-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-1.5','openai_compatible','gpt-image-1.5',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2','openai_compatible','gpt-image-2',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2-2026-04-21','openai_compatible','gpt-image-2-2026-04-21',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.5-flare','openai_compatible','gpt-image-2.5-flare',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.5-flare-2026-09-08','openai_compatible','gpt-image-2.5-flare-2026-09-08',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.5-sunburst','openai_compatible','gpt-image-2.5-sunburst',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.5-sunburst-2026-09-08','openai_compatible','gpt-image-2.5-sunburst-2026-09-08',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.6-flare','openai_compatible','gpt-image-2.6-flare',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-image-2.6-sunburst','openai_compatible','gpt-image-2.6-sunburst',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-live-1','openai_compatible','gpt-live-1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-live-transcribe','openai_compatible','gpt-live-transcribe',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime','openai_compatible','gpt-realtime',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-1.5','openai_compatible','gpt-realtime-1.5',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-2','openai_compatible','gpt-realtime-2',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-2.1','openai_compatible','gpt-realtime-2.1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-2.1-mini','openai_compatible','gpt-realtime-2.1-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-2025-08-28','openai_compatible','gpt-realtime-2025-08-28',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-mini','openai_compatible','gpt-realtime-mini',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-mini-2025-12-15','openai_compatible','gpt-realtime-mini-2025-12-15',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-translate','openai_compatible','gpt-realtime-translate',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-realtime-whisper','openai_compatible','gpt-realtime-whisper',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('gpt-transcribe','openai_compatible','gpt-transcribe',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('o3','openai_compatible','o3',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('o3-2025-04-16','openai_compatible','o3-2025-04-16',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('omni-moderation-2024-09-26','openai_compatible','omni-moderation-2024-09-26',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('omni-moderation-latest','openai_compatible','omni-moderation-latest',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('text-embedding-3-large','openai_compatible','text-embedding-3-large',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('text-embedding-3-small','openai_compatible','text-embedding-3-small',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('text-embedding-ada-002','openai_compatible','text-embedding-ada-002',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('tts-1','openai_compatible','tts-1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('tts-1-1106','openai_compatible','tts-1-1106',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('tts-1-hd','openai_compatible','tts-1-hd',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('tts-1-hd-1106','openai_compatible','tts-1-hd-1106',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('whisper-1','openai_compatible','whisper-1',false,'Account API inventory 2026-11-07. Adapter contract not verified; do not route production work.')
on conflict(id) do nothing;

-- Five synthetic JSON calls passed through the actual openai-chat adapter.
-- Text-only certification: vision/PDF flags deliberately remain false until separately tested.
-- Official model specs: https://developers.openai.com/api/docs/models/gpt-6-luna
-- https://developers.openai.com/api/docs/models/gpt-6.1-sol
-- https://developers.openai.com/api/docs/models/gpt-6-astra
-- https://developers.openai.com/api/docs/models/gpt-6.1-terra
update public.ai_providers set status='active',notes='GINA project key verified: Models API and five text JSON adapter contracts, 2026-11-07. Project spend cap USD 100/month.' where id='openai_compatible';
update public.ai_models set adapter='openai-chat',supports_json_schema=true,
 context_tokens=1050000,contract_version='catalog-text-v1',active=true,
 cost_class=case when id='gpt-6-luna' then 'low' when id='gpt-6-astra' then 'high' else 'medium' end,
 notes='Account-accessible; synthetic text JSON adapter contract passed 2026-11-07. Media and tool chains not certified. No route change.'
where id in ('gpt-6-luna','gpt-6.1-sol','gpt-6-astra','gpt-6.1-terra');
-- Legacy Sol remains archived; current Sol 6.1 is the selectable version.
update public.ai_models set active=false,
 notes='Archived in favor of gpt-6.1-sol. Retained for historical references; not selectable.'
where id='gpt-6-sol';

-- Claude GINA workspace: all 14 Models API entries, preserving existing configuration.
insert into public.ai_models(id,provider,display_name,active,adapter,context_tokens,supports_json_schema,tokenizer,notes) values
 ('claude-fable-5','anthropic','Claude Fable 5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-fable-5-1','anthropic','Claude Fable 5.1',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-haiku-4-5-20251001','anthropic','Claude Haiku 4.5',false,'anthropic-messages',200000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-haiku-5-5','anthropic','Claude Haiku 5.5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-4-5-20251101','anthropic','Claude Opus 4.5',false,'anthropic-messages',200000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-4-6','anthropic','Claude Opus 4.6',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-4-7','anthropic','Claude Opus 4.7',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-4-8','anthropic','Claude Opus 4.8',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-5','anthropic','Claude Opus 5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-opus-5-5','anthropic','Claude Opus 5.5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-sonnet-4-5-20250929','anthropic','Claude Sonnet 4.5',false,'anthropic-messages',200000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-sonnet-4-6','anthropic','Claude Sonnet 4.6',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-sonnet-5','anthropic','Claude Sonnet 5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.'),
 ('claude-sonnet-5-5','anthropic','Claude Sonnet 5.5',false,'anthropic-messages',1000000,true,'provider_count','Account Models API inventory 2026-11-07. Adapter contract not verified; do not route production work.')
on conflict(id) do nothing;
-- Current Claude text JSON contracts verified with GINA Production v2.
-- Existing Sonnet/Haiku media declarations are preserved; newly registered models remain text-only.
update public.ai_models set contract_version='catalog-text-v1',active=true,
 cost_class=case when id='claude-haiku-5-5' then 'low' when id in ('claude-opus-5-5','claude-fable-5-1') then 'high' else 'medium' end,
 notes='GINA workspace key verified; synthetic text JSON adapter contract passed 2026-11-07. Existing media capabilities preserved; no route change.'
where id in ('claude-sonnet-5-5','claude-haiku-5-5','claude-opus-5-5','claude-fable-5-1');
update public.ai_providers set notes='GINA workspace key verified: Models API and four text JSON adapter contracts, 2026-11-07. Workspace spend cap USD 100/month.' where id='anthropic';
