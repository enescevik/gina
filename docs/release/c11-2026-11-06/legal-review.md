# C11 / S05 — Hukuk metinleri: yer tutucu envanteri ve uygulama karşılaştırması (6 Kasım 2026)

> **Açık durum: Hukuk uzmanı onayı YOK; `docs/legal/` altındaki 10 metin taslaktır.** Bu çalışma teknik bir karşılaştırmadır; hukuki görüş, onay veya yayın izni değildir. Hiçbir metin yayımlanmadı, `EXPO_PUBLIC_LEGAL_BASE_URL` bağlanmadı, mağaza beyanı değiştirilmedi. Gerçek kişi/şirket bilgisi eklenmedi.

Kapsam: `docs/CLAUDE-REMAINING-WORK.md` → C11 ve S05 (Bağımlılık X03). Kaynak: worktree `agent-a3d9c70d56ef6951a`, taban commit `f95b8d5`.

Değişen dosyalar (yalnız metin, küçük hedefli düzenlemeler):

- `docs/legal/gizlilik-politikasi.md` (yalnız Türkçe bölüm düzeltildi; İngilizce bölüme "senkron değil, yeniden çevrilmeli" notu eklendi)
- `docs/legal/kvkk-aydinlatma-metni.md`, `docs/legal/kullanim-kosullari.md`, `docs/legal/abonelik-kosullari-ve-on-bilgilendirme.md`, `docs/legal/hesap-ve-veri-silme.md`, `docs/legal/cocuk-modu-bilgilendirme.md`, `docs/legal/veli-beyani-ve-cocuk-profili-onayi.md`, `docs/legal/acik-riza-metinleri.md`, `docs/legal/kvkk-basvuru-formu.md`, `docs/legal/cerez-politikasi.md`
- Bu rapor.

Her dosyada: (1) "Durum" satırı "uzman incelemesi önerilir" yerine **"hukuk uzmanı incelemesi ve onayı yapılmadı; onay kaydı olmadan yayımlanmaz"** oldu; 0.2'deki "(hukuki) inceleme notları" ifadesinin uzman onayı olmadığı yazıldı. (2) Uygulamada olmayan vaatler başlıkta "Uygulama denetimi (6 Kasım 2026)" notuyla listelendi. (3) Mevcut özelliklerin yanlış anlatımı düzeltildi. (4) Hukuki dayanak seçimleri değiştirilmedi; ilgili yerlere "Uzman incelemesi gerekir" yazıldı. (5) Değişiklik geçmişine "0.2 (C11 teknik düzeltme)" satırı eklendi.

---

## A. Yer tutucu envanteri

### Yöntem

Sayım elle değil betikle yapıldı. Betik `docs/legal/*.md` içindeki en dıştaki köşeli parantezleri iç içe parantezleri bozmadan okur; ardından `(` gelen Markdown bağlantı metinlerini (36 adet) ve `[ ]`, `[x]`, `[..]`, `[...]` işaretlerini dışarıda bırakır. HTML yorumları da sayılır. Betik aşağıdadır; çalıştırma: `python3 -I placeholders.py <repo-kökü>`.

```python
import sys, glob, collections, os
def outer_brackets(text):
    out, depth, start = [], 0, None
    for i, ch in enumerate(text):
        if ch == '[':
            if depth == 0: start = i
            depth += 1
        elif ch == ']' and depth > 0:
            depth -= 1
            if depth == 0: out.append((text[start:i + 1], text[i + 1:i + 2]))
    return out
per = collections.defaultdict(collections.Counter)
for f in sorted(glob.glob(os.path.join(sys.argv[1], 'docs/legal/*.md'))):
    for tok, nxt in outer_brackets(open(f, encoding='utf-8').read()):
        if nxt == '(' or tok in ('[ ]', '[x]', '[X]', '[...]', '[..]'): continue
        per[tok][os.path.basename(f)] += 1
print(len(per), sum(sum(c.values()) for c in per.values()))
```

### Sayılar

| Ölçüm | Düzenleme öncesi (`f95b8d5`) | Düzenleme sonrası |
|---|---|---|
| Benzersiz yer tutucu | **239** | **222** |
| Toplam geçiş | **611** | **591** |
| Gruplanmış satır (aşağıdaki tablo) | — | 38 |

Bu çalışmada eklenen notlar köşeli parantez kullanmaz; azalma yalnızca kodla yanıtlanan teknik ve ürün sorularının kaldırılmasından gelir. Kaldırılan/çözülen yer tutucular:

| Kaldırılan yer tutucu | Dosya | Koddaki yanıt (kanıt) |
|---|---|---|
| `[ÜRÜN KARARI / TEKNİK TEYİT: cihazda ön işleme ve fotoğrafın Gina'da saklanıp saklanmadığı]`, `[ÜRÜN KARARI: işlem tamamlandığında Gina'da silinir / [SÜRE] saklanır]` ve §10 tablosundaki eşi, `[ÜRÜN/AVUKAT: fotoğrafın Gina'da saklanıp saklanmadığı…]`, `[ÜRÜN KARARI: Gina Pro fotoğraftan takvim görselleri]` | gizlilik, aydınlatma, hesap-silme | Dosya özel kovada saklanır; kayda bağlı kaldıkça tutulur; bağlanmayan 24 saat, içe aktarmada kullanılan 7 gün sonra silinir; cihazda ön işleme/maskeleme yok (`supabase/migrations/20261102130000_learning_sources.sql`, `20261105010000_learning_source_sets.sql` `expire_unlinked_learning_sources`, `supabase/functions/source-cleanup/`, `packages/core/src/i18n/tr.json` `import.privacy`) |
| `[TEKNİK TEYİT]` (sağlayıcı cihazla doğrudan konuşmaz) | gizlilik | Tüm AI çağrıları Edge fonksiyonlarından (`supabase/functions/_shared/ai-operation.ts`) |
| `[TEKNİK TEYİT: ebeveyn PIN'inin sunucuda mı cihazda mı tutulduğu]` (TR) | gizlilik | Sunucuda, aile başına tek özet (`public.parent_pins(family_id, pin_hash)`, `20261029200000_schema.sql`) |
| `[TEKNİK TEYİT: aile saat dilimi de gerekiyorsa buraya eklenir]` | acik-riza | Haftalık özet girdisinde `timezone` gönderilir (`20261103088000_weekly_summary_safety.sql`) |
| `[ÜRÜN KARARI — avukat görüşüyle: (a)… (b)…]` (2 dosya) | gizlilik, hesap-silme | Diğer ebeveyn varsa sahiplik devredilir, son ebeveynde aile silinir (`20261031120000_account_lifecycle.sql`, `20261106040000_deletion_preview.sql`); "uzman incelemesi gerekir" notu eklendi |
| `[ÜRÜN KARARI: kodun geçerlilik süresi]` | cocuk-modu | 10 dakika (`device_pairings.expires_at`, `20261029200000_schema.sql`) |
| `[ÜRÜN KARARI: QR eşleştirmede yalnızca o sırada kamera izni]` | cocuk-modu | Gina QR için kamera izni istemez (`tr.json` `u02.parentPair.cameraBody`) |
| `[ÜRÜN KARARI: tek tablette birden fazla çocuk…]` | cocuk-modu | PIN cihaz başına isteğe bağlı (`configure_child_device(p_pin_required)`, `20261102010000_device_access_and_family_switch.sql`) |
| `[ÜRÜN KARARI: paket başına cihaz sayısı]` | cocuk-modu | Kod varsayılanı 1/3/sınırsız (`plans.max_devices`, `20261030010000_entitlements.sql`); kesin sınır Abonelik Koşulları'ndaki yer tutucuda bırakıldı |
| `[EXPO BELİRTEÇ SİLME SÜRESİ]`, `[STANDART SÖZLEŞME … – Expo]`, `[ÜRÜN KARARI – EAS Update kullanılıyorsa…]`, Veli Beyanı §9'daki "Expo: [..]" | hesap-silme, aydınlatma, veli-beyani | Expo push hizmeti kullanılmıyor (`supabase/functions/push-send/providers.ts`, `docs/PUSH.md`); `app.json`'da EAS Update adresi yok |
| `[TEKNİK: çevrimdışı önbellek eklenirse güncellenir]` | cerez | Web'de yerel depolama kuyrukları zaten var (bkz. B-24) |

### Eksik bilgi listesi (tekilleştirilmiş, düzenleme sonrası)

"Kim sağlar": **İşletme sahibi** (Enes; şahıs/şirket bilgisi, ürün/fiyat kararı, sözleşmeler), **Hukuk uzmanı**, **Mağaza hesabı** (App Store Connect / Play Console sahibi), **Teknik** (Claude/geliştirici; derleme ve sağlayıcı ayarından okunur). Dosya kısaltmaları: abonelik, acik-riza, aydinlatma, cerez, cocuk-modu, gizlilik, hesap-silme, kullanim, kvkk-basvuru, veli-beyani.

| Yer tutucu (grup) | Benzersiz | Toplam | Dosyalar (adet) | Kim sağlar | Not |
|---|---|---|---|---|---|
| [WEB ADRESİ] / [WEB SİTESİ ADRESİ] | 2 | 78 | abonelik 16, acik-riza 9, aydinlatma 13, cerez 4, cocuk-modu 9, gizlilik 8, hesap-silme 2, kullanim 5, kvkk-basvuru 3, veli-beyani 9 | İşletme sahibi + Teknik | Alan adı (X01); EXPO_PUBLIC_LEGAL_BASE_URL ile aynı kök olmalı |
| [AVUKAT …] soruları (her biri ayrı soru) | 69 | 78 | abonelik 6, acik-riza 13, aydinlatma 11, cerez 5, gizlilik 14, hesap-silme 4, kullanim 6, kvkk-basvuru 4, veli-beyani 15 | Hukuk uzmanı | Hukuki teyit/yorum; metin değiştirilmedi |
| [E-POSTA] | 1 | 53 | abonelik 5, acik-riza 6, aydinlatma 5, cerez 2, cocuk-modu 3, gizlilik 12, hesap-silme 3, kullanim 8, kvkk-basvuru 2, veli-beyani 7 | İşletme sahibi | Tek destek/gizlilik adresi; uygulamada ve mağaza kaydında aynı olmalı |
| Şablon/UI değişkenleri ve belge adı bağlantıları ([Çocuk], [ÇOCUK ADI], [Adınız], [Okudum], [Tam metin], [Veli Beyanı], [Gina Pro'da: …] vb.) | 17 | 43 | abonelik 1, acik-riza 11, aydinlatma 2, cocuk-modu 6, gizlilik 5, hesap-silme 4, kullanim 2, veli-beyani 12 | Teknik | Doldurulmaz; yayın derlemesinde değişken veya bağlantıya çevrilir |
| [ÜRÜN KARARI …] notları | 34 | 40 | abonelik 1, acik-riza 6, aydinlatma 1, cocuk-modu 7, gizlilik 9, hesap-silme 3, kullanim 3, kvkk-basvuru 3, veli-beyani 7 | İşletme sahibi | Ürün kararı; bir kısmı kodla yanıtlandı ve kaldırıldı |
| [3 yıl] / büyük harfli eşi (önerilen süre) | 2 | 26 | abonelik 3, acik-riza 2, aydinlatma 3, cerez 2, gizlilik 8, hesap-silme 2, kullanim 1, kvkk-basvuru 3, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| [ADRES] | 1 | 25 | abonelik 2, acik-riza 2, aydinlatma 2, cerez 2, cocuk-modu 1, gizlilik 6, hesap-silme 3, kullanim 2, kvkk-basvuru 2, veli-beyani 3 | İşletme sahibi | Tebligat adresi |
| [VERİ SORUMLUSU UNVANI] | 1 | 21 | abonelik 2, acik-riza 3, aydinlatma 2, cerez 2, cocuk-modu 1, gizlilik 4, hesap-silme 1, kullanim 2, kvkk-basvuru 2, veli-beyani 2 | İşletme sahibi | Şahıs/şirket kararı |
| [MERSİS/VKN] / [MERSİS] / [VKN/TCKN] | 3 | 18 | abonelik 3, acik-riza 3, aydinlatma 1, cerez 1, cocuk-modu 1, gizlilik 4, hesap-silme 1, kullanim 1, kvkk-basvuru 1, veli-beyani 2 | İşletme sahibi | Şahıs ise TCKN/VKN, şirket ise MERSİS |
| [12 ay] / büyük harfli eşi (önerilen süre) | 2 | 18 | abonelik 2, aydinlatma 1, cerez 3, cocuk-modu 2, gizlilik 4, hesap-silme 2, kullanim 1, kvkk-basvuru 1, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| Ek A şablon alanları ([PAKET], [PLAN ADI], [FİYAT], [DÖNEM], [BİRİM FİYAT]) | 5 | 16 | abonelik 16 | Teknik | Uygulama mağazanın yerelleştirilmiş fiyatından doldurur; doldurulmaz |
| [KEP ADRESİ] (± "varsa") | 3 | 15 | abonelik 1, aydinlatma 2, cerez 1, gizlilik 6, hesap-silme 2, kullanim 1, kvkk-basvuru 2 | İşletme sahibi | Yoksa satır kaldırılır |
| [10 yıl] / büyük harfli eşi (önerilen süre) | 2 | 14 | abonelik 3, aydinlatma 1, gizlilik 4, hesap-silme 2, kullanim 1, kvkk-basvuru 1, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| [YÜRÜRLÜK TARİHİ] / [TARİH] | 2 | 13 | abonelik 2, acik-riza 2, aydinlatma 1, cerez 1, cocuk-modu 1, gizlilik 2, hesap-silme 1, kullanim 1, kvkk-basvuru 1, veli-beyani 1 | İşletme sahibi + Hukuk uzmanı | Uzman onayından sonra yayın tarihi |
| [30 gün] / büyük harfli eşi (önerilen süre) | 2 | 13 | aydinlatma 1, gizlilik 5, hesap-silme 3, kullanim 1, kvkk-basvuru 1, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| [15 gün] / büyük harfli eşi (önerilen süre) | 2 | 11 | abonelik 1, acik-riza 1, aydinlatma 1, cerez 2, gizlilik 2, kullanim 2, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| [TEKNİK / YAYIN ÖNCESİ TEYİT …] | 11 | 11 | acik-riza 1, aydinlatma 2, cerez 3, gizlilik 5 | Teknik | Yayın öncesi teknik doğrulama (ör. MFA, Web Analytics kapalı) |
| [AVUKAT/ÜRÜN …] karma karar notları | 10 | 10 | abonelik 1, acik-riza 2, aydinlatma 1, gizlilik 4, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Ürün kararı hukuki görüşe bağlı |
| [STANDART SÖZLEŞME / AKTARIM MEKANİZMASI DURUMU …] | 9 | 10 | acik-riza 1, aydinlatma 4, cerez 1, gizlilik 3, veli-beyani 1 | İşletme sahibi + Hukuk uzmanı | Sağlayıcıyla Kurul standart sözleşmesi imza ve Kurum bildirim tarihleri |
| [SİLME SÜRESİ …] | 3 | 9 | acik-riza 1, aydinlatma 1, gizlilik 5, hesap-silme 1, veli-beyani 1 | Hukuk uzmanı + İşletme sahibi | 18 yaş pasifleştirme sonrası; özellik uygulanmadı |
| [90 gün] / büyük harfli eşi (önerilen süre) | 2 | 9 | aydinlatma 2, cocuk-modu 1, gizlilik 4, veli-beyani 2 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| Fiyat referansları ([99,99] … [1.999,99]) | 6 | 6 | abonelik 6 | İşletme sahibi + Mağaza hesabı | Mağazada tanımlı nihai fiyatla aynı olmalı; aylık karşılık hesaplanır |
| [ANTHROPIC ADRESİ] / [ÜLKE] | 2 | 6 | acik-riza 1, aydinlatma 1, gizlilik 4 | İşletme sahibi + Teknik | Sağlayıcı sözleşmesinden; [ÜLKE] e-posta sağlayıcısının ülkesi |
| [CLOUDFLARE … SÜRESİ] | 3 | 6 | cerez 2, gizlilik 4 | Teknik | Cloudflare sözleşmesi/ayarlarından okunur |
| [APPLE BELİRTEÇ İPTAL KAYDI SÜRESİ] | 1 | 6 | aydinlatma 1, gizlilik 4, hesap-silme 1 | Hukuk uzmanı + Teknik | Apple belirteç iptali uygulanmadı |
| [İTİRAZ … / YENİDEN ONAY SÜRESİ] | 4 | 5 | acik-riza 1, veli-beyani 4 | Hukuk uzmanı + İşletme sahibi | Veli itirazı/yeniden onay akışı uygulanmadı |
| [ASGARİ iOS/ANDROID SÜRÜMÜ] | 2 | 4 | abonelik 2, kullanim 2 | Teknik | Yayın derlemesinin minimum OS ayarından |
| [DESTEK YANIT / HİZMET SONLANDIRMA / DOĞRULAMA BAĞLANTISI SÜRESİ] | 3 | 4 | abonelik 1, hesap-silme 1, kullanim 2 | İşletme sahibi | İşletme taahhüdü |
| [E-POSTA GÖNDERİM SAĞLAYICISI] | 2 | 4 | aydinlatma 1, gizlilik 2, kullanim 1 | İşletme sahibi + Teknik | X01; seçilmedi (Resend/SMTP adapter hazır) |
| [ÖN BİLDİRİM SÜRESİ …] | 2 | 4 | aydinlatma 1, gizlilik 2, veli-beyani 1 | Hukuk uzmanı + İşletme sahibi | 18 yaş öncesi bildirim; özellik uygulanmadı |
| [BAŞLANGIÇ/PLUS/PRO CİHAZ LİMİTİ] | 3 | 3 | abonelik 3 | İşletme sahibi | Kod varsayılanı 1 / 3 / sınırsız (plans.max_devices) |
| [SUPABASE PROJE REFERANSI] / [DİL/BÖLGE TERCİHİ ANAHTARI] | 2 | 3 | cerez 3 | Teknik | Üretim derlemesinden okunur |
| [IP özeti / uygulama örneği kimliği] notları | 3 | 3 | gizlilik 2, veli-beyani 1 | Hukuk uzmanı | Rıza kaydı alanı; kayıt şeması uygulanmadı |
| [AB TEMSİLCİSİ] | 2 | 2 | gizlilik 2 | Hukuk uzmanı + İşletme sahibi | GDPR m.27 gerekip gerekmediği |
| [İYS NUMARASI] | 1 | 1 | acik-riza 1 | İşletme sahibi | Yalnız pazarlama iletisi açılırsa |
| [1 saat] / büyük harfli eşi (önerilen süre) | 1 | 1 | cocuk-modu 1 | Hukuk uzmanı + İşletme sahibi | Saklama/bildirim süresi; kodda karşılığı yok veya farklı olabilir (rapor §B) |
| [YEDEK İRTİBAT KİŞİSİ] | 1 | 1 | kvkk-basvuru 1 | İşletme sahibi |  |
| [VELİ BEYANI WEB URL …] | 1 | 1 | veli-beyani 1 | İşletme sahibi + Hukuk uzmanı | Web'de yayımlanıp yayımlanmayacağı |

Notlar:

- "[AVUKAT …]" grubundaki 69 benzersiz soru tek tek hukuk uzmanına gider. Bu grupta Yönetmelik/Tebliğ madde teyitleri, m.9/6 "arızi aktarım", zamanaşımı ve 5651 soruları vardır. Metin değiştirilmedi.
- "[ÜRÜN KARARI …]" grubunda kalan 34 not işletme kararıdır. Örnekler: Apple Aile Paylaşımı, abonelik bitince limit üstü profillerin durumu, Veli Beyanı yeniden onay akışı ve web formunun v1'de olup olmayacağı.
- İngilizce Gizlilik Politikası bölümündeki eş yer tutucular sayıma dâhildir. O bölüm Türkçe düzeltmelerle senkron değildir.
- "Şablon/UI değişkenleri" ve "Ek A şablon alanları" gerçek eksik bilgi değildir. Bunlar uygulama veya web derlemesinde değişkene ya da bağlantıya çevrilir. Gerçek eksik bilgi sayısı bu iki grup çıkarılınca **200 benzersiz / 532 geçiş** olur.

---

## B. Çelişki tablosu (metin ↔ uygulamanın güncel davranışı)

Sonuç sütunu: **Düzeltildi** = metin güncel davranışı anlatacak şekilde değiştirildi · **İşaretlendi (uygulama işi)** = metin hedef davranışı anlatıyor, uygulamada yok; başlıktaki denetim notuna yazıldı, karar (kodu yazmak ya da metinden çıkarmak) yayın öncesi verilmeli · **Uzmana bırakıldı** = hukuki yorum gerekir, metin değiştirilmedi veya yalnız not düşüldü.

| # | Dosya § | Eski ifade (kısa) | Gerçek davranış ve kanıt | Sonuç |
|---|---|---|---|---|
| B-01 | 10 dosyanın "Durum" satırı; acik-riza değişiklik geçmişi | "Yayın öncesi avukat incelemesi önerilir"; "Hukuki inceleme notları ve DECISIONS.md'ye göre revizyon" | Uzman incelemesi/onayı kaydı yok (`docs/DECISIONS.md` §"Avukat": yayından önce inceleme şart) | **Düzeltildi**: "uzman onayı yok, onay kaydı olmadan yayımlanmaz" |
| B-02 | gizlilik Özet+§3+§4+§5; aydinlatma §5/§8; kullanim §2/§9/§10.1; abonelik §3; veli-beyani §7; cocuk-modu B.2 | AI = haftalık özet (Plus/Pro) + Pro'da "7 günlük ipuçları" ve fotoğraftan takvim (ayda 20) | Özellik matrisi (aylık sınır free/plus/pro): haftalık özet 0/5/5, ayrı "ipuçları" uç noktası yok, fotoğraftan takvim 0/5/20, belge analizi 0/5/20, soru üretimi 0/100/300, kurulum önerisi 0/10/30, açık uçlu değerlendirme 0/0/30, çalışma planı 0/0/30 (`packages/core/src/ai-capabilities.ts` `PLAN_LIMIT_DEFAULTS`, `docs/release/ai-providers-2026-11-06/README.md`) | **Düzeltildi** (acik-riza hariç; orada uzmana) |
| B-03 | gizlilik §5/§12; aydinlatma §8/§10; kullanim §9.1; abonelik §3; veli-beyani §7; kvkk-basvuru §1 | Tek, varsayılan kapalı AI izni; "Ayarlar > Yapay Zekâ Özeti" anahtarı; "Rızalarım"; diğer ebeveynlere bildirim | Her işlemde ayrı onay kutusu (`apps/mobile/src/app/parent/weekly-review.tsx`, `supabase/functions/timetable-import/handler.ts` `ai_consent`, `learning-plan-import/handler.ts`, `prova-review/index.ts` `answer_review_consents`, `learning_source_ai_consents`); haftalık özet onayı sunucuda kaydedilmez; genel anahtar/ekran/bildirim yok | **Düzeltildi** (davranış) + **uzmana bırakıldı** (izin modeli, m.9/6 dayanağı) |
| B-04 | gizlilik §5; aydinlatma §8; kullanim §9.2; abonelik §3/§13; veli-beyani §7 | Gönderilen: ad/takma ad veya "Çocuk A", yaş aralığı, istatistik; fotoğraf/okul gönderilmez | Haftalık özet: "Çocuk A" + sınıf + görev sayımları + yıldız + dil + saat dilimi (`20261103088000_weekly_summary_safety.sql`); kurulum: sınıf, yaş aralığı, ilgi alanı (`supabase/functions/_shared/setup-drafts.ts`); belge işlemleri: seçilen görsel/PDF olduğu gibi; değerlendirme: çocuğun cevap metni + çözüm defteri PNG + soru görselleri (`supabase/functions/prova-review/index.ts`); maskeleme yok (`prova-grade/index.ts` başlık yorumu) | **Düzeltildi** |
| B-05 | gizlilik Özet/§5/§9; aydinlatma Özet/§8; kullanim Özet/§5.1/§9.6; abonelik §3; veli-beyani §7; cocuk-modu A/B.2 | "Çocuklar yapay zekâ ile hiçbir şekilde etkileşmez; çocuk modunda hiçbir AI çıktısı yok" | Çocuk cihazı AI çağırmaz; ama AI üretimi sorular veli incelemesiyle çocuğa atanır, geri bildirim veli onayıyla çocuğa görünür (`20261030150000_prova_answers_child_privacy.sql`), çocuğun cevabı/el yazısı veli onayıyla Anthropic'e gider | **Düzeltildi** + **uzmana bırakıldı** (çocuk cevabı aktarımının dayanağı, çocuğa yönelik anlatım) |
| B-06 | gizlilik §5/§10; aydinlatma §8; hesap-silme §5 | Fotoğrafın Gina'da saklanması "ÜRÜN KARARI" | Özel kova `gina-private-sources`, saklama onayı zorunlu (`reserve_learning_source p_consent`), 24 saat/7 gün kuralı, saatlik temizlik (bkz. A) | **Düzeltildi** + süre uygunluğu **uzmana** |
| B-07 | gizlilik §3/§6/§8/§14; aydinlatma Özet/§6/§7; kullanim §7.4; veli-beyani §9; hesap-silme §5/§7; kvkk-basvuru §6; cerez §6 | Bildirimler Expo (650 Industries) üzerinden; Expo standart sözleşmesi | Push doğrudan APNs ve FCM HTTP v1; Expo push ve Firebase SDK yok (`supabase/functions/push-send/providers.ts`, `docs/PUSH.md`) | **Düzeltildi** (TR); FCM'de Google'ın rolü **uzmana**; EN gizlilik senkron değil |
| B-08 | gizlilik §9; kullanim §2; veli-beyani §2/§6; cocuk-modu B.4 | Eşleştirme kodu ebeveyn hesabından üretilir, tablete girilir; süre "ÜRÜN KARARI" | Kod çocuk cihazında üretilir (`request_pairing`, `20261029200300_rpc.sql`), 10 dk geçerli, QR aynı kodu taşır, veli telefonunda önizleme + onay (`20261106260000_pairing_handoff.sql`); Gina kamera izni istemez | **Düzeltildi** |
| B-09 | gizlilik §9; aydinlatma §3.2/§13; kullanim §2; veli-beyani §2/§6; cocuk-modu B.3/B.4 | Çocuk modu girişi 4 haneli çocuk PIN'i ile (zorunlu) | PIN cihaz başına isteğe bağlı; kapalıysa cihaza erişen seçili tüm profillere girer (`configure_child_device`, `tr.json` `experience.device.pinOff`); PIN'ler 5 yanlışta 60 sn kilit | **Düzeltildi** |
| B-10 | gizlilik §3/§9; aydinlatma §2/§4; kullanim Özet/§2/§5.1; veli-beyani §2/§6; cocuk-modu A/B.2 | Çocuk yalnız görev işaretler; çocuk modunda metin girişi yok | Çocuk: görev, hafta, takvim, hedef (`set_child_goal`), oda/evcil hayvan (`set_room_preference`, `set_room_pet`), koleksiyon, Prova cevapları ve çözüm defteri (`apps/mobile/src/app/child/`) | **Düzeltildi** |
| B-11 | gizlilik §3/§9; aydinlatma §3.2; kullanim §2/§4.2; veli-beyani §5; cocuk-modu A/B.2 | Çocuk için yalnız ad + doğum yılı; okul adı istenmez | İsteğe bağlı cinsiyet ve ilgi alanları (`20261102050000_child_setup.sql`), eğitim döneminde okul adı (`20261105040000_child_education_periods.sql`) | **Düzeltildi**; veli-beyani §5 tablosu ve hukuki sebep **uzmana** |
| B-12 | aydinlatma §5; kullanim §11.2; abonelik §3 | Öğretmen paylaşım bağlantısı "ileride; m.5/1 açık rıza" | Bağlantı çalışıyor: ilk ad + sınıf ve seçilen kapsam, 30/180 gün, iptal edilebilir, belirteç özeti (`20261030130000_teacher_share.sql`, `apps/mobile/src/app/parent/share.tsx`, `apps/mobile/src/app/s/[token].tsx`); ayrı rıza kutusu yok | **Düzeltildi** (özellik anlatımı, alıcı satırları) + hukuki sebep **uzmana** |
| B-13 | gizlilik §9; kullanim §7.2/§11.2; acik-riza başlık | Topluluk/sosyal alan yok (doğru); katkı ve grup denemesi anılmıyor | F01 sosyal pilot ertelendi (`docs/DECISIONS.md` F01). Kodda grup denemesi (takma adla sıralama, GINA ekibinin yazılı cevap incelemesi) ve kütüphane katkısı var; bayraklar kapalı (`cohorts.enabled`, `contribution_sets.enabled` = false); katkı lisansı hesap kapanınca sürer (`tr.json` `contribution.license`) | **Düzeltildi** (kapalı olduğu yazıldı) + açılmadan önce **uzmana** |
| B-14 | gizlilik §4/§14; kullanim §8.1/§16.2; aydinlatma §1; abonelik §7 | "SMS kanalı yoktur"; bildirim yalnız görev/abonelik/güvenlik | E-posta/SMS kanal kodu hazır, sağlayıcı yok, pazarlama kilitli (`20261106080000_notification_channels.sql`, `docs/release/notification-channels-2026-11-06/README.md`); hizmet duyuruları uygulama içi + push (`20261105061000_parent_announcements.sql`) | **Düzeltildi** |
| B-15 | tüm belgelerdeki ekran yolları | "Ayarlar > Gizlilik ve Yasal", "Rızalarım", "KVKK Başvurusu" formu, kayıt ekranında belge bağlantıları | Yok. Yasal bağlantılar yalnız abonelik ekranında ve `EXPO_PUBLIC_LEGAL_BASE_URL` varken (`apps/mobile/src/app/parent/subscription.tsx`); veli menüsünde gizlilik/yasal öğesi yok (`apps/mobile/src/app/parent/menu.tsx`); destek için Yardım > destek talebi (`20261103030000_support_help.sql`) | **İşaretlendi (uygulama işi)** |
| B-16 | kullanim §3.1–3.2; veli-beyani başlık/Ek A/§13; aydinlatma giriş | Koşulları kabul kutusu, Veli Beyanı onayı, sürüm/zaman kaydı, Koşulların e-postayla gönderilmesi | Kayıtta yalnız istemci tarafı yetişkin/veli kutusu (`apps/mobile/src/app/(auth)/sign-in.tsx` `accountV5.adult`); sunucu kaydı yok; e-posta sağlayıcısı yok | **İşaretlendi (uygulama işi)** + **uzmana** |
| B-17 | hesap-silme §2/§3/§7; gizlilik §11; aydinlatma §9; kullanim §13; abonelik §10 | Girişsiz web silme formu, dönem sonuna planlı silme, alındı/tamamlandı e-postaları, Apple belirteç iptali, 18 yaş pasifleştirme | Yalnız uygulama içi hemen silme (`supabase/functions/delete-account/handler.ts`); Apple revoke çağrısı yok; 18 yaş işi yok | **İşaretlendi (uygulama işi)** |
| B-18 | gizlilik §11; hesap-silme §9 | Çok ebeveynli silme "ÜRÜN KARARI (a)/(b)" | Her aile ayrı; diğer ebeveyn varsa sahiplik devri, son ebeveynde aile silinir (`20261031120000_account_lifecycle.sql`, `tr.json` `accountV5.deleteBody`) | **Düzeltildi** + **uzmana** (uygunluk) |
| B-19 | gizlilik §10/§11; aydinlatma §9; hesap-silme §6; kullanim §13.2; abonelik §12/§13 | Silmeden sonra satın alma kayıtları 10 yıl, rıza/beyan 3 yıl, silme kaydı 3 yıl tutulur | `store_subscriptions` aile ile cascade silinir (`20261030010000_entitlements.sql`); aileye ait `audit_log` silinir (`20261031120000_account_lifecycle.sql`); `notification_consent_log` hesapla silinir | **İşaretlendi (uygulama işi)** + süreler **uzmana** |
| B-20 | gizlilik §11; hesap-silme §2 | "Güvenlik için yeniden giriş isteyebiliriz" | Yeniden doğrulama zorunlu: şifre veya son 5 dk içinde e-posta OTP; 15 dk geçerli etki önizlemesi (`delete-account/handler.ts`, `20261106040000_deletion_preview.sql`); silme önizlemesi abonelik ekranına yönlendirir (`apps/mobile/src/components/deletion-preview-sheet.tsx`) | **Düzeltildi** |
| B-21 | abonelik §12/Ek A/Ek B; kullanim §10.9 | Satın alma ekranında tam ön bilgilendirme, "okudum" onayı, teyit kaydı, satın alma sonrası e-posta, belge indirme | Ekranda kısa yenileme/iptal metni (`tr.json` `iap.legal`), mağaza fiyatı, "İlk 7 gün ücretsiz"; "Kullanım Koşulları" yalnız iOS'ta Apple EULA'ya gider; onay/teyit/e-posta yok (`subscription.tsx`) | **İşaretlendi (uygulama işi)** + Ek A yeterliliği **uzmana** |
| B-22 | abonelik başlık | (yazılmamıştı) Hukuk URL'si yokken satış | `canBuy = canManage && !!LEGAL_BASE_URL`; bağlantılar `/legal/abonelik-kosullari` ve `/legal/gizlilik-politikasi`; belgelerin "Yayın yeri" yollarıyla **uyumlu** (gizlilik başlık yorumu, abonelik §11/§188) | **Düzeltildi** (bilgi eklendi); çelişki yok |
| B-23 | abonelik §9; kullanim §10.5 | "Haklı bulduğumuz talepleri Play Console araçlarıyla iade ederiz" (operatör aracı ile karışabilir) | Yönetim "Mağazadan kontrol et" yalnız okur/eşitler; iade, iptal ve acknowledge yapmaz (`supabase/functions/iap-operator-reconcile/`, `docs/IAP.md` "Operatör kontrolü") | **Düzeltildi** (açıklama eklendi) |
| B-24 | cerez Özet/§2 | Tarayıcıya yalnız oturum + dil yazılır; görevler/notlar kalıcı yazılmaz | `localStorage`/`sessionStorage`'da işlem kuyrukları (`gina.answer-journal.v1:*`, `gina.help-outbox.v1:*`, `gina:*:command:*` vb.), bekleyen eşleştirme, çocuk modu, önbellek (`apps/mobile/src/lib/*.web.ts`, `packages/core/src/answer-journal.ts`) | **Düzeltildi** + "zorunlu/işlevsel" sınıflaması **uzmana** |
| B-25 | abonelik §3 tablo | Plus'ta fotoğraftan takvim yok; Pro'da 20 | Plus 5, Pro 20; Plus'ta da belge analizi, soru üretimi, kurulum önerisi var (B-02) | **Düzeltildi** |
| B-26 | abonelik §3; cocuk-modu B.4 | Cihaz limiti "[… CİHAZ LİMİTİ]" | Kod varsayılanı free 1, plus 3, pro sınırsız (`20261030010000_entitlements.sql`) | Bilgi eklendi; yer tutucu **işletme kararına** bırakıldı |
| B-27 | gizlilik §5; aydinlatma §8; kullanim §7.2/§9.5; veli-beyani §7 | "Anthropic verileri model eğitiminde kullanmaz"; tek sağlayıcı | Yalnız Anthropic `active`; OpenAI uyumlu ve Gemini adapterleri `unconfigured` iskelet (`supabase/functions/_shared/ai-adapter-openai.ts`, `ai-adapter-gemini.ts`, `PROVIDER_DEFAULTS`). Eğitim iddiası koddan doğrulanamaz | Sağlayıcı cümlesi **düzeltildi**; eğitim iddiası **uzmana** (sözleşme teyidi) |
| B-28 | kvkk-basvuru başlık/§2; gizlilik §12; aydinlatma §10; cocuk-modu B.1 | Uygulama içi KVKK formu ve e-posta doğrulamalı web formu | Yok; yalnız Yardım > destek talebi; uygulamada destek e-postası gösterilmez | **İşaretlendi (uygulama işi)** |
| B-29 | iletişim (tüm belgeler) | Tek `[E-POSTA]`; gizlilik "e-posta, KEP, posta"; kullanim "uygulama içi Destek formu" | Metinler arası iletişim yer tutucusu tutarlı (tek `[E-POSTA]`, telefon yok). Uygulamada e-posta adresi yok, uygulama içi Yardım var. Mağaza destek URL'si/e-postası henüz belirlenmedi | Gizlilik §12'ye Yardım eklendi; adres **işletme sahibine** |
| B-30 | cocuk-modu başlık/B.1; veli-beyani §6/§8 | Çocuk Modu Bilgilendirmesi ilk açılışta gösterilir, onay kutusu kaydedilir | Uygulamada bu metin/kutu yok (`tr.json`'da karşılığı yok) | **İşaretlendi (uygulama işi)** |
| B-31 | gizlilik başlık yorumu | Tablolar `docs/legal/internal/magaza-gizlilik-beyanlari.md` ile birebir tutulur | Dosya yok | Not edildi; mağaza beyan taslağı X03 adımında hazırlanmalı (aşağıda) |
| B-32 | gizlilik İngilizce bölüm | TR ile aynı içerik | Bu çalışmadaki TR düzeltmeleri EN'e taşınmadı | **İşaretlendi**: EN başına "senkron değil, yeniden çevrilmeli" notu |
| B-33 | aydinlatma §3.1 | Konum yok | Oda hava durumu için seçilen şehrin koordinatı sunucudan `api.met.no`'ya gider; kişisel veri yok (`supabase/functions/room-weather/handler.ts`) | **Düzeltildi** (bilgi eklendi) |
| B-34 | acik-riza tümü | Rıza A metni (haftalık özet + Pro fotoğraf), kayıt şeması, diğer veli itiraz kilidi | Bkz. B-03/B-04/B-05; işlem bazlı onay anahtarları başlık notunda listelendi | **Uzmana bırakıldı** (rıza metinleri değiştirilmedi) |
| B-35 | aydinlatma §6/§9; hesap-silme §5 | Yüklenen belgeler, Prova kayıtları, paylaşım bağlantıları silme kapsamında yok | Aile silinince `learning_sources` cascade + depolama kuyruğu; paylaşım bağlantıları kullanıcı silinince kaldırılır | **Düzeltildi** |
| B-36 | hesap-silme §4 | Profil silme ↔ arşiv ayrımı yok | Çocuk profili arşivi geri alınabilir, süresiz (`20261105050000_child_profile_archive.sql`); toplu arşiv silme değildir (`20261106030000_bulk_archive.sql`); doğrudan REST ile çocuk silme kapalı, `confirm_child_deletion` (`20261106170000_star_balance_and_child_delete.sql`) | **Düzeltildi** (denetim notunda) |
| B-37 | gizlilik §13; aydinlatma §13 | Yönetici erişimi MFA'lı ve kayıt altında | `[YAYIN ÖNCESİ TEYİT]` zaten var; operatör rolleri canlı yetkiyle (`20261106270000_operator_access.sql`); Supabase hesabı MFA'sı koddan doğrulanamaz | Yer tutucu korundu (**teknik + işletme**) |

**Özet sayım:** 37 bulgu. Birincil sonuca göre ayrık gruplar:

| Sonuç | Adet | Bulgular |
|---|---|---|
| Düzeltildi (metin güncel davranışı anlatıyor) | 23 | B-01…B-14, B-18, B-20, B-22, B-23, B-24, B-25, B-33, B-35, B-36 |
| İşaretlendi — uygulama işi (vaat var, kod yok) | 9 | B-15, B-16, B-17, B-19, B-21, B-28, B-30, B-31, B-32 |
| Uzmana bırakıldı (metin değiştirilmedi) | 2 | B-27, B-34 |
| İşletme/teknik karar bekliyor (yer tutucu korundu) | 3 | B-26, B-29, B-37 |

Ayrıca 14 bulguda (B-03, B-05, B-06, B-07, B-11, B-12, B-13, B-16, B-18, B-19, B-21, B-24, B-27, B-34) hukuki kısım için metne veya bu tabloya "uzman incelemesi gerekir" notu düşüldü; hukuki dayanak seçimlerinin hiçbiri değiştirilmedi.

---

## C. X03 — kullanıcı ve uzman adımları (sırayla)

Parola, anahtar veya belirteç bu süreçte hiçbir yere yazılmaz.

| Sıra | Kim | Ne yapar | Nerede | Başarı işareti |
|---|---|---|---|---|
| 1 | İşletme sahibi | Hukuki kimlik kararı (şahıs/şirket). Unvan, tebligat adresi, tek destek/gizlilik e-postası, varsa KEP, MERSİS veya VKN/TCKN ve alan adı (`[WEB ADRESİ]`, X01) belirlenir. | — | A bölümündeki kimlik satırlarının değerleri yazılı ve tek kaynakta toplanmış olur |
| 2 | İşletme sahibi | Ürün kararları: fiyatlar (`[99,99]`…), cihaz limitleri (kod varsayılanı 1/3/sınırsız), aylık AI sınırları (B-02 tablosu), deneme, Aile Paylaşımı, abonelik bitince limit üstü profil, destek yanıt süresi. Ayrıca B-15…B-21 için karar verilir: her vaat ya uygulanacak ya metinden çıkacak (planlı silme, web silme formu, silme e-postası, Apple belirteç iptali, 18 yaş, saklama, rıza kaydı, Gizlilik ve Yasal menüsü). | — | Karar listesi; uygulanacaklar için C kartında iş kalemi |
| 3 | İşletme sahibi + hukuk uzmanı | Sağlayıcı sözleşmeleri: Supabase, Anthropic, Cloudflare (ve seçilirse e-posta sağlayıcısı) ile Kurul standart sözleşmesi, imza ve 5 iş günü içinde Kurum bildirimi. Expo kullanılmadığı için listede yok. Google FCM'nin rolü belirlenir. | Sağlayıcı DPA sayfaları, KVKK bildirim kanalı | `[STANDART SÖZLEŞME …]` tarihleri dolu |
| 4 | Hukuk uzmanı | 10 metnin incelenmesi. Öncelik: (a) işlem bazlı AI onayı ile Rıza A modeli (B-03, B-34); (b) çocuğun Prova cevabı ve el yazısının yurt dışına aktarımı (B-05); (c) öğretmen paylaşımının hukuki sebebi (B-12); (d) yer tutucu süreler ve silme sonrası saklama (B-19); (e) web yerel depolama sınıflaması (B-24); (f) 69 `[AVUKAT …]` sorusu; (g) Anthropic "eğitimde kullanmaz" iddiası (B-27). Uzman, uygulamanın bugünkü davranışını Gizlilik Politikası Bölüm 5 ve bu rapordan okur. | `docs/legal/`, bu rapor | Uzmanın yazılı görüşü/işaretli metinler |
| 5 | Claude (teknik) | Uzman kararlarını metne işler. Gizlilik Politikası İngilizce bölümünü yeniden çevirir. Teknik yer tutucuları doldurur: asgari iOS/Android sürümü, Supabase proje referansı, dil anahtarı, Cloudflare süreleri, MFA ve Web Analytics teyidi. 2. adımda "uygulanacak" denen işleri ilgili C kartında kodlar. | repo | Yer tutucu sayımı yalnız hukuk dışı şablon alanlarına iner; `[AVUKAT]`/`[ÜRÜN KARARI]` 0 |
| 6 | Hukuk uzmanı + işletme sahibi | **Onay kaydı:** son metin sürümü ve tarihi, uzmanın adı/unvanı, onaylanan dosyaların commit kimliği ve kapsam dışı bırakılanlar. `docs/legal/` yanında bir onay kaydı dosyasına işlenir; AI onayı sayılmaz. | repo (ör. `docs/legal/ONAY-KAYDI.md`) | İmzalı/tarihli kayıt var |
| 7 | Claude (teknik) | **Yayın:** onaylı metinleri Cloudflare'da herkese açık HTML (TR/EN) olarak `/legal/<slug>` altında yayımlar. Slug'lar: `gizlilik-politikasi`, `kvkk-aydinlatma-metni`, `kullanim-kosullari`, `abonelik-kosullari`, `cerez-politikasi`, `hesap-ve-veri-silme`, `kvkk-basvuru-formu`. Giriş veya coğrafi kısıt yoktur. | Cloudflare Pages | Her URL 200 döner, yer tutucu içermez (betikle taranır) |
| 8 | Claude (teknik) + işletme sahibi | `EXPO_PUBLIC_LEGAL_BASE_URL` = yayın kökü (https) EAS/derleme ortamına girilir. Uygulamaya Gizlilik ve Yasal menüsü, kayıt ekranı bağlantıları ve Android'de Kullanım Koşulları bağlantısı eklenir (B-15/B-21). | EAS ortam değişkenleri | Abonelik ekranında iki bağlantı açılır, satın al düğmesi etkinleşir; TestFlight/iç test kanıtı |
| 9 | Mağaza hesabı sahibi | **Apple App Store Connect:** Privacy Policy URL; App Privacy beyanları güncellenir. Kapsam: Photos (yüklenen belgeler), User Content (çocuğun cevapları ve çözüm defteri, notlar), Identifiers, Purchases, Contact Info. Takip yok. Yaş derecelendirmesi ve "Kids" kategorisi dışında kalma kontrol edilir. İnceleme hesabı ve notu girilir; "Mağazadan kontrol et" iade değildir. **Google Play Console:** Privacy policy URL, Data safety, Hesap silme URL'si (`/legal/hesap-ve-veri-silme`), hedef kitle (18+ ebeveyn), İçerik derecelendirmesi. Ekran görüntüleri son sürümden alınır. | ASC, Play Console | Beyanlar uygulama ve metinle aynı; mağaza incelemesi geçer |
| 10 | Claude (teknik) | Son tutarlılık taraması: uygulama metinleri, yasal metinler ve mağaza beyanları karşılaştırılır; destek e-postası uygulamada, mağaza kaydında ve metinlerde aynıdır. | repo + mağaza | C11/S05 kabulü: bozuk/yer tutucu link yok, satın alma öncesi okunur, çelişki yok |

---

## D. Açık durum

- **Hukuk uzmanı onayı YOK.** Metinler taslaktır ve yayımlanmamıştır. Bu rapor bir hukuki değerlendirme değildir.
- `EXPO_PUBLIC_LEGAL_BASE_URL` tanımsızdır; bu nedenle uygulamada satın alma kapalıdır. Bu durum kasıtlıdır ve korunmalıdır.
- Mağaza gizlilik, yaş ve veri beyanları bu çalışmada güncellenmedi. `docs/legal/internal/magaza-gizlilik-beyanlari.md` mevcut değildir.
- Uygulamada olmayan vaatler (B-15…B-21, B-28, B-30) metinlerde açıkça işaretlidir. Yayından önce her biri için ya uygulama yapılmalı ya da vaat metinden çıkarılmalıdır.
- İngilizce Gizlilik Politikası Türkçe düzeltmelerle senkron değildir.
