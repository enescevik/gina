-- C07 — Operatör rolleri ve yönetim kuyrukları (B01–B04).
-- 1) Rol matrisi: içerik/yayın operatörleri kendi kuyruklarının RPC'lerine tam yönetici olmadan erişir.
--    Yetki her çağrıda canlıdır (operations_members süresi/iptali; admins satırı). Tam yönetici her role sahiptir.
--    Yeniden kapılama yalnız aşağıda adı geçen fonksiyonların gövdesindeki tek `gina.assert_admin()`
--    çağrısını değiştirir; gövdenin geri kalanı pg_get_functiondef ile aynen korunur ve beklenen
--    değişim sayısı tutmazsa migration durur (sessiz kayma yok). Yazma politikaları (kota, ödül,
--    koleksiyon, grup politikası, eski öğe yayını, içe aktarma) yönetici olarak kalır.
-- 2) B01 iş kuyruğu "sorumlusuz" kalemi B04 `help_tickets.assignee_id` tanımına geçer.
-- 3) Hazır destek yanıtları TR/EN, sürümlü ve yönetilebilir (destek rolü); kod içi sabit liste yerine.
-- 4) İçerik incelemesi: gerçek keyset sayfalama + senaryo adaylarının AI ön inceleme durumu.
-- 5) Duyuru önizlemesi: push hedefi (cihazı olan, izin veren, oturumu açık veli) sayısı.

-- 1. Rol yardımcıları -------------------------------------------------------------------------
create function gina.has_any_operation_role(p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(gina.is_admin_strict(),false) or exists(select 1 from unnest(p_roles) r where gina.has_operation_role(r));
$$;
create function gina.assert_operation_role(p_roles text[]) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not gina.has_any_operation_role(p_roles) then raise exception 'forbidden' using errcode='42501';end if;
end;$$;
revoke all on function gina.has_any_operation_role(text[]),gina.assert_operation_role(text[]) from public,anon;
grant execute on function gina.has_any_operation_role(text[]),gina.assert_operation_role(text[]) to authenticated,service_role;

-- Yeniden kapılama: (fonksiyon adı, roller). Aynı addaki bütün imzalar değişir.
create function gina.c07_regate(p_name text,p_roles text[],p_from text,p_to text) returns int
language plpgsql set search_path='' as $$
declare r record;def text;changed text;n int:=0;begin
 for r in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=p_name loop
  def:=pg_get_functiondef(r.oid);
  if (length(def)-length(replace(def,p_from,'')))/length(p_from)<>1 then
   raise exception 'c07_regate_unexpected_body %', p_name;
  end if;
  changed:=replace(def,p_from,p_to);
  execute changed;n:=n+1;
 end loop;
 if n=0 then raise exception 'c07_regate_missing %', p_name;end if;
 return n;
end;$$;

do $$
declare f text;begin
 -- İçerik ekibi: kütüphane taslak/katkı incelemesi, birleşik içerik listesi, AI ön inceleme kuyruğu,
 -- Birlikte Prova oluşturma/önizleme/dağıtım ve ortak defter incelemesi.
 foreach f in array array['admin_learning_library','admin_review_contribution','admin_list_library_draft_packages',
  'admin_get_library_import','admin_get_library_reviews','admin_review_library_question','admin_list_contribution_sets',
  'admin_get_contribution_set','admin_decide_contribution_set','admin_library_content_items','admin_library_package_trail',
  'admin_content_prereviews','request_content_prereview','enqueue_content_prereview','admin_library_group_integrity',
  'admin_group_exams','admin_group_package_catalog','admin_create_group_exam','admin_create_reviewed_group_exam',
  'admin_cancel_group_exam','admin_cohort_review_queue','admin_cohort_review_detail','admin_save_cohort_review',
  'admin_publish_cohort_results'] loop
  perform gina.c07_regate(f,array['content'],'gina.assert_admin()','gina.assert_operation_role(array[''content''])');
 end loop;
 -- Yayın önizlemesi içerik ve yayın ekibine; yayın kararı yalnız yayın ekibine (ve yöneticiye).
 perform gina.c07_regate('admin_library_publication',array['content','release'],'gina.assert_admin()','gina.assert_operation_role(array[''content'',''release''])');
 perform gina.c07_regate('admin_set_library_publication',array['release'],'gina.assert_admin()','gina.assert_operation_role(array[''release''])');
 -- Yönetici dalı içerik ekibine de açılır (aile/veli dalı aynen kalır).
 perform gina.c07_regate('contribution_review_trail',array['content'],'admin boolean:=gina.is_admin_strict();','admin boolean:=gina.has_any_operation_role(array[''content'']);');
 perform gina.c07_regate('group_exam_phases',array['content'],'admin boolean:=gina.is_admin_strict();','admin boolean:=gina.has_any_operation_role(array[''content'']);');
end$$;

-- 2. İş kuyruğu: sorumlusuz = assignee_id boş (açık/işlemde destek talebi) ------------------------
do $$begin
 perform gina.c07_regate('admin_workqueue',null,
  $o$(select gina.workqueue_item('support','support','tickets_unassigned',count(*),min(t.created_at),'no_operator_reply')
       from public.help_tickets t where t.kind='support' and t.status in('open','in_progress')
        and not exists(select 1 from public.help_messages m where m.ticket_id=t.id and m.author_role='support'))$o$,
  $n$(select gina.workqueue_item('support','support','tickets_unassigned',count(*),min(t.created_at),'no_assignee')
       from public.help_tickets t where t.kind='support' and t.status in('open','in_progress') and t.assignee_id is null)$n$);
end$$;
drop function gina.c07_regate(text,text[],text,text);

-- 3. Hazır destek yanıtları ------------------------------------------------------------------
create table gina.support_canned_replies (
 id uuid primary key default gen_random_uuid(),
 locale text not null check(locale in('tr','en')),
 title text not null check(length(trim(title)) between 2 and 80),
 body text not null check(length(trim(body)) between 5 and 2000),
 categories text[] not null default '{}' check(categories <@ array['account','device','learning','billing','other']),
 position int not null default 100,
 archived_at timestamptz,
 revision int not null default 1,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index support_canned_replies_title on gina.support_canned_replies(locale,lower(title)) where archived_at is null;
alter table gina.support_canned_replies enable row level security;
revoke all on gina.support_canned_replies from public,anon,authenticated;
grant all on gina.support_canned_replies to service_role;
create table gina.support_canned_commands (
 request_id uuid primary key,
 actor_id uuid not null,
 reply_id uuid not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table gina.support_canned_commands enable row level security;
revoke all on gina.support_canned_commands from public,anon,authenticated;

insert into gina.support_canned_replies(locale,title,categories,position,body) values
 ('tr','Aldık, bakıyoruz','{}',10,'Merhaba, mesajınızı aldık ve inceliyoruz. Bir gelişme olduğunda bu görüşmeden size yazacağız.'),
 ('tr','Tablet eşleştirme','{device}',20,'Merhaba, ebeveyn uygulamasında Ayarlar > Cihazlar bölümünden yeni bir eşleştirme kodu oluşturup tablette bu kodu girebilirsiniz. Kodun süresi kısa olduğu için oluşturduktan hemen sonra kullanmanızı öneririz.'),
 ('tr','Satın alımı geri yükleme','{billing}',30,'Merhaba, satın alımı yapan hesapla giriş yapıp Ayarlar > Paket bölümünde "Satın alımları geri yükle" seçeneğini deneyebilir misiniz? Sorun sürerse mağaza makbuzunun tarihini bize yazmanız yeterli; kart bilgisi paylaşmayın.'),
 ('tr','Ek bilgi isteği','{}',40,'Merhaba, sorunu daha iyi anlamak için hangi cihazı kullandığınızı ve sorunun hangi ekranda olduğunu yazabilir misiniz? Ekran görüntüsünde çocuğunuzun adı veya kişisel bilgi görünmemesine dikkat edin.'),
 ('tr','Çözüldü mü?','{}',50,'Merhaba, yaptığımız düzenlemeden sonra sorun çözüldü mü? Devam ederse bu görüşmeye yazmanız yeterli.'),
 ('en','We are on it','{}',10,'Hello, we have received your message and are looking into it. We will reply in this conversation as soon as there is an update.'),
 ('en','Tablet pairing','{device}',20,'Hello, in the parent app you can create a new pairing code under Settings > Devices and enter it on the tablet. The code expires quickly, so please use it right after creating it.'),
 ('en','Restore a purchase','{billing}',30,'Hello, could you sign in with the account that made the purchase and try "Restore purchases" under Settings > Plan? If the problem continues, just send us the date on the store receipt; please do not share card details.'),
 ('en','More details, please','{}',40,'Hello, to understand the problem better, could you tell us which device you are using and on which screen it happens? Please make sure screenshots do not show your child''s name or other personal details.'),
 ('en','Is it solved?','{}',50,'Hello, is the problem solved after our change? If it continues, simply reply in this conversation.');

-- Talebin ailesinin dili varsayılan; p_locale açıkça verilirse o dil. Arşiv yalnız yönetim görünümünde.
create function public.support_canned_replies(p_locale text default null,p_ticket uuid default null,p_include_archived boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l text;begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_locale is not null and p_locale not in('tr','en') then raise exception 'invalid_input';end if;
 l:=coalesce(p_locale,(select case when f.locale in('tr','en') then f.locale end from public.help_tickets t join public.families f on f.id=t.family_id where t.id=p_ticket),'tr');
 return jsonb_build_object('locale',l,'replies',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'locale',r.locale,'title',r.title,'body',r.body,
   'categories',to_jsonb(r.categories),'position',r.position,'archived',r.archived_at is not null,'revision',r.revision,'updated_at',r.updated_at)
   order by r.archived_at nulls first,r.position,r.title),'[]')
  from gina.support_canned_replies r where r.locale=l and (coalesce(p_include_archived,false) or r.archived_at is null)));
end;$$;

-- Ekle/düzenle/arşivle/geri al: beklenen sürüm (yarışta `canned_reply_changed`), makbuzla idempotent, denetim kaydı.
create function public.save_support_canned_reply(p_request_id uuid,p_id uuid,p_expected_revision int,p_locale text,p_title text,
 p_body text,p_categories text[] default '{}',p_position int default 100,p_archived boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;c gina.support_canned_commands;r gina.support_canned_replies;res jsonb;begin
 if not gina.has_operation_role('support') then raise exception 'forbidden' using errcode='42501';end if;
 if p_request_id is null or p_locale is null or p_locale not in('tr','en') or p_archived is null
  or length(trim(coalesce(p_title,''))) not between 2 and 80 or length(trim(coalesce(p_body,''))) not between 5 and 2000
  or not (coalesce(p_categories,'{}') <@ array['account','device','learning','billing','other'])
  or p_position is null or p_position not between 0 and 1000
  or (p_id is null) <> (p_expected_revision is null) then raise exception 'invalid_input';end if;
 h:=md5(jsonb_build_array(p_id,p_expected_revision,p_locale,trim(p_title),trim(p_body),coalesce(p_categories,'{}'),p_position,p_archived)::text);
 perform pg_advisory_xact_lock(hashtext('support_canned:'||p_request_id::text));
 select * into c from gina.support_canned_commands where request_id=p_request_id;
 if found then
  if c.actor_id<>auth.uid() or c.payload_hash<>h then raise exception 'request_conflict';end if;
  return c.result||'{"replayed":true}';
 end if;
 if p_id is null then
  insert into gina.support_canned_replies(locale,title,body,categories,position,archived_at,updated_by)
  values(p_locale,trim(p_title),trim(p_body),coalesce(p_categories,'{}'),p_position,case when p_archived then now() end,auth.uid()) returning * into r;
 else
  select * into r from gina.support_canned_replies where id=p_id for update;
  if not found then raise exception 'canned_reply_not_found';end if;
  if r.revision<>p_expected_revision then raise exception 'canned_reply_changed';end if;
  if r.locale<>p_locale then raise exception 'invalid_input';end if;
  update gina.support_canned_replies set title=trim(p_title),body=trim(p_body),categories=coalesce(p_categories,'{}'),position=p_position,
   archived_at=case when p_archived then coalesce(archived_at,now()) end,revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where id=p_id returning * into r;
 end if;
 res:=jsonb_build_object('id',r.id,'revision',r.revision,'archived',r.archived_at is not null,'replayed',false);
 insert into gina.support_canned_commands(request_id,actor_id,reply_id,payload_hash,result) values(p_request_id,auth.uid(),r.id,h,res);
 insert into public.audit_log(actor_id,action,target_table,target_id,details)
 values(auth.uid(),'support.canned_reply','support_canned_replies',r.id::text,jsonb_build_object('locale',r.locale,'revision',r.revision,'archived',r.archived_at is not null,'created',p_id is null));
 return res;
exception when unique_violation then raise exception 'canned_reply_duplicate_title';
end;$$;
revoke all on function public.support_canned_replies(text,uuid,boolean),public.save_support_canned_reply(uuid,uuid,int,text,text,text,text[],int,boolean) from public,anon;
grant execute on function public.support_canned_replies(text,uuid,boolean),public.save_support_canned_reply(uuid,uuid,int,text,text,text,text[],int,boolean) to authenticated;

-- 4. İçerik incelemesi: keyset sayfalama + senaryo adayları ------------------------------------
-- Sıra (updated_at desc, kind, id); cursor '<updated_at>|<kind>|<id>'. p_prereview süzgeci sunucudadır,
-- böylece "ilk 200" sınırı yoktur. Senaryo adayı yalnız AI ön inceleme durumunu taşır; yönetici kararı
-- adayın kendi akışındadır (curriculum review), bu liste onu değiştirmez.
create function public.admin_library_content_page(p_kind text default null,p_status text default null,p_prereview text default null,
 p_cursor text default null,p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ct timestamptz;ck text;ci uuid;parts text[];rows jsonb;n int;lim int;begin
 perform gina.assert_operation_role(array['content']);
 if p_limit is null or p_limit<1 then raise exception 'invalid_input';end if;
 lim:=least(p_limit,200);
 if (p_kind is not null and p_kind not in('package','contribution_set','legacy_item','collection','legacy_contribution','curriculum_candidate'))
  or (p_status is not null and p_status not in('draft','reviewed','approved','published','withdrawn'))
  or (p_prereview is not null and p_prereview not in('none','pending','ai_approved','needs_admin','ai_rejected_suggestion')) then raise exception 'invalid_input';end if;
 if p_cursor is not null then
  parts:=string_to_array(p_cursor,'|');
  begin
   if array_length(parts,1)<>3 then raise exception 'x';end if;
   ct:=parts[1]::timestamptz;ck:=parts[2];ci:=parts[3]::uuid;
  exception when others then raise exception 'cursor_invalid';end;
 end if;
 with items as (
  select i.kind,i.id,i.title,i.grade,i.subject,i.status,i.version,i.publication_version,i.series_key,i.previous_id,i.parent_id,
   i.source_family_id,i.prereview_status,i.admin_decision,i.live,i.created_at,i.updated_at
  from gina.library_content_items i
  union all
  select 'curriculum_candidate',c.id,coalesce(c.candidate->>'label',c.external_key),case when c.candidate->>'grade' ~ '^[0-9]{1,2}$' then (c.candidate->>'grade')::int end,c.candidate->>'subject',
   c.status,
   c.revision,null::int,c.external_key,null::uuid,null::uuid,null::uuid,ai.prereview_status,null::text,c.status='published',c.created_at,coalesce(c.reviewed_at,c.created_at)
  from gina.curriculum_candidates c left join gina.content_prereviews ai on ai.target_kind='curriculum_candidate' and ai.target_id=c.id
 ), page as (
  select * from items i
  where (p_kind is null or i.kind=p_kind) and (p_status is null or i.status=p_status)
   and (p_prereview is null or coalesce(i.prereview_status,'none')=p_prereview)
   and (p_cursor is null or (i.updated_at,i.kind,i.id) < (ct,ck,ci))
  order by i.updated_at desc,i.kind desc,i.id desc limit lim+1
 )
 select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.kind desc,p.id desc),'[]'),count(*) into rows,n from page p;
 if n>lim then rows:=rows-lim;end if;
 return jsonb_build_object('rows',rows,'limit',lim,'has_more',n>lim,
  'next_cursor',case when n>lim then (rows->(lim-1)->>'updated_at')||'|'||(rows->(lim-1)->>'kind')||'|'||(rows->(lim-1)->>'id') end);
end;$$;
revoke all on function public.admin_library_content_page(text,text,text,text,int) from public,anon,service_role;
grant execute on function public.admin_library_content_page(text,text,text,text,int) to authenticated;

-- 5. Duyuru push hedefi ----------------------------------------------------------------------
-- push-send ile aynı koşullar: velinin bu ailede push kaydı + duyuru tercihi açık + açık oturum.
create function gina.announcement_push_preview(p_place uuid,p_stage text) returns jsonb
language sql stable security definer set search_path='' as $$
 with r as (
  select r.user_id,r.family_id,
   (select count(*) from public.push_tokens t where t.user_id=r.user_id and t.family_id=r.family_id and t.role='parent') devices,
   coalesce((select p.announcements from public.push_preferences p where p.user_id=r.user_id),true) allowed,
   exists(select 1 from auth.sessions s where s.user_id=r.user_id) signed_in
  from gina.announcement_recipients(p_place,p_stage) r)
 select jsonb_build_object('ready',gina.channel_ready('push'),
  'eligible',count(*) filter(where devices>0 and allowed and signed_in),
  'devices',coalesce(sum(devices) filter(where devices>0 and allowed and signed_in),0),
  'blocked',jsonb_strip_nulls(jsonb_build_object(
   'no_device',nullif(count(*) filter(where devices=0),0),
   'opted_out',nullif(count(*) filter(where devices>0 and not allowed),0),
   'signed_out',nullif(count(*) filter(where devices>0 and allowed and not signed_in),0))))
 from r;
$$;
revoke all on function gina.announcement_push_preview(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.admin_announcement_push_audience(p_id uuid,p_revision int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a gina.parent_announcements;begin
 if not gina.has_operation_role('release') then raise exception 'forbidden' using errcode='42501';end if;
 select * into a from gina.parent_announcements where id=p_id and status='draft';
 if not found or a.revision is distinct from p_revision then raise exception 'announcement_changed';end if;
 return gina.announcement_push_preview(a.place_id,a.stage)||jsonb_build_object('id',a.id,'revision',a.revision,'selected',a.push);
end;$$;
revoke all on function public.admin_announcement_push_audience(uuid,int) from public,anon,service_role;
grant execute on function public.admin_announcement_push_audience(uuid,int) to authenticated;
