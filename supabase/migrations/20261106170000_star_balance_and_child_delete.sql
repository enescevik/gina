-- Q02-3: yıldız bakiyesi sunucuda toplanır. Veli ana ekranı ve çocuk ekranı tüm `star_events` defterini
--        çekip istemcide toplamak yerine bu iki RPC'yi okur (dönen sayılar istemcinin eski toplamıyla aynı).
-- Q02-6: veli REST ile `children` satırını doğrudan DELETE edemez. `children_parent_all for all` politikası
--        komutlara bölünür (select/insert/update aynı koşulla); DELETE politikası yoktur. Kalıcı silme yalnız
--        `confirm_child_deletion` (önizleme + makbuz) ve hesap/aile silme cascade'i ile olur.
-- BAĞIMLILIK: mobil `parent/menu.tsx` çocuk silme menüsü `confirm_child_deletion`'a taşınmadan bu migration
--        yayımlanmamalı; aksi hâlde eski istemcide çocuk silme 0 satır döner (sessiz başarısızlık değil: menü
--        `data.length===0` durumunu hata sayar, ama silme yapılamaz).

-- 1. Çocuk bakiyesi: veli (aynı aile) veya o çocuğa atanmış cihaz. `star_events` RLS'iyle aynı kural:
--    cihaz yalnız kendi `gina.child_id()` çocuğunu görür. Yabancı/olmayan çocuk → 42501 (varlık sızmaz).
--    `today_delta`: ailenin saat diliminde `p_day` günü (verilmezse ailenin bugünü) oluşan hareketlerin toplamı;
--    istemcideki eski `localDateOf(created_at, timezone) === today` toplamıyla aynı.
create or replace function public.child_star_balance(p_child_id uuid, p_day date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid := gina.family_id(); tz text; d date; bal int; today_sum int;
begin
  if f is null or p_child_id is null then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and c.family_id = f
      and (gina.is_parent() or (gina.is_device() and c.id = gina.child_id()))
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select coalesce(x.timezone, 'Europe/Istanbul') into tz from public.families x where x.id = f;
  d := coalesce(p_day, (now() at time zone tz)::date);
  select coalesce(sum(e.delta), 0)::int,
         coalesce(sum(e.delta) filter (where (e.created_at at time zone tz)::date = d), 0)::int
    into bal, today_sum
    from public.star_events e
   where e.child_id = p_child_id and e.family_id = f;
  return jsonb_build_object('child_id', p_child_id, 'balance', bal, 'today', d, 'today_delta', today_sum);
end;$$;
revoke all on function public.child_star_balance(uuid, date) from public, anon;
grant execute on function public.child_star_balance(uuid, date) to authenticated, service_role;

-- 2. Aile özeti (veli): çocuk başına bakiye. Defterde hareketi olmayan çocuk satır döndürmez
--    (istemcideki eski Map ile aynı: yok → 0).
create or replace function public.family_star_balances()
returns table(child_id uuid, balance int) language plpgsql stable security definer set search_path='' as $$
declare f uuid := gina.family_id();
begin
  if f is null or gina.is_parent() is not true then raise exception 'forbidden' using errcode='42501'; end if;
  return query
    select e.child_id, sum(e.delta)::int
      from public.star_events e
     where e.family_id = f
     group by e.child_id;
end;$$;
revoke all on function public.family_star_balances() from public, anon;
grant execute on function public.family_star_balances() to authenticated, service_role;

-- 3. Q02-6: `children` veli politikası komutlara bölünür; DELETE yok. Koşullar Q02-1 InitPlan biçimiyle aynı.
drop policy if exists children_parent_all on public.children;
create policy children_parent_select on public.children
  for select to authenticated
  using (((family_id = (select gina.family_id())) and (select gina.is_parent())));
create policy children_parent_insert on public.children
  for insert to authenticated
  with check (((family_id = (select gina.family_id())) and (select gina.is_parent())));
create policy children_parent_update on public.children
  for update to authenticated
  using (((family_id = (select gina.family_id())) and (select gina.is_parent())))
  with check (((family_id = (select gina.family_id())) and (select gina.is_parent())));
-- Politika olmasa da yetki katmanında da kapatılır: REST DELETE 42501 alır (0 satır yerine açık ret).
revoke delete on public.children from anon, authenticated;
