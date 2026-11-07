# Gina font (prototip 0.1)

Gina için kodla çizilmiş, çalışan bir **variable font**. Uygulamaya entegre değildir; v1 Baloo 2 + Nunito ile çıkar.

| Dosya | İçerik |
|---|---|
| `GinaVF.ttf`, `web/GinaVF.woff2` | Variable font: `wght` 300–800, `wdth` 90–115 |
| `static/GinaBirlik-*.ttf` | Ebeveyn kesimi (wdth 90): Regular 400, Medium 500, SemiBold 600 |
| `static/GinaKesif-*.ttf` | Çocuk kesimi (wdth 115): Regular 450, SemiBold 600, Bold 700 |
| `specimen.png` | Gece mavisi specimen, telefonda 14 pt / 17 pt testi |
| `source/` | `glyphs.py` (harf iskeletleri), `build.py` (üretici), `specimen.html` |

**Birlik ↔ Keşif tek eksende:** genişlik ekseni ilerledikçe iskelet genişler, x-yüksekliği büyür, kâseler kareden yuvarlağa döner, kontrast azalır, aralık açılır ve `a` otomatik olarak okul biçimine (tek katlı) geçer (`rvrn`). Birlik'te okul `a`sı `ss01` ile açılır.

**İmza detaylar:** kemerler gövdeden ince boyunla ayrılır (n m h r u), `k`/`K` bacağı koldan çıkar, `l` ve `t` kuyrukludur, açık uçlar hafif şişer, Türkçe çengeller harfe bağlıdır, `ı`/`i` noktası yuvarlak ve ayrıktır.

**Karakter seti:** A–Z, a–z, ÇĞİÖŞÜ çğıöşü, 0–9 (tablo genişliği), `. , : ; ! ? ' " ‘ ’ “ ” - – · ( ) / + = % * ₺`.

**Eksikler (prototip):** kerning yok, hinting yok, `& @ #` ve diğer Latin aksanlı harfler yok, bazı sıkı kıvrımlarda (s, a kâsesi) iç boşluk kalın kesimde sivrileşiyor. Mağaza kalitesi için bir tip tasarımcının `source/` çıktısını Glyphs/FontLab'da temizlemesi gerekir.

```sh
pip install fonttools skia-pathops brotli
python source/build.py
```
