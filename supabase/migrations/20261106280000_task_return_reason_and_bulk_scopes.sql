-- C03 (U06/U07/L02/L03): görev geri gönderme nedeni, haftalık öneriden görev formuna çocuk bağı,
-- yardım yanıt takibi ve kişisel verisi gizlenmiş yardım eki.
-- Toplu arşiv (20261106030000) ve silme önizlemesi (20261106040000) sözleşmeleri yeniden yazılmaz;
-- takvim/Prova taslağı/çalışma planı/çanta seçimleri istemcide mevcut preview/apply/history RPC'lerine bağlanır.

-- 1. Geri gönderme nedeni ------------------------------------------------------------------------------------------
-- Neden yalnız yetkili velinin review_task_once çağrısıyla yazılır; çocuk kendi gönderiminde, iki veli de aile
-- kapsamında okur (mevcut task_completions RLS'i). Bildirim yükü nedeni taşımaz (kilit ekranına serbest metin düşmez).
alter table public.task_completions
 add column return_reason text,
 add column return_note text;
alter table public.task_completions
 add constraint task_completions_return_reason_check check (return_reason is null or return_reason in
  ('not_finished','needs_care','missing_part','do_together','wrong_day','other')),
 add constraint task_completions_return_note_check check (return_note is null or
  (return_reason is not null and char_length(return_note) between 1 and 140));

-- Durum geçişinde nedeni yalnız aynı işlemdeki review_task_once ayarından al; onayda temizle.
-- Yeniden gönderimde (returned → done) neden veliye bağlam olarak kalır; doğrudan neden değişikliği kabul edilmez.
create function gina.task_completion_return_reason() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status then
  if new.status='returned' then
   new.return_reason:=nullif(current_setting('gina.return_reason',true),'');
   new.return_note:=case when new.return_reason is null then null else nullif(current_setting('gina.return_note',true),'') end;
  elsif new.status='approved' then
   new.return_reason:=null; new.return_note:=null;
  end if;
 else
  new.return_reason:=old.return_reason; new.return_note:=old.return_note;
 end if;
 return new;
end $$;
revoke all on function gina.task_completion_return_reason() from public,anon,authenticated;
create trigger task_completion_return_reason before update on public.task_completions
 for each row execute function gina.task_completion_return_reason();

-- Eski 4 argümanlı imza kaldırılır; yeni imza aynı adlı argümanlarla eski çağrıyı karşılar (PostgREST belirsizliği yok).
-- Nedensiz istek gövdesi eskisiyle birebir aynıdır: eski makbuzla tekrar aynı sonucu döner.
drop function public.review_task_once(uuid,uuid,boolean,timestamptz);
create function public.review_task_once(
 p_request_id uuid, p_completion_id uuid, p_approve boolean, p_expected_completed_at timestamptz,
 p_return_reason text default null, p_return_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mutation_receipts; c public.task_completions; body jsonb; result jsonb; f uuid:=gina.family_id();
 note text:=nullif(btrim(regexp_replace(coalesce(p_return_note,''),'[[:space:][:cntrl:]]+',' ','g')),'');
begin
 if not gina.is_parent() or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_approve is null or p_expected_completed_at is null then raise exception 'invalid_input'; end if;
 if p_approve and (p_return_reason is not null or note is not null) then raise exception 'invalid_input'; end if;
 if p_return_reason is not null and p_return_reason not in ('not_finished','needs_care','missing_part','do_together','wrong_day','other') then
  raise exception 'return_reason_invalid'; end if;
 if note is not null and (p_return_reason is null or char_length(note)>140) then raise exception 'return_note_invalid'; end if;
 if p_return_reason='other' and note is null then raise exception 'return_note_required'; end if;
 body:=jsonb_build_object('completion',p_completion_id,'approve',p_approve,'completed_at',p_expected_completed_at);
 if p_return_reason is not null then body:=body||jsonb_build_object('return_reason',p_return_reason,'return_note',note); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,27));
 select * into r from public.mutation_receipts where request_id=p_request_id;
 if found then
  if r.actor_id<>auth.uid() or r.family_id<>f or r.operation<>'review_task' or r.payload<>body then raise exception 'request_conflict'; end if;
  return r.result;
 end if;
 select * into c from public.task_completions where id=p_completion_id and family_id=f for update;
 if c.id is null then raise exception 'not_found'; end if;
 if c.completed_at is distinct from p_expected_completed_at then raise exception 'submission_changed'; end if;
 perform set_config('gina.return_reason',coalesce(p_return_reason,''),true);
 perform set_config('gina.return_note',coalesce(note,''),true);
 select to_jsonb(t) into result from public.review_task(p_completion_id,p_approve) t;
 perform set_config('gina.return_reason','',true);
 perform set_config('gina.return_note','',true);
 insert into public.mutation_receipts(request_id,family_id,actor_id,operation,payload,result)
 values(p_request_id,f,auth.uid(),'review_task',body,result);
 return result;
end; $$;
revoke all on function public.review_task_once(uuid,uuid,boolean,timestamptz,text,text) from public,anon,service_role;
grant execute on function public.review_task_once(uuid,uuid,boolean,timestamptz,text,text) to authenticated;

-- 2. Haftalık öneri → görev formu ---------------------------------------------------------------------------------
-- get_family_weekly_review yanıtı .strict() ile doğrulandığı için genişletilmez (eski istemci kırılmasın).
-- Ayrı okuma: o haftanın takma adı → bugün hâlâ aktif olan çocuk kimliği. Arşivli/silinmiş çocuk eşleşmez.
create function public.weekly_review_children(p_week date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id(); aliases jsonb;
begin
 if auth.uid() is null or not coalesce(gina.is_parent(),false) or f is null then raise exception 'weekly_forbidden' using errcode='42501'; end if;
 if p_week is null or not isfinite(p_week) or extract(isodow from p_week)<>1 then raise exception 'weekly_date'; end if;
 select c.child_aliases into aliases from gina.weekly_summary_contexts c where c.family_id=f and c.week_start=p_week;
 if aliases is null then
  select coalesce(jsonb_object_agg(k.alias,k.id),'{}') into aliases from gina.weekly_children(f) k;
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('alias',a.key,'child_id',ch.id,'name',ch.name) order by a.key),'[]')
  from jsonb_each_text(aliases) a join public.children ch on ch.id::text=a.value and ch.family_id=f and ch.archived_at is null);
end $$;
revoke all on function public.weekly_review_children(date) from public,anon,service_role;
grant execute on function public.weekly_review_children(date) to authenticated;

-- 3. Yardım yanıt takibi -------------------------------------------------------------------------------------------
-- Kullanıcı başına son görülen aile mesajı. Ekip içi not (visibility='internal') hiçbir sayıma girmez.
create table gina.help_ticket_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 ticket_id uuid not null references public.help_tickets(id) on delete cascade,
 last_seen_sequence bigint not null check (last_seen_sequence>=0),
 seen_at timestamptz not null default now(),
 primary key(user_id,ticket_id)
);
alter table gina.help_ticket_reads enable row level security;
revoke all on gina.help_ticket_reads from public,anon,authenticated,service_role;

create function public.help_ticket_updates() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid:=gina.family_id();
begin
 if auth.uid() is null or not coalesce(gina.is_parent(),false) or f is null then raise exception 'forbidden' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'last_support_sequence',x.last_support,
   'last_support_at',x.last_support_at,'last_seen_sequence',x.seen,'unread',coalesce(x.last_support,0)>coalesce(x.seen,0)) order by x.updated_at desc),'[]')
  from (select t.id,t.status,t.updated_at,
    (select max(m.sequence) from public.help_messages m where m.ticket_id=t.id and m.author_role='support' and m.visibility='family') last_support,
    (select max(m.created_at) from public.help_messages m where m.ticket_id=t.id and m.author_role='support' and m.visibility='family') last_support_at,
    (select r.last_seen_sequence from gina.help_ticket_reads r where r.user_id=auth.uid() and r.ticket_id=t.id) seen
   from public.help_tickets t where t.family_id=f order by t.updated_at desc limit 100) x);
end $$;
revoke all on function public.help_ticket_updates() from public,anon,service_role;
grant execute on function public.help_ticket_updates() to authenticated;

-- Monoton: daha eski bir sıra (geç gelen istek) okunmuşluğu geri almaz; görünmeyen (iç) mesaj sırası kabul edilmez.
create function public.mark_help_ticket_read(p_ticket_id uuid, p_sequence bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.help_tickets; top bigint; seen bigint;
begin
 select * into t from public.help_tickets where id=p_ticket_id;
 if auth.uid() is null or not coalesce(gina.is_parent(),false) or t.id is null or t.family_id is distinct from gina.family_id() then
  raise exception 'forbidden' using errcode='42501'; end if;
 if p_sequence is null or p_sequence<0 then raise exception 'invalid_input'; end if;
 select coalesce(max(sequence),0) into top from public.help_messages where ticket_id=t.id and visibility='family';
 insert into gina.help_ticket_reads(user_id,ticket_id,last_seen_sequence) values(auth.uid(),t.id,least(p_sequence,top))
 on conflict(user_id,ticket_id) do update set last_seen_sequence=greatest(gina.help_ticket_reads.last_seen_sequence,excluded.last_seen_sequence),
  seen_at=case when excluded.last_seen_sequence>gina.help_ticket_reads.last_seen_sequence then now() else gina.help_ticket_reads.seen_at end
 returning last_seen_sequence into seen;
 return jsonb_build_object('id',t.id,'last_seen_sequence',seen);
end $$;
revoke all on function public.mark_help_ticket_read(uuid,bigint) from public,anon,service_role;
grant execute on function public.mark_help_ticket_read(uuid,bigint) to authenticated;

-- 4. Kişisel verisi gizlenmiş yardım eki ----------------------------------------------------------------------------
-- Görsel cihazda kırpılır ve yeniden kodlanır (EXIF/konum düşer); veli "kişisel bilgi yok" onayı vermeden gönderilemez.
-- Ek Storage'a değil, yalnız RPC ile okunan kapalı tabloya yazılır: istemciye doğrudan tablo/bağlantı yetkisi yok.
create table public.help_attachments (
 id uuid primary key,
 ticket_id uuid not null references public.help_tickets(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 created_by uuid references auth.users(id) on delete set null,
 mime text not null check (mime in ('image/jpeg','image/png')),
 bytes int not null check (bytes between 1 and 600000),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 width int check (width between 1 and 4096), height int check (height between 1 and 4096),
 redaction jsonb not null,
 data bytea not null,
 created_at timestamptz not null default now()
);
create index help_attachments_ticket_idx on public.help_attachments(ticket_id,created_at);
alter table public.help_attachments enable row level security;
revoke all on public.help_attachments from public,anon,authenticated;
grant all on public.help_attachments to service_role;

create function public.add_help_attachment(p_request_id uuid, p_ticket_id uuid, p_attachment_id uuid, p_mime text,
 p_data text, p_width int, p_height int, p_redaction jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.help_tickets; raw bytea; h text; payload jsonb; result jsonb;
begin
 if auth.uid() is null or not coalesce(gina.is_parent(),false) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into t from public.help_tickets where id=p_ticket_id;
 if t.id is null or t.family_id is distinct from gina.family_id() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_attachment_id is null or p_mime is null or p_mime not in ('image/jpeg','image/png') or p_data is null or length(p_data)>820000
  or p_redaction is null or jsonb_typeof(p_redaction)<>'object' then raise exception 'invalid_input'; end if;
 if (p_redaction->>'confirmed_no_personal_data') is distinct from 'true' or (p_redaction->>'metadata_removed') is distinct from 'true' then
  raise exception 'help_attachment_not_redacted'; end if;
 begin raw:=decode(p_data,'base64'); exception when others then raise exception 'invalid_input'; end;
 if length(raw) not between 1 and 600000 then raise exception 'help_attachment_too_large'; end if;
 if not ((p_mime='image/jpeg' and substring(raw from 1 for 3)='\xffd8ff'::bytea)
  or (p_mime='image/png' and substring(raw from 1 for 8)='\x89504e470d0a1a0a'::bytea)) then raise exception 'help_attachment_type'; end if;
 h:=encode(extensions.digest(raw,'sha256'),'hex');
 payload:=jsonb_build_object('action','attachment','ticket',t.id,'id',p_attachment_id,'sha256',h);
 result:=gina.help_receipt(p_request_id,payload); if result is not null then return result; end if;
 if t.status='closed' then raise exception 'help_reopen_required'; end if;
 if exists(select 1 from public.help_attachments where id=p_attachment_id) then raise exception 'request_conflict'; end if;
 if (select count(*) from public.help_attachments where ticket_id=t.id)>=3 then raise exception 'help_attachment_limit'; end if;
 insert into public.help_attachments(id,ticket_id,family_id,created_by,mime,bytes,sha256,width,height,redaction,data)
 values(p_attachment_id,t.id,t.family_id,auth.uid(),p_mime,length(raw),h,p_width,p_height,
  jsonb_build_object('confirmed_no_personal_data',true,'metadata_removed',true,'cropped',(p_redaction->>'cropped') is not distinct from 'true'),raw);
 update public.help_tickets set updated_at=now() where id=t.id;
 result:=jsonb_build_object('id',p_attachment_id,'ticket_id',t.id,'bytes',length(raw),'sha256',h);
 perform gina.save_help_receipt(p_request_id,payload,result,t.family_id);
 return result;
end $$;
revoke all on function public.add_help_attachment(uuid,uuid,uuid,text,text,int,int,jsonb) from public,anon,service_role;
grant execute on function public.add_help_attachment(uuid,uuid,uuid,text,text,int,int,jsonb) to authenticated;

-- Liste meta veri döndürür; görsel yalnız tek tek, aynı yetkiyle okunur (aile velisi veya destek operatörü).
create function public.list_help_attachments(p_ticket_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.help_tickets;
begin
 select * into t from public.help_tickets where id=p_ticket_id;
 if t.id is null or not (gina.has_operation_role('support') or (coalesce(gina.is_parent(),false) and t.family_id=gina.family_id())) then
  raise exception 'forbidden' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'mime',a.mime,'bytes',a.bytes,'width',a.width,'height',a.height,
  'created_at',a.created_at,'mine',a.created_by=auth.uid()) order by a.created_at),'[]') from public.help_attachments a where a.ticket_id=t.id);
end $$;
create function public.get_help_attachment(p_attachment_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.help_attachments;
begin
 select * into a from public.help_attachments where id=p_attachment_id;
 if a.id is null or not (gina.has_operation_role('support') or (coalesce(gina.is_parent(),false) and a.family_id=gina.family_id())) then
  raise exception 'forbidden' using errcode='42501'; end if;
 return jsonb_build_object('id',a.id,'mime',a.mime,'width',a.width,'height',a.height,'data',translate(encode(a.data,'base64'),E'\n',''));
end $$;
revoke all on function public.list_help_attachments(uuid),public.get_help_attachment(uuid) from public,anon,service_role;
grant execute on function public.list_help_attachments(uuid),public.get_help_attachment(uuid) to authenticated;
