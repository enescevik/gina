-- D7 — İçerik operatörü katkı kabulü ve operatör rol yönetimi.
-- 1) Katkı kabulü içerik rolüne açılır (koordinatör kararı). Kabul yalnız TASLAK içe aktarır; yayın kararı
--    yayın rolünde/yöneticide kalır (C07: admin_set_library_publication → release). Genel içe aktarma
--    (public.admin_import_library_bundle) yönetici yazması olarak AYNEN kalır; yetkisi genişletilmez.
--    Kabul akışına özel iç yol: gina.import_contribution_bundle. Gövdesi admin_import_library_bundle'ın
--    pg_get_functiondef çıktısıdır (doğrulama, boyut, PNG, rubrik ve makbuz kuralları birebir aynı); yalnız
--    ad ve kapı değişir: içerik rolü (yönetici her rolü taşır) + paket anahtarı bekleyen bir katkı kopyasına
--    ait olmalı. Fonksiyon hiçbir istemci rolüne açılmaz; yalnız admin_decide_contribution_set içinden çağrılır.
--    Beklenen parça tam bir kez bulunmazsa migration durur (sessiz kayma yok).
-- 2) Operatör rol yönetimi (set_operation_member için ekran): liste, hesap bulma ve idempotent, denetimli
--    verme/uzatma/kaldırma. Yazma yine public.set_operation_member ile yapılır (kurallar ve 'operations.member'
--    denetimi değişmez). Yalnız tam yönetici. Yetki her çağrıda canlıdır: kaldırılan rol açık oturumdaki
--    sonraki istekte reddedilir.

-- 1. Katkı kabulü için iç içe aktarma yolu ------------------------------------------------------------
create function gina.d7_rewrite(p_def text,p_from text,p_to text,p_label text) returns text
language plpgsql immutable set search_path='' as $$
begin
 if (length(p_def)-length(replace(p_def,p_from,'')))/length(p_from)<>1 then
  raise exception 'd7_rewrite_unexpected_body %',p_label;
 end if;
 return replace(p_def,p_from,p_to);
end;$$;

do $$
declare def text;begin
 def:=pg_get_functiondef('public.admin_import_library_bundle(uuid,jsonb)'::regprocedure);
 def:=gina.d7_rewrite(def,'FUNCTION public.admin_import_library_bundle(','FUNCTION gina.import_contribution_bundle(','import name');
 def:=gina.d7_rewrite(def,' perform gina.assert_admin();',
  $n$ -- D7: yalnız katkı kabulü. İçerik rolü (yönetici dahil) ve bekleyen bir katkı kopyasının paketi.
 perform gina.assert_operation_role(array['content']);
 if p_bundle->>'package_key' is null or p_bundle->>'package_key'!~'^contribution-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or p_bundle#>>'{provenance,origin}' is distinct from 'family_contribution'
  or not exists(select 1 from gina.contribution_sets c where 'contribution-'||c.id::text=p_bundle->>'package_key' and c.status='pending') then
  raise exception 'contribution_import_only';
 end if;$n$,'import gate');
 execute def;
end$$;
revoke all on function gina.import_contribution_bundle(uuid,jsonb) from public,anon,authenticated,service_role;

-- Kabul kararı iç yolu kullanır; kapı (C07: içerik rolü) ve gövdenin geri kalanı aynen korunur.
-- Denetim satırına kararın hangi yetkiyle verildiği eklenir (yönetici/içerik operatörü).
do $$
declare def text;begin
 def:=pg_get_functiondef('public.admin_decide_contribution_set(uuid,uuid,boolean,text,jsonb,boolean)'::regprocedure);
 def:=gina.d7_rewrite(def,'imported:=public.admin_import_library_bundle(p_request_id,bundle);',
  'imported:=gina.import_contribution_bundle(p_request_id,bundle);','decide import call');
 def:=gina.d7_rewrite(def,
  $o$insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason) values(auth.uid(),'contribution_set.'||case when p_approve then 'approved' else 'rejected' end,'gina.contribution_sets',s.id::text,s.family_id,trim(p_note));$o$,
  $n$insert into public.audit_log(actor_id,action,target_table,target_id,family_id,reason,details) values(auth.uid(),'contribution_set.'||case when p_approve then 'approved' else 'rejected' end,'gina.contribution_sets',s.id::text,s.family_id,trim(p_note),
  jsonb_build_object('decided_as',case when coalesce(gina.is_admin_strict(),false) then 'admin' else 'content' end,'package_id',imported->'id','package_status',case when p_approve then 'draft' end));$n$,'decide audit');
 execute def;
end$$;
drop function gina.d7_rewrite(text,text,text,text);

-- 2. Operatör rol yönetimi -----------------------------------------------------------------------------
create table gina.operations_member_commands (
 request_id uuid primary key,
 actor_id uuid not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table gina.operations_member_commands enable row level security;
revoke all on gina.operations_member_commands from public,anon,authenticated,service_role;

-- Kişi başına roller, durum, açık oturum sayısı ve son denetim izi. E-posta yalnız yöneticiye görünür.
create function public.admin_operation_members() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 return jsonb_build_object(
  'members',(select coalesce(jsonb_agg(x.v order by x.email nulls last,x.uid),'[]') from (
   select u.id uid,u.email,jsonb_build_object('user_id',u.id,'email',u.email,
    'open_sessions',(select count(*) from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after>now())),
    'roles',(select coalesce(jsonb_agg(jsonb_build_object('role',m.role,
       'state',case when m.revoked_at is not null then 'revoked' when m.expires_at<=now() then 'expired' else 'active' end,
       'expires_at',m.expires_at,'revoked_at',m.revoked_at,'granted_by',g.email,
       'scope_count',case when m.role='release' then (select count(*) from gina.operations_member_scopes sc where sc.user_id=m.user_id and sc.role='release') end)
      order by array_position(array['support','content','finance','release'],m.role)),'[]')
     from public.operations_members m left join auth.users g on g.id=m.granted_by where m.user_id=u.id),
    'history',(select coalesce(jsonb_agg(h.v order by h.created_at desc,h.id desc),'[]') from (
      select a.id,a.created_at,jsonb_build_object('at',a.created_at,'actor',ae.email,'role',a.details->>'role',
       'revoked',(a.details->>'revoked')::boolean,'expires_at',a.details->'expires_at','reason',a.reason) v
      from public.audit_log a left join auth.users ae on ae.id=a.actor_id
      where a.action='operations.member' and a.target_id=u.id::text order by a.created_at desc,a.id desc limit 10) h)) v
   from auth.users u
   where exists(select 1 from public.operations_members m where m.user_id=u.id)
     and not exists(select 1 from public.admins a where a.user_id=u.id)) x),
  'roles',jsonb_build_array('support','content','finance','release'),
  'max_days',365,
  'rule','live check: a revoked or expired role is refused on the next request, also with an open session');
end;$$;

-- Tam e-posta eşleşmesiyle hesap bulma (rol verilecek kişi). Tahmin/arama yok; yalnız uygunluk.
create function public.admin_find_operator_account(p_email text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u auth.users;begin
 perform gina.assert_admin();
 if length(trim(coalesce(p_email,''))) not between 3 and 320 then raise exception 'invalid_input';end if;
 select * into u from auth.users where lower(email)=lower(trim(p_email)) order by created_at limit 1;
 if not found then return jsonb_build_object('found',false);end if;
 return jsonb_build_object('found',true,'user_id',u.id,'email',u.email,
  'eligible',not coalesce(u.is_anonymous,false) and not exists(select 1 from public.devices d where d.auth_user_id=u.id)
   and not exists(select 1 from public.admins a where a.user_id=u.id),
  'reason',case when coalesce(u.is_anonymous,false) or exists(select 1 from public.devices d where d.auth_user_id=u.id) then 'operator_account_required'
   when exists(select 1 from public.admins a where a.user_id=u.id) then 'operator_is_admin' end);
end;$$;

-- Ver / süre güncelle / kaldır. Aynı istek kimliği aynı sonucu döndürür; farklı içerikle `request_conflict`.
-- Durumu değiştirmeyen istek `unchanged` döner ve denetim yazmaz. Yazma set_operation_member ile.
create function public.admin_set_operation_member(p_request_id uuid,p_user_id uuid,p_role text,p_expires_at timestamptz,p_revoke boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c gina.operations_member_commands;h text;m public.operations_members;active boolean;outcome text;result jsonb;n int;begin
 perform gina.assert_admin();
 if p_request_id is null or p_user_id is null or p_role is null or p_role not in('support','content','finance','release') or p_revoke is null
  or length(trim(coalesce(p_reason,''))) not between 3 and 500 or (p_revoke and p_expires_at is not null) then raise exception 'invalid_input';end if;
 h:=encode(extensions.digest(jsonb_build_array(p_user_id,p_role,p_expires_at,p_revoke,trim(p_reason))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,39));
 select * into c from gina.operations_member_commands where request_id=p_request_id;
 if found then
  if c.actor_id<>auth.uid() or c.payload_hash<>h then raise exception 'request_conflict';end if;
  return c.result||jsonb_build_object('replayed',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_role,40));
 if not p_revoke and exists(select 1 from public.admins where user_id=p_user_id) then raise exception 'operator_is_admin';end if;
 if p_user_id=auth.uid() then raise exception 'operator_self_change';end if;
 select * into m from public.operations_members where user_id=p_user_id and role=p_role for update;
 active:=found and m.revoked_at is null and m.expires_at>now();
 if p_revoke then
  if not active then outcome:='unchanged';
  else perform public.set_operation_member(p_user_id,p_role,null,true,trim(p_reason));outcome:='revoked';end if;
 else
  if active and m.expires_at=p_expires_at then outcome:='unchanged';
  else
   perform public.set_operation_member(p_user_id,p_role,p_expires_at,false,trim(p_reason));
   outcome:=case when active then 'updated' else 'granted' end;
  end if;
 end if;
 select * into m from public.operations_members where user_id=p_user_id and role=p_role;
 select count(*) into n from auth.sessions s where s.user_id=p_user_id and (s.not_after is null or s.not_after>now());
 result:=jsonb_build_object('status',outcome,'user_id',p_user_id,'role',p_role,
  'active',coalesce(m.revoked_at is null and m.expires_at>now(),false),'expires_at',m.expires_at,'revoked_at',m.revoked_at,
  'open_sessions',n,'effect',case when outcome='revoked' then 'refused_on_next_request' end,
  'scope_count',case when p_role='release' then (select count(*) from gina.operations_member_scopes sc where sc.user_id=p_user_id and sc.role='release') end,
  'replayed',false);
 insert into gina.operations_member_commands(request_id,actor_id,payload_hash,result) values(p_request_id,auth.uid(),h,result);
 return result;
end;$$;

revoke all on function public.admin_operation_members(),public.admin_find_operator_account(text),
 public.admin_set_operation_member(uuid,uuid,text,timestamptz,boolean,text) from public,anon,service_role;
grant execute on function public.admin_operation_members(),public.admin_find_operator_account(text),
 public.admin_set_operation_member(uuid,uuid,text,timestamptz,boolean,text) to authenticated;
