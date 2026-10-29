# Mevcut uygulamaya uygulama planı

## Doğrulanan taban

- Expo ~58.0.21, React Native 0.88.1; SVG transformer ve react-native-svg mevcut. `apps/mobile/AGENTS.md` ile kullanılan Expo sürümünün dokümanını uygulamadan önce oku.
- Gerçek route yolları `src/app/child/` ve `src/app/parent/`; eski `(child)` isimlerini üretme.
- `apps/mobile/src/app/child/today.tsx`: eşlenmiş anonim çocuk oturumu, JWT'deki çocuk kimliği.
- `apps/mobile/src/app/parent/child-mode/today.tsx`: ebeveyn telefonunda çocuk modu; çıkış `verify_parent_pin` kontrolünü korur.
- Her ikisi `apps/mobile/src/components/today-view.tsx` kullanır. Ortak sunum bileşeni geliştir; iş kurallarını iki route'a kopyalama.
- `src/app/parent/index.tsx` mevcut onaylar ve kurulum/kısayol ekranı. Yeni tasarımda kurulum menüye taşınabilir; çocuk ekleme, cihaz eşleme, davet ve PIN işlemleri kaybolamaz.
- Takvim, ders/not, puan, abonelik ekranları mevcut; bunları tekrar kurma. Mevcut plan/yetki ve IAP webhook altyapısını koru. AI yalnız ebeveyn tarafındadır.
- SVG kullanan `avatar.tsx` ve `task-icon.tsx` statik import + slug fallback düzenini kullanıyor. Yeni subject/event/badge eşlemelerinde aynı yaklaşım; dinamik require(path) üretme.

## Görev ve yıldız doğruluğu

`TodayView` task_templates, task_completions ve star_events okuyor; `templatesDueOn` ile gün görevlerini seçiyor. Gün hesabı şu an DEFAULT_TIMEZONE kullanıyor; `docs/DECISIONS.md` gereği aile saat dilimini esas alacak şekilde düzelt ve gün değişimini test et.

`complete_task` sunucusu due_date ve yetkiyi doğrular. Onay gerekiyorsa status=done (bekliyor), gerekmiyorsa approved ve yıldız ledger kaydı oluşur. UI görev gönderildiğinde kendiliğinden yıldız eklememeli. `review_task` ebeveyn onayında satırı kilitler, done→approved/returned geçişini yapar; yıldız onayda yazılır. `undo_complete` yalnız done içindir. Bekleyen ve onaylanmış satırlar aynı başarı etiketiyle gösterilmemeli.

Mevcut TodayView herhangi bir completion bulunduğunda satırı kapatıyor; returned durumunun yeniden gönderme akışı eksik. Bunu tasarımla örtme: mevcut RPC'leri incele, gerekiyorsa migration/RPC ile güvenli yeniden gönderme ekle; UI başına ayrı yıldız mantığı oluşturma. İade edilen eski kazanılmış yıldızın davranışını mevcut sözleşmeden doğrula.

Aynı kullanıcı eyleminin ağ tekrarında aynı client_id kullanılmalı; yeni tıklama için UUID, aynı isteğin tekrarında yeni UUID değil. Offline görev kazanımı onay bekliyor/senkronize ediliyor olarak görünür. Ledger sonucu olmadan harcanabilir yıldız artmaz. Realtime invalidation, logout query temizliği ve kimlik ayrımı korunur.

## Yeni olanlar

children tablosunda avatar mevcut; gender, room/theme seçimi yok. Ödül kataloğu, envanter, hedef, rozet kazanımı ve seri tabloları yok. star_events.reason içinde reward olması bu sistemi hazır yapmaz. Yeni alanları mevcut kabul eden sorgu yazma.

Önerilen sonraki migration sınırları: child_room_preferences (avatar_key, theme_key, display_slots), family_rewards (type, cost, parent_defined), child_goals, reward_requests/fulfillments, child_inventory, badge_definitions, child_badge_awards. Kesin şema mevcut migration'larla karşılaştırılarak kararlaştırılmalı. Her tabloda family sınırı, çocuk/ebeveyn izinleri, audit timestamp ve ilgili benzersizlik kısıtları gerekir. Etkinlik kaynaklarını çoğaltma; `holidays` tablosunu ve ülke/tarih verilerini kullan.

Ödül talebi/debit RPC'si sunucuda ledger bakiyesi doğrulamalı, eşzamanlı istekleri seri hale getirmeli ve idempotency key ile aynı harcamayı tek defa yapmalı. Teslim/iptal ve yıldız iadesi de ayrı idempotent sunucu geçişleri olmalı. Çocuk maliyet belirleyemez veya delivered yazamaz. Child claims yalnız kendi envanterini görebilir, ebeveyn kendi ailesini yönetebilir.

## Sıra

1. Bu paket + güncel DECISIONS + kodu oku; kısa mevcut/yeni tabloyu güncelle. Veritabanını değiştirmeden ana ekran düzenini senaryolu sahte veriyle component seviyesinde göster.
2. Çocuk oyun odası ve ebeveyn ana ekranı: mevcut auth/query/RPC'ye bağla; katman, metin, hitbox ve responsive davranışı test et. Eski dashboard'a dönme.
3. Kullanıcı ana ekran uygulamasını gördükten sonra Hazinem, Koleksiyonum, Odam seçim paneli ve ödül detaylarının tasarım turuna geç.
4. Yeni sunucu modelleri + RLS/RPC testleri; ardından ödüller/rozetler. Backfill politikası açık olmadan geçmiş olayları tekrar ödüllendirme.
5. Sezonsal dekor altyapısı; tarih/yerel takvim/tercih doğrulaması. İleride yeni gün eklemek uygulama ana ekranını yeniden yazmayı gerektirmesin.

Her aşama ayrı küçük PR. Testler: etkilenen tip kontrolü ve mevcut testler; yeni RLS/RPC ve yarış koşulları için gerçek davranış testleri. Görsel-only değişiklik için gereksiz snapshot yığını üretme.

## Teslim sırasında gelen main güncellemesi

`bb390aa` ayrıca incelendi: `/child/week.tsx` Haftam ekranı ve AI haftalık özet altyapısı eklendi. Haftam için yeni veri modelini tekrar yaratma; mevcut query/realtime akışını oda takvimine bağla. Bu ekran da DEFAULT_TIMEZONE kullanıyor. Parent çocuk modundan Haftam’a giderken anonim child route claims varsayımına takılmadan ortak görünüm/acting child kimliğiyle güvenli yol tasarla. AI altyapısı ebeveyn + paket kontrolü içeriyor; API anahtarı yoksa skipped/not_configured, hazır içerik varmış gibi gösterme.

CI: main 5d20850 ve yeni PR 5–7, eksik react-native-svg-transformer lock kaydı nedeniyle frozen install aşamasında durdu. Asset-only kapsamda kilit dosyası değiştirilmedi; uygulama testleri bu teslimde geçti deneme. Claude mevcut yerel pnpm-lock.yaml değişikliğini inceleyerek kendi kod akışında düzeltmeli.
