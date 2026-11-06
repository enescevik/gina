-- U03/L02: arşivlenmiş takvim kayıtları veli okumasında da gizli.
-- L02 (20261106030000_bulk_archive) çocuk cihazı politikasını `archived_at is null` ile daraltmıştı; veli
-- politikası açık kalmıştı ve veli istemcileri (takvim, Bugün) arşivli etkinliği göstermeye devam ediyordu.
-- Politika adı/komutu/türü aynı kalır (100 envanteri); yalnız USING daralır. WITH CHECK değişmez.
-- Sonuç: veli arşivli satırı okuyamaz, doğrudan güncelleyemez/silemez. Arşivden geri alma ve önizleme
-- (`bulk_archive_preview(archived=true)`, `bulk_restore_apply`) SECURITY DEFINER olduğundan etkilenmez.
-- Arşivli etkinliğin tekrar istisnaları da (`event_exceptions_parent_all` EXISTS alt sorgusu) veliye görünmez.
alter policy events_parent_all on public.events
  using (((family_id = (select gina.family_id())) and (select gina.is_parent()) and (archived_at is null)));
