-- D12 — D11-K1 ve D11-K2 kararları.
-- 1) K1: `admin_families_search` iki isteğe bağlı parametre alır:
--    p_expiring_within_days (1–90; null = süzgeç yok): efektif hakkı (gina.effective_entitlement) şimdiden sonra
--      ve en geç N gün içinde biten aileler. Başlangıç (free) paketinin bitişi yoktur; süzgeçte hiç görünmez.
--    p_sort ('newest' varsayılan | 'expiring'): 'newest' eski sıralama (created_at desc, id desc) ve eski cursor
--      biçimi '<created_at>|<id>' AYNEN korunur. 'expiring' bitişi en yakın olan önce (bitişsizler en sonda),
--      keyset (coalesce(expires_at,'infinity'), id) artan; cursor 'expiring|<expires_at|infinity>|<id>'.
--      Bir sıralamanın cursor'ı diğerinde kullanılamaz (cursor_invalid).
--    Eski üç parametreli imza kaldırılır, yerine varsayılanlı beş parametreli imza gelir. Böylece
--    build-29 dönemi backoffice'in {p_query,p_cursor,p_limit} çağrısı (ve pozisyonel 1–3 argümanlı çağrılar)
--    aynı sonucu verir; iki imza birlikte bırakılmaz (varsayılanlı aşırı yükleme belirsiz çağrı üretir).
--    Rol kapısı C07 matrisindeki ile aynıdır: admin, support, finance (gina.caller_operation_roles, canlı).
--    gina.assert_admin()'e geri çekilmez. Satır alanları değişmez (e-posta ve çocuk adı yine dönmez).
-- 2) K2: `admin_audit_actors(p_ids uuid[])` — denetim satırlarındaki "Yapan" için kimlik → görünen etiket.
--    Yalnız tam yönetici (gina.assert_admin: JWT claim + canlı admins satırı; operatör rolü yetmez).
--    Yalnız ekip hesapları (admins veya operations_members kaydı olan; iptal/süresi dolmuş operatör dahil)
--    çözülür; diğer kimlikler (veli, cihaz, bilinmeyen) label=null döner, böylece RPC bir kimlik→e-posta
--    sorgulama aracı olmaz. Dönen alanlar yalnız id ve label (e-posta). En fazla 200 kimlik.

-- 1. Aile arama: bitişi yaklaşan süzgeci ve sıralama --------------------------------------------
drop function public.admin_families_search(text,text,int);

create function public.admin_families_search(p_query text default null,p_cursor text default null,p_limit int default 50,
 p_expiring_within_days int default null,p_sort text default 'newest') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare roles text[]:=gina.caller_operation_roles(); q text:=nullif(trim(coalesce(p_query,'')),''); pat text;
 lim int:=least(greatest(coalesce(p_limit,50),1),200); srt text:=coalesce(p_sort,'newest'); days int:=p_expiring_within_days;
 c_ts timestamptz; c_id uuid; rows jsonb; total int; horizon timestamptz; tail_row jsonb;
begin
 if not (roles && array['admin','support','finance']) then raise exception 'forbidden' using errcode='42501';end if;
 if length(coalesce(q,''))>120 then raise exception 'invalid_input' using errcode='22023';end if;
 if srt not in('newest','expiring') or (days is not null and days not between 1 and 90) then
  raise exception 'invalid_input' using errcode='22023';
 end if;
 horizon:=case when days is null then null else now()+make_interval(days=>days) end;
 if p_cursor is not null then
  begin
   if srt='newest' then
    if p_cursor like 'expiring|%' then raise exception 'cursor_invalid';end if;
    c_ts:=split_part(p_cursor,'|',1)::timestamptz; c_id:=split_part(p_cursor,'|',2)::uuid;
   else
    if split_part(p_cursor,'|',1)<>'expiring' then raise exception 'cursor_invalid';end if;
    c_ts:=split_part(p_cursor,'|',2)::timestamptz; c_id:=split_part(p_cursor,'|',3)::uuid;
   end if;
   if c_ts is null or c_id is null then raise exception 'cursor_invalid';end if;
  exception when others then raise exception 'cursor_invalid' using errcode='22023';
  end;
 end if;
 pat:=case when q is null then null else '%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%' end;
 select coalesce(jsonb_agg(to_jsonb(r)-'rn'-'sort_ts' order by r.rn),'[]'),count(*) into rows,total from (
  select x.*,row_number() over (order by
    case when srt='newest' then x.created_at end desc,case when srt='newest' then x.id end desc,
    case when srt='expiring' then x.sort_ts end asc,case when srt='expiring' then x.id end asc) rn
  from (
   select f.id,f.name,f.created_at,f.timezone,
    (select count(*)::int from public.family_members m where m.family_id=f.id) member_count,
    (select count(*)::int from public.children c where c.family_id=f.id and c.archived_at is null) child_count,
    (select count(*)::int from public.children c where c.family_id=f.id and c.archived_at is not null) archived_child_count,
    (select count(*)::int from public.devices d where d.family_id=f.id and d.revoked_at is null) device_count,
    e.plan,e.source plan_source,e.expires_at plan_expires_at,
    (select s.status::text from public.store_subscriptions s where s.family_id=f.id order by s.updated_at desc,s.id limit 1) store_status,
    (select count(*)::int from public.entitlement_overrides o where o.family_id=f.id and o.revoked_at is null and o.ends_at>now()) active_override_count,
    greatest(f.created_at,
     (select max(se.created_at) from public.star_events se where se.family_id=f.id),
     (select max(tc.completed_at) from public.task_completions tc where tc.family_id=f.id),
     (select max(t.updated_at) from public.help_tickets t where t.family_id=f.id),
     (select max(s.updated_at) from public.store_subscriptions s where s.family_id=f.id),
     (select max(d.last_seen_at) from public.devices d where d.family_id=f.id)) last_activity_at,
    case when q is null then '[]'::jsonb else (select coalesce(jsonb_agg(k),'[]') from (
      select 'id' k where f.id::text=q
      union all select 'invite_code' where f.invite_code=upper(q)
      union all select 'name' where f.name ilike pat
      union all select 'child_name' where exists(select 1 from public.children c where c.family_id=f.id and c.name ilike pat)
      union all select 'email' where length(q)>=3 and exists(select 1 from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id and u.email ilike pat)
     ) m) end matched_on,
    coalesce(e.expires_at,'infinity'::timestamptz) sort_ts
   from public.families f cross join lateral gina.effective_entitlement(f.id) e
   where (q is null or f.id::text=q or f.invite_code=upper(q) or f.name ilike pat
     or exists(select 1 from public.children c where c.family_id=f.id and c.name ilike pat)
     or (length(q)>=3 and exists(select 1 from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id and u.email ilike pat)))
    and (horizon is null or (e.expires_at is not null and e.expires_at>now() and e.expires_at<=horizon))
    and (c_ts is null
     or (srt='newest' and (f.created_at,f.id)<(c_ts,c_id))
     or (srt='expiring' and (coalesce(e.expires_at,'infinity'::timestamptz),f.id)>(c_ts,c_id)))
  ) x
  order by rn limit lim+1
 ) r;
 tail_row:=case when total>lim then rows->(lim-1) end;
 return jsonb_build_object('as_of',now(),'query',q,'limit',lim,'sort',srt,'expiring_within_days',days,'has_more',total>lim,
  'rows',case when total>lim then rows-(lim) else rows end,
  'next_cursor',case when tail_row is null then null
   when srt='newest' then (tail_row->>'created_at')||'|'||(tail_row->>'id')
   else 'expiring|'||coalesce(tail_row->>'plan_expires_at','infinity')||'|'||(tail_row->>'id') end);
end;$$;
revoke all on function public.admin_families_search(text,text,int,int,text) from public,anon;
grant execute on function public.admin_families_search(text,text,int,int,text) to authenticated,service_role;

-- 2. Denetim "Yapan" etiketi -------------------------------------------------------------------
create function public.admin_audit_actors(p_ids uuid[]) returns table(id uuid,label text)
language plpgsql stable security definer set search_path='' as $$
begin
 perform gina.assert_admin();
 if p_ids is null or cardinality(p_ids)>200 then raise exception 'invalid_input' using errcode='22023';end if;
 return query
  select i.v,case when exists(select 1 from public.admins a where a.user_id=i.v)
     or exists(select 1 from public.operations_members m where m.user_id=i.v) then u.email::text end
  from (select distinct v from unnest(p_ids) v where v is not null) i
  left join auth.users u on u.id=i.v
  order by i.v;
end;$$;
revoke all on function public.admin_audit_actors(uuid[]) from public,anon;
grant execute on function public.admin_audit_actors(uuid[]) to authenticated,service_role;
