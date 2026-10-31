-- City-level choice only. No location permission or child coordinates are collected.
create table public.weather_cities (
 id text primary key, name text not null, country text not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180), timezone text not null
);
-- GeoNames TR provincial capitals (CC BY 4.0), retrieved 2026-10-31; city-centre coordinates rounded.
insert into public.weather_cities values
('325363','Adana','TR',36.9862,35.3253,'Europe/Istanbul'),
('752850','Adapazarı (Sakarya)','TR',40.7806,30.4033,'Europe/Istanbul'),
('325330','Adıyaman','TR',37.7644,38.2763,'Europe/Istanbul'),
('325303','Afyonkarahisar','TR',38.7567,30.5433,'Europe/Istanbul'),
('324496','Aksaray','TR',38.3725,34.0254,'Europe/Istanbul'),
('752015','Amasya','TR',40.6533,35.8331,'Europe/Istanbul'),
('323786','Ankara','TR',39.9199,32.8543,'Europe/Istanbul'),
('323779','Antakya (Hatay)','TR',36.2066,36.1572,'Europe/Istanbul'),
('323777','Antalya','TR',36.9081,30.6956,'Europe/Istanbul'),
('751952','Ardahan','TR',41.1087,42.7022,'Europe/Istanbul'),
('751817','Artvin','TR',41.1816,41.8217,'Europe/Istanbul'),
('322830','Aydın','TR',37.845,27.8396,'Europe/Istanbul'),
('309647','Ağrı','TR',39.7147,43.0401,'Europe/Istanbul'),
('322165','Balıkesir','TR',39.6492,27.8861,'Europe/Istanbul'),
('751057','Bartın','TR',41.6358,32.3375,'Europe/Istanbul'),
('321836','Batman','TR',37.8874,41.1322,'Europe/Istanbul'),
('750938','Bayburt','TR',40.2563,40.2229,'Europe/Istanbul'),
('750598','Bilecik','TR',40.1419,29.9793,'Europe/Istanbul'),
('321082','Bingöl','TR',38.8847,40.4939,'Europe/Istanbul'),
('321025','Bitlis','TR',38.4012,42.1078,'Europe/Istanbul'),
('750516','Bolu','TR',40.7358,31.6061,'Europe/Istanbul'),
('320392','Burdur','TR',37.7203,30.2908,'Europe/Istanbul'),
('750269','Bursa','TR',40.1956,29.0601,'Europe/Istanbul'),
('317109','Denizli','TR',37.7742,29.0875,'Europe/Istanbul'),
('316541','Diyarbakır','TR',37.9136,40.2172,'Europe/Istanbul'),
('747764','Düzce','TR',40.8389,31.1639,'Europe/Istanbul'),
('747712','Edirne','TR',41.6772,26.556,'Europe/Istanbul'),
('315808','Elazığ','TR',38.6743,39.2232,'Europe/Istanbul'),
('315373','Erzincan','TR',39.7392,39.4901,'Europe/Istanbul'),
('315368','Erzurum','TR',39.9086,41.2769,'Europe/Istanbul'),
('315202','Eskişehir','TR',39.7767,30.5206,'Europe/Istanbul'),
('314830','Gaziantep','TR',37.0594,37.3825,'Europe/Istanbul'),
('746881','Giresun','TR',40.917,38.3874,'Europe/Istanbul'),
('746425','Gümüşhane','TR',40.46,39.4718,'Europe/Istanbul'),
('318137','Hakkâri','TR',37.5744,43.7408,'Europe/Istanbul'),
('311073','Isparta','TR',37.7644,30.5522,'Europe/Istanbul'),
('745044','İstanbul','TR',41.0138,28.9497,'Europe/Istanbul'),
('311665','Iğdır','TR',39.9237,44.045,'Europe/Istanbul'),
('310859','Kahramanmaraş','TR',37.5847,36.9264,'Europe/Istanbul'),
('744562','Karabük','TR',41.2049,32.6277,'Europe/Istanbul'),
('309527','Karaman','TR',37.1811,33.215,'Europe/Istanbul'),
('743952','Kars','TR',40.5983,43.0855,'Europe/Istanbul'),
('743882','Kastamonu','TR',41.3781,33.7753,'Europe/Istanbul'),
('308464','Kayseri','TR',38.7322,35.4853,'Europe/Istanbul'),
('307864','Kilis','TR',36.7161,37.115,'Europe/Istanbul'),
('306571','Konya','TR',37.8713,32.4846,'Europe/Istanbul'),
('305268','Kütahya','TR',39.4242,29.9833,'Europe/Istanbul'),
('743166','Kırklareli','TR',41.7351,27.2252,'Europe/Istanbul'),
('307654','Kırıkkale','TR',39.8453,33.5064,'Europe/Istanbul'),
('307515','Kırşehir','TR',39.1458,34.1639,'Europe/Istanbul'),
('304922','Malatya','TR',38.3502,38.3167,'Europe/Istanbul'),
('304827','Manisa','TR',38.612,27.4265,'Europe/Istanbul'),
('304797','Mardin','TR',37.3131,40.7436,'Europe/Istanbul'),
('304531','Mersin','TR',36.812,34.6389,'Europe/Istanbul'),
('304184','Muğla','TR',37.2181,28.3665,'Europe/Istanbul'),
('304081','Muş','TR',38.7316,41.4848,'Europe/Istanbul'),
('303831','Nevşehir','TR',38.625,34.7122,'Europe/Istanbul'),
('303827','Niğde','TR',37.9658,34.6793,'Europe/Istanbul'),
('741100','Ordu','TR',40.9778,37.8905,'Europe/Istanbul'),
('303195','Osmaniye','TR',37.0742,36.2478,'Europe/Istanbul'),
('740483','Rize','TR',41.0208,40.5219,'Europe/Istanbul'),
('740264','Samsun','TR',41.2798,36.3361,'Europe/Istanbul'),
('300822','Siirt','TR',37.9293,41.9413,'Europe/Istanbul'),
('739600','Sinop','TR',42.0268,35.1625,'Europe/Istanbul'),
('300619','Sivas','TR',39.7483,37.0161,'Europe/Istanbul'),
('738927','Tekirdağ','TR',40.9781,27.511,'Europe/Istanbul'),
('738743','Tokat','TR',40.3139,36.5544,'Europe/Istanbul'),
('738648','Trabzon','TR',41.005,39.7269,'Europe/Istanbul'),
('298846','Tunceli','TR',39.0992,39.5435,'Europe/Istanbul'),
('298299','Uşak','TR',38.6735,29.4058,'Europe/Istanbul'),
('298117','Van','TR',38.4946,43.3832,'Europe/Istanbul'),
('738025','Yalova','TR',40.655,29.2769,'Europe/Istanbul'),
('296562','Yozgat','TR',39.82,34.8044,'Europe/Istanbul'),
('737022','Zonguldak','TR',41.4514,31.7931,'Europe/Istanbul'),
('749780','Çanakkale','TR',40.1555,26.4127,'Europe/Istanbul'),
('749748','Çankırı','TR',40.5999,33.6153,'Europe/Istanbul'),
('748879','Çorum','TR',40.5489,34.9533,'Europe/Istanbul'),
('311046','İzmir','TR',38.4127,27.1384,'Europe/Istanbul'),
('745028','İzmit (Kocaeli)','TR',40.765,29.9293,'Europe/Istanbul'),
('298333','Şanlıurfa','TR',37.1671,38.7939,'Europe/Istanbul'),
('300640','Şırnak','TR',37.5139,42.4543,'Europe/Istanbul');
alter table public.weather_cities enable row level security;
revoke all on public.weather_cities from anon, authenticated;
grant select on public.weather_cities to authenticated;
create policy weather_cities_read on public.weather_cities for select to authenticated using (true);

create table public.family_room_settings (
 family_id uuid primary key references public.families(id) on delete cascade,
 city_id text references public.weather_cities(id),
 sound_enabled boolean not null default false,
 motion_enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.family_room_settings enable row level security;
revoke all on public.family_room_settings from anon, authenticated;
grant select, insert, update, delete on public.family_room_settings to authenticated;
create policy family_room_settings_read on public.family_room_settings for select to authenticated
 using (family_id=gina.family_id() and (gina.is_parent() or (gina.is_device() and gina.child_id() is not null)));
create policy family_room_settings_parent on public.family_room_settings for all to authenticated
 using (family_id=gina.family_id() and gina.is_parent()) with check (family_id=gina.family_id() and gina.is_parent());

-- Shared city cache: neither child identity nor family identity reaches the weather provider.
create table public.room_weather_cache (
 city_id text primary key references public.weather_cities(id), forecast jsonb,
 expires_at timestamptz not null default '-infinity', refresh_after timestamptz not null default '-infinity',
 last_modified text
);
alter table public.room_weather_cache enable row level security;
revoke all on public.room_weather_cache from public, anon, authenticated;
grant all on public.weather_cities, public.family_room_settings, public.room_weather_cache to service_role;

-- Atomically reserve one provider request per city; failed fetches back off for 60 seconds.
create function public.claim_room_weather_refresh(p_city_id text) returns boolean
language sql security definer set search_path='' as $$
 with claimed as (
  insert into public.room_weather_cache(city_id,refresh_after) values(p_city_id,now()+interval '60 seconds')
  on conflict(city_id) do update set refresh_after=now()+interval '60 seconds'
  where public.room_weather_cache.expires_at<=now() and public.room_weather_cache.refresh_after<=now()
  returning city_id
 ) select exists(select 1 from claimed);
$$;
revoke execute on function public.claim_room_weather_refresh(text) from public, anon, authenticated;
grant execute on function public.claim_room_weather_refresh(text) to service_role;
