# Prova — sınav hazırlığı, kendini deneme ve öğrenme modülü

Son güncelleme: 2026-10-30. Karar kaydı [DECISIONS.md](./DECISIONS.md)'de; bu dosya modülün işleyişini ve AI üretim şablonunu tutar.

## Adlandırma

Modül **Prova**; içindeki her çalışma bir **deneme**, ilk kullanımda (ve istenince tekrar) yapılan test **seviye tespiti**, MEB konu-soru dağılım tablosundan türeyen plan **senaryo (blueprint)**.

## Akışlar

1. **Soru kütüphanesi** (`question_bank`): elle ya da AI ile üretilen her soru ders + sınıf + konu (+ senaryo kodu) ile kaydedilir; şıklı (`multiple_choice`) ya da açık uçlu (`open_ended`); zorluk `kolay | orta | orta_ustu | zor`; **beklenen cevap, çözüm yolu, anlatım** soruyla birlikte; `source_urls` (resmî kaynaklar öncelikli) ve `provenance` (üreten kişi/AI, model, prompt, prompt sürümü) tutulur; `times_asked` sorunun kaç denemede kullanıldığını sayar. İleride kitapçık (PDF) bu kütüphaneden derlenir.
2. **Senaryolar** (`exam_blueprints`): ör. «Fen 5. sınıf Senaryo 2» = `[{topic, count}]` satırları + kaynak URL. Ebeveyn MEB tablosunu yükler/yapıştırır; AI konu başına soru sayısı önerir, ebeveyn düzenler.
3. **Deneme** (`exams`): senaryodan ya da elle soru seçerek oluşur; süreli/süresiz; çocuk tablet/telefonda çözer (`exam_attempts`, `exam_answers`): şıklılar anında otomatik puanlanır; açık uçlular AI değerlendirmesine düşer (puan + eksik noktalar + iyileştirme önerileri). Sonuçtan istenirse çalışma planı üretilir (görev şablonları + takvim etkinlikleri).
4. **Seviye tespiti:** ders+sınıf için dengeli bir deneme üretip sonucu `level` olarak kaydeder; sonraki üretimlerde zorluk dağılımına girdi olur.

## AI soru üretimi (Edge Function `prova-generate`, Anthropic anahtarıyla açılır)

Girdiler: ders, sınıf, konu(lar) ya da senaryo, soru sayısı (senaryodaysa konu başına), tür(ler), zorluk, dil. Kurallar:

- Resmî kaynakları tercih et ve `source_urls`'e yaz: MEB ÖDSGM konu-soru dağılım tabloları (ör. https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724), MEB ders kitapları, EBA; doğruluğu şüpheli kaynak kullanma.
- Her soru için beklenen cevap + adım adım çözüm + kısa anlatım üret; şıklıda 4 seçenek + tek doğru + çeldirici gerekçeleri.
- Üretimi `provenance` ile kaydet: `{generator: "ai", model, prompt_version, requested_by, prompt}`.
- Çocuk AI ile doğrudan etkileşmez: üretim ve değerlendirme veli alanından tetiklenir; çocuğa yalnız sorular ve (veli onayıyla) geri bildirim gösterilir.

Örnek aile kullanımı (Enes'in eşinin ChatGPT promptundan uyarlandı; üretim şablonuna temel):

> Okulun her ders için senaryoları belli (Fen Senaryo 2, Mat Senaryo 3, Sosyal Senaryo 3). Önümüzdeki üç yazılı fen, matematik ve sosyal. Üçü için de 5'er soru, zorluk **orta üstü** (zor değil, kolay değil). Konular senaryodaki konular; MEB örnek soruları stilinde.

Bu istek Prova'da şuna çevrilir: üç deneme (ders başına bir), her biri ilgili senaryo blueprint'inden, 5 soru, zorluk `orta_ustu`, tür şıklı+açık uçlu karışık (veli seçer), kaynaklar MEB.

## AI değerlendirme (Edge Function `prova-grade`)

Açık uçlu cevapları beklenen cevap + çözüm yoluna göre 0-100 puanlar; `eksikler[]`, `iyilestirme_onerileri[]`, `kisa_geri_bildirim` döndürür; denemenin tamamı için konu bazlı güçlü/zayıf alanlar çıkarır. İstenirse `plan_olustur` ile zayıf konulardan görev şablonları ve tekrar takvimi önerir (veli onaylayınca yazılır).

## Paket kapısı

Ücretsiz: seviye tespiti + ayda 1 küçük deneme (AI üretimsiz, kütüphaneden). Plus: senaryolu denemeler + AI üretim (aylık kota). Pro: + açık uçlu AI değerlendirme, çalışma planı üretimi, kitapçık dışa aktarma. (plans tablosuna Faz 2'de `prova_*` kolonları eklenecek.)

## Durum

- [x] Şema + RLS + RPC'ler + pgTAP (bu commit)
- [ ] Veli ekranları: kütüphane, senaryo, deneme oluşturma; çocuk ekranı: deneme çözme
- [ ] `prova-generate` / `prova-grade` Edge Function'ları (anahtar gelince)
- [ ] Seviye tespiti akışı; plan üretimi; kitapçık PDF
