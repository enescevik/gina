"""Package browser-rendered v5 references. Does not draw or edit raster artwork."""
from pathlib import Path
import json, hashlib, html, sys
root=Path(__file__).resolve().parents[4]
group=sys.argv[1]
p=root/'docs/design/screens'/group
r=json.loads((p/'render-report.json').read_text())
labels={'child':'Çocuk ekranları','parent-daily':'Veli · Günlük','parent-prova':'Veli · Prova','account':'Hesap ve diğer'}
label=labels[group]
basecss='''*{box-sizing:border-box}body{margin:0;background:#f6f1e7;color:#284b47;font:16px/1.5 system-ui}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:38px;letter-spacing:-1px;margin:8px 0}h2{font-size:26px;margin:0 0 12px}p{max-width:920px}a{color:#087f7d}nav{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0 28px}nav a,.pill{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 16px;background:#e1eee6;border:1px solid #bfcec2;border-radius:12px;text-decoration:none;font-weight:650}section{padding:26px 0;border-top:1px solid #d9d4c5}.views{display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap}.phone{width:273px;max-width:100%;border-radius:16px;box-shadow:0 10px 28px #725b2920}.tablet{width:min(900px,100%);border-radius:14px;box-shadow:0 10px 28px #725b2920}figure{margin:0}figcaption{padding:8px 0;color:#61756b;font-size:14px}.screen-links{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0}.screen-links a{min-height:48px;display:flex;align-items:center}.route{font-family:monospace;font-size:14px;color:#6a7b70}.notice{border-left:3px solid #b08b4b;padding:6px 16px;color:#68736a}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.sheet img{width:100%;border-radius:10px}.sheet.child{grid-template-columns:repeat(2,1fr)}.sheet h2{font-size:20px;margin:8px 0}.state-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.state-grid img{width:100%}a:focus-visible{outline:3px solid #087f7d;outline-offset:3px}@media(max-width:700px){main{padding:18px}h1{font-size:30px}.sheet,.sheet.child{grid-template-columns:1fr 1fr}.state-grid{gap:8px}.tablet{width:100%}.phone{width:100%;max-width:390px}}'''
def page(title,body):return f'<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Gina v5</title><style>{basecss}</style><main>{body}</main></html>'
intro=f'<span class="pill">v5 · Tasarım incelemesi</span><h1>{label}</h1><p>Onaylı oda sanatının devamı. Türkçe metinler ayrı arayüz katmanıdır. Bu sayfa uygulama ekran görüntüsü veya çalışan oyun motoru değildir.</p><nav><a href="../shared-v5/index.html">Bütün ekranlar</a><a href="contact-sheet.html">Toplu görünüm</a><a href="REVIEW.md">İşlev eşlemesi ve notlar</a><a href="manifest.json">Dosya envanteri</a></nav>'
body=intro+'<nav>'+''.join(f'<a href="#{s["id"]}">{s["title"]}</a>' for s in r['screens'])+'</nav>'
contact=f'<h1>{label} · v5</h1><p>Normal durumlar · {len(r["screens"])} ekran · Tasarım maketleri</p><div class="sheet {"child" if group=="child" else ""}">'
for s in r['screens']:
 id=s['id']; title=s['title']; states=['empty','loading','error']
 body+=f'<section id="{id}"><h2>{title}</h2><p class="route">{s["route"]}</p><div class="views"><figure><a href="reference-v5.html?screen={id}"><img class="phone" src="{id}-phone.png" alt="{title} telefon tasarımı"></a><figcaption>390 × 844 · Telefon</figcaption></figure>'
 if group=='child':body+=f'<figure><a href="reference-v5.html?screen={id}&device=tablet"><img class="tablet" src="{id}-tablet.png" alt="{title} tablet tasarımı"></a><figcaption>1280 × 800 · Tablet</figcaption></figure>'
 body+='</div><div class="screen-links">'+f'<a href="{id}-states.html">Boş / yükleniyor / hata</a>'
 shots=[x for x in r['captures'] if x['screen']==id and x.get('part',1)>1 and x['state']=='normal']
 for x in shots:body+=f'<a href="{x["file"]}">{x["device"]} · devam {x["part"]}</a>'
 for v in s.get('variants',[]):body+=f'<a href="reference-v5.html?screen={id}&state={v}">{v} görünümü</a>'
 body+='</div></section>'
 source=f'{id}-'+('tablet' if group=='child' else 'phone')+'.png'
 contact+=f'<figure><img src="{source}" alt="{title}"><h2>{title}</h2><span class="route">{s["route"]}</span></figure>'
 statebody=f'<h1>{title} · Durumlar</h1><p>Türkçe arayüz referansı · 390 × 844 telefon'+(' ve 1280 × 800 tablet' if group=='child' else '')+'</p><div class="state-grid">'
 for state,t in zip(states,['Boş / başlangıç','Yükleniyor','Hata']):statebody+=f'<figure><h2>{t}</h2><img src="{id}-{state}-phone.png" alt="{t} telefon"></figure>'
 statebody+='</div>'
 if group=='child':
  statebody+='<h2 style="margin-top:28px">Tablet</h2><div class="state-grid">'
  for state,t in zip(states,['Boş / başlangıç','Yükleniyor','Hata']):statebody+=f'<figure><img src="{id}-{state}-tablet.png" alt="{t} tablet"></figure>'
  statebody+='</div>'
 (p/f'{id}-states.html').write_text(page(title+' durumlar',statebody))
(p/'index.html').write_text(page(label,body))
(p/'contact-sheet.html').write_text(page(label+' toplu görünüm',contact+'</div>'))
route_map=[]
inv=json.load(open('/tmp/gina-screen-inventory.json')) if Path('/tmp/gina-screen-inventory.json').exists() else []
for s in r['screens']:
 source=root/'apps/mobile/src/app'/(s['route']+'.tsx')
 route_map.append({'id':s['id'],'route':s['route'],'sourceFile':str(source.relative_to(root)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest() if source.exists() else None,'variants':s.get('variants',[]),'existingCopyAndFields':next((x for x in inv if x['route']==s['route']+'.tsx'),None)})
(p/'route-map.json').write_text(json.dumps(route_map,ensure_ascii=False,indent=2)+'\n')
readme=f'''# {label} — v5 tasarım teslimi

Ürün sahibinin “bu güzel, tüm ekranları yap bu şekilde” mesajıyla **art-direction-v5 görsel dili onaylandı**. Bu grubun ekran düzenleri, üretim kaplamaları ve uygulama entegrasyonu ayrıca onay bekliyor. Önceki v4 GLB/model/animasyonları onaylanmış sayılmaz.

- {len(r['screens'])} ana görünüm; telefon 390×844{', tablet 1280×800' if group=='child' else ''}.
- Her ekran için normal, boş/başlangıç, yükleniyor ve hata PNG’si; üç durum birlikte `*-states.png`.
- Uzun formlar kaydırılır. `*-part-2.png` vb. görüntüler aynı ekranın devamıdır; alan silinmedi.
- Türkçe metin HTML arayüz katmanında; sanat plakalarında yazı/rakam yok. Sahne plakaları yalnız **referans maketi** içindir; uygulamada tek resmin üstüne görünmez hitbox koyulmayacak.
- Veriler tasarım örnekleridir (Ece/Can ve bilinen demo bağlamı). Canlı veritabanından çekilmiş sonuç iddiası yok. Alanlar ve akışlar `route-map.json` ile mevcut route kaynaklarına eşlendi.
- Sunum kodu, `apps/mobile/assets`, i18n, sorgu, mutasyon, auth, routing, RPC ve `supabase/` değiştirilmedi. Paket eklenmedi.

## Görsel kararlar

Ahşap/krem/teal, Baloo 2 başlıklar ve Nunito gövde; yumuşak malzeme ayrımı; boyalı mevcut avatar, görev, ders, etkinlik ve koleksiyon sanatları. Çocukta oda, pano, masa ve raflar tek mekân olarak okunur. Veli formları ferah kâğıt yüzeylerde sürer. Çocuk bottom-nav yok; büyük içerik doğal kaydırma ile devam eder. Referansta animasyon yanılsaması veya büyütülen pet yok; gerçek rig/animasyon üretimi bu PNG tesliminin kapsamı değildir.

## Gerçek uygulama karşılaştırması

30 Ekim 2026 yeniden denendi: `http://localhost:8081/sign-in` açıldı; demo hesabı girişinde **Database error querying schema** alındı. Veritabanı değiştirilmedi, sıfırlanmadı, seed çalıştırılmadı. `../shared-v5/evidence/demo-schema-error.png` gerçek uygulama kanıtıdır. Oturum gerektiren ekranlar için gerçek karşılaştırma eksik; maketler “uygulama ekranı” diye sunulmadı. Hesap grubunda erişilebilen giriş ekranı ayrıca yan yana verilir.

## Claude için

1. Ekran düzeni onayından önce bu grubu uygulamaya giydirme. Tasarım PR’ı uygulama PR’ından ayrı tutulur.
2. Onaydan sonra gereken art/skin parçalarını `room-chrome` 9-slice (`capInsets`, `contentInsets` @3x, `minimumLogicalSize`) ve `rooms/v2` içerik sınırı/ortak ayak çizgisi sözleşmesine göre ayrı asset olarak teslim et. Bu maket plakasını production arka plan/hitbox çözümü yapma.
3. Mevcut NineSlice, SkinPressable, SkinProgress, TaskIcon, SubjectIcon, EventIcon ve Collectible bileşenleri korunacak. Metinler tr/en i18n, en az 48 dp hedef, safe area, büyük yazıda reflow ve iOS/Android/web doğrulaması uygulama PR’ında yapılacak.
4. Mevcut davranışlar ve erişim kısıtları korunur. PIN, yıldız/rozet verme, Prova deneme başlatma/puanlama, oda tercihi kalıcılığı ve mağaza işlemleri makette gerçek çalışmaz. Yeni veri/RPC gereksinimi kodlanmadan ayrı istek olarak açıklanır.
5. Demo auth şema sorununu ayrıca incele; bu sanat işinde veritabanına müdahale edilmedi. Gerçek ekran yan yana karşılaştırmaları oturum erişimiyle tamamlanmalı.

## Dosyalar ve kontrol

`manifest.json` tam dosya listesi, `render-report.json` ekran bazında tarayıcı kontrolü, `route-map.json` kaynak eşlemesi. `reference-v5.html?screen=<slug>&device=phone&state=normal` kaydırılabilir maket kaynağıdır; backend bağlantısı yoktur.
'''
(p/'REVIEW.md').write_text(readme)
print(group, len(r['screens']),len(r['captures']))
