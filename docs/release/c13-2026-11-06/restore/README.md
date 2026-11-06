# C13 madde 4 — izole geri yükleme tatbikatı (6 Kasım 2026)

> **Güncelleme (koordinatör, ikinci koşu):** C13-RST-1 `scripts/security/post-restore-acl-check.sql` içinde düzeltildi
> (`unsubscribe_with_token` bilinçli anon istisnası). Tatbikat yeniden koşuldu: çıkış 0, 60,2 s; `restore-database.mjs
> --execute` **çıkış 0**, ACL kontrolü **0 satır**; replica hedefi `pass: true`; disable-user hedefi yine RST-2 ile durdu.
> `restore-drill.json` ikinci koşunun çıktısıdır; aşağıdaki ilk koşu metni tarihsel kayıttır.

Betik: `scripts/security/c13-restore-drill.py` · Kanıt: [`restore-drill.json`](restore-drill.json) (sır yok; bağlantı dizeleri maskeli).
Komut: `python3 scripts/security/c13-restore-drill.py --run-local` → çıkış 0, **83,0 s** (koşu etiketi `gina_c13r_2e8c908009`).

**Hosted kanıt DEĞİLDİR.** Döküm yerel süper kullanıcı (`supabase_admin`) ile `pg_dump` edildi; replica veri yüklemesi de
süper kullanıcı ister. Supabase PITR/yedek paneli ve süper kullanıcısız hosted geri yükleme **AÇIK** kalır.

## Ne yapıldı

1. Kaynak DB (şablon klonu + 139 migration'ın tamamı, son `20261106320000_prereview_ops.sql`); gerçek GoTrue ile iki
   sentetik veli (A, B) kaydı; aile/çocuk/cihaz/3 not (+ not geçmişi); gerçek Storage API'ye (file backend, tmpfs) iki PDF
   yüklemesi (~48 KB) + `learning_sources` satırları (sha256). Kaynakta aynı uygulama kanıtı taban çizgisi olarak geçti.
2. Storage baytları kapsayıcıdan `tar` ile alındı (DB dökümü bayt taşımaz).
3. `pg_dump -Fc --data-only -n auth -n storage -n public -n gina --exclude-table-data=auth.schema_migrations --exclude-table-data=storage.migrations` (93.798 bayt).
4. Hedef = şablon klonu, public/gina düşürülmüş (0 tablo). `scripts/restore-database.mjs`: dry-run (hiçbir şey çalışmadı),
   yanlış `--target-confirm` → çıkış 2 (reddedildi), sonra `--execute --target-confirm <tgt>` replica modu: 139 migration,
   tohum TRUNCATE, veri yükü hatasız (23,4 s).
5. Hedefe yeni GoTrue/PostgREST/Storage kapsayıcıları; baytlar `tar` ile hedef Storage'a geri kondu.

## Sonuçlar (replica hedefi — gerçekten çalıştı)

| Kontrol | Sonuç |
|---|---|
| 11 tablo sayımı kaynak = hedef | **eşit** (auth.users 3, identities 2, families 2, members 2, children 2, devices 1, learning_sources 2, storage.objects 2, notes 3, note_changes 3, audit_log 57) |
| İçerik özetleri (md5; auth.users parola karması dahil, storage.objects id/version/metadata, buckets, aile/çocuk/kaynak/not) | 11/11 **eşit** |
| İlişkiler (13 sorgu: üye↔auth, kimlik↔kullanıcı, cihaz↔auth, kaynak↔storage nesnesi, boyut=bytes, not geçmişi; 5 yetim sorgusu) | kaynakla **eşit**, yetimler **0** |
| `post-restore-acl-check.sql` | **1 satır**: `public.unsubscribe_with_token(p_token text)` — kaynakta da aynı 1 satır (geri yüklemeden kaynaklanmıyor); pgTAP 102/116 allowlist'ini aşan **0**; NULL ACL 0; kapalı tetikleyici 0 |
| GoTrue parola girişi (veli A) | **200**; JWT `sub` = kaynak veli, `gina.family_id` = kaynak aile A, rol `parent`; yanlış parola **400**; veli B girişi 200, `family_id` = B |
| Storage imzalı URL (service_role imzalar, URL kimliksiz açılır) | imza 200, GET **200**, 49.205 bayt, **sha256 = orijinal yükleme**; ikinci nesne (B) de sha256 eşit; kurcalanmış belirteç 400 |
| Storage negatif | veli A / yabancı veli B / anon jetonuyla imza ve `/object/authenticated` indirme **400**, bayt alınamadı; `/object/public` 400 |
| PostgREST veli A | `learning_sources` 200, 1 satır, kendi ailesi, sha256 ve `object_path` orijinalle aynı; `children` 1 satır (çocuk A) |
| PostgREST yabancı / anon | veli B, A ailesinin `learning_sources`/`children` satırlarını **0** okur (B kendi 1 kaynağını görür); anon jeton **401** |
| Temizlik | 3 DB düşürüldü, tüm `gina_c13r_*` kapsayıcıları silindi, döküm dosyası silindi; doğrulama: kalan kapsayıcı 0, DB 0 |

## Bulgular

- **C13-RST-1 (`post-restore-acl-check.sql` eski allowlist):** S02 ile bilinçli olarak anon'a açılan
  `public.unsubscribe_with_token(text)` (imzalı e-posta vazgeçme bağlantısı; pgTAP 102 ve 116 allowlist'inde) bu sorguda istisna
  değil. Sonuç: doğru kurulmuş bir veritabanında da 1 satır döner ve `restore-database.mjs` geri yükleme başarılıyken
  **çıkış 1 / BAŞARISIZ** yazar. Runbook'un "0 satır" beklentisi de üretimde yanlış alarm verir. Öneri: sorgudaki istisnaya
  `public.unsubscribe_with_token` eklenmesi (bu turda dosyaya dokunulmadı; kapsam dışı).
- **C13-RST-2 (`--trigger-mode disable-user` denendi, BAŞARISIZ):** süper kullanıcısız `postgres` rolüyle ikinci hedefte
  koşuldu: 139 migration ve TRUNCATE geçti, veri adımı `permission denied for table audit_log_entries` (auth şeması) ile
  durdu. Yerel yığında `postgres`'in `auth.*` tablolarına (users dışında) yazma yetkisi yok; hosted'da da Auth tabloları
  `supabase_auth_admin`'e aittir. Yani bu yol, Auth verisi için mevcut haliyle **çalışmıyor**; hosted geri yükleme Supabase'in
  kendi yedek/PITR aracıyla yapılmalı ya da Auth verisi ayrı bir yolla (Auth yönetici rolü) yüklenmeli. Uygulama kanıtı bu
  hedefte koşulmadı.
- **C13-RST-3 (Storage meta verisi):** file backend içerik türünü dosya xattr'ında tutar; busybox `tar` xattr taşımaz →
  geri yüklenen nesne `application/octet-stream` döndü (kaynakta `application/pdf`). Baytlar ve DB'deki
  `storage.objects.metadata` eşit. Hosted (S3 backend) için nesne kopyası ayrı araçla yapılmalı ve Content-Type korunmalı.

## Açık kalanlar (hosted)

- Supabase panelinde günlük yedek/PITR durumu ve gerçek bir hosted geri yükleme provası (hesap sahibi).
- Hosted'da süper kullanıcı olmadan Auth + Storage + public birlikte geri yükleme yolu (C13-RST-2).
- Hosted Storage kovası `gina-private-sources` için nesne kopyası/geri yükleme (bayt + Content-Type) prosedürü.
- `post-restore-acl-check.sql` istisna güncellemesi (C13-RST-1) ve ardından canlıda bir kez salt okunur çalıştırma.
