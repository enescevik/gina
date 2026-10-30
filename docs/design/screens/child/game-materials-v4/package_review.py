"""Generate reproducible review pages and hashed inventories; run after captures."""
from pathlib import Path
import json, hashlib, struct, html
P=Path(__file__).resolve().parent
refs='../../../../../packages/assets/'
models=json.loads((P/'model-review.json').read_text())
labels={'character-girl':'Karakter 1 · küt saç','character-boy':'Karakter 2 · kısa saç','character-unspecified':'Karakter 3 · orta saç','pet-cat':'Kedi','pet-dog':'Köpek','pet-monkey':'Maymun','pet-lion':'Aslan yavrusu','display-tooth-care':'Diş bakımı','display-tidy':'Düzen','display-bookworm':'Kitap kurdu','display-first-task':'İlk görev','display-bronze':'Bronz','display-silver':'Gümüş','display-gold':'Altın','display-diamond':'Elmas','display-locked':'Kilitli','display-early-bird':'Erken kuş','display-helper':'Yardımsever','display-math-star':'Matematik yıldızı','display-week-hero':'Hafta kahramanı'}
style='''*{box-sizing:border-box}body{margin:0;background:#eee6d9;color:#25443e;font:16px/1.5 system-ui}header,main{max-width:1440px;margin:auto;padding:24px}h1{font-size:30px;margin:0 0 8px}h2{font-size:23px;margin:34px 0 12px}p{max-width:1000px}a{color:#087e7e}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.weather{grid-template-columns:repeat(4,minmax(0,1fr))}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}article,figure{margin:0;background:#fff8ef;padding:16px;border-radius:18px}img{display:block;width:100%;height:auto;border-radius:10px}.pair img{height:210px;object-fit:contain;background:#eee6d9}figcaption{font-size:13px;margin-top:8px}small{font-size:13px;color:#5d7068}nav{display:flex;gap:20px;flex-wrap:wrap}code{font-size:12px}h3{font-size:18px;margin:0 0 10px}.compare img{height:auto}.compare figure{padding:8px}.note{padding:18px;background:#fff8ef;border-radius:15px}@media(max-width:800px){.grid,.weather{grid-template-columns:repeat(2,minmax(0,1fr))}.pair img{height:150px}.compare{grid-template-columns:1fr}}'''
def page(title,body):
    return f'<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{style}</style><header><h1>{title}</h1><nav><a href="viewer.html">Canlı 3D oda</a><a href="contact-sheet.html">Model ailesi</a><a href="weather-sheet.html">Atmosfer</a><a href="comparison.html">Referans karşılaştırması</a><a href="README.md">Teslim notu</a></nav></header><main>{body}</main></html>'
body='<p>Solda mevcut resimli varlık, sağda gerçek GLB modelinin tarayıcı görüntüsü. Modeller ilk 3D adaylardır; sanat eşleşmesi henüz onaylanmadı. Her model bağlantısından döndürerek inceleyebilirsin.</p>'
for prefix,title in [('character-','Üç çocuk'),('pet-','Dört dost'),('display-','13 ödül')]:
    body+=f'<h2>{title}</h2><div class="grid">'
    for m in models:
        slug=m['slug']
        if not slug.startswith(prefix):continue
        ref=refs+('gamification/illustrated-v3/' if prefix=='display-' else 'rooms/v2/')+slug+'.webp'
        body+=f'<article><h3>{labels[slug]}</h3><div class="pair"><figure><img src="{ref}" alt="{labels[slug]} çizim referansı"><figcaption>Mevcut çizim</figcaption></figure><figure><img src="previews/{slug}.png" alt="{labels[slug]} gerçek 3D model"><figcaption>Yeni 3D aday</figcaption></figure></div><p><a href="model.html?asset={slug}">Modeli döndür</a> · <a href="models/{slug}.glb">GLB</a><br><code>{slug}</code></p></article>'
    body+='</div>'
body+='<h2>Malzeme haritaları</h2><p>512×512 base-color haritaları; procedural shader kaynakları Blender içinde. Görüntü altındaki adlar inceleme arayüzüdür.</p><div class="grid">'
for p in sorted((P/'materials').glob('*.png')):body+=f'<figure><img src="materials/{p.name}" alt="{p.stem}" style="max-height:180px;object-fit:cover"><figcaption>{p.stem}</figcaption></figure>'
body+='</div>'
(P/'contact-sheet.html').write_text(page('Gina · Model ve malzeme ailesi',body))
phases={'sunrise':'Gün doğumu','day':'Gündüz','sunset':'Gün batımı','night':'Gece'}
weathers={'clear':'Açık','cloudy':'Bulutlu','rain':'Yağmur','snow':'Kar','wind':'Rüzgâr','fog':'Sis'}
body='<p>24 gerçek WebGL görünümü. Güneş/ay, ufuk ışığı, gölgeler ve dış hava aynı sahnede değişir. Seçimler manuel; gerçek konum veya hava servisi bağlı değil.</p>'
for w,wl in weathers.items():
    body+=f'<h2>{wl}</h2><div class="grid weather">'
    for p,pl in phases.items():body+=f'<figure><a href="viewer.html?phase={p}&weather={w}"><img src="previews/weather-{p}-{w}.png" alt="{pl}, {wl}"></a><figcaption><b>{pl}</b> · {wl}</figcaption></figure>'
    body+='</div>'
(P/'weather-sheet.html').write_text(page('Gina · Işık ve hava atlası',body))
body='''<p>Oda işlevleri ve nesne ailesi korunur. Referansın boya dokusu, yüz/saç biçimi ve doğal animasyon kalitesi birebir eşleşmiş sayılmaz. İki görüntü de gerçek uygulama ekran görüntüsü değildir: soldaki onaylı hedef, sağdaki bu paketin 3D renderıdır.</p><div class="pair compare"><figure><img src="../../../room-v2/references/child-home-approved.png" alt="Onaylı çocuk ana ekranı"><figcaption>Onaylı hedef · metinler referans UI'sı</figcaption></figure><figure><img src="reference-room-day.png" alt="Yeni 3D sahne renderı"><figcaption>Yeni 3D sanat adayı · Blender renderı · yazısız</figcaption></figure></div><h2>Çalışan WebGL görünümü</h2><img src="previews/weather-day-clear.png" alt="WebGL odası"><p>Blender renderının ışık kalitesi ile gerçek zamanlı önizleme aynı değildir. Mobil renderer ve kalite bütçesi henüz doğrulanmadı.</p><div class="pair compare"><figure><img src="previews/pet-yawn.png" alt="Pet esneme eklemleri"><figcaption>Çene/baş/kulak/kuyruk klibi · segmentli rig</figcaption></figure><figure><img src="previews/drawer-open.png" alt="Ödül çekmecesi hareketi"><figcaption>Korunan çekmece animasyonu</figcaption></figure></div>'''
(P/'comparison.html').write_text(page('Gina · Referans ve 3D karşılaştırması',body))
def glb(p):
    raw=p.read_bytes();assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);tris=0
    for mesh in j.get('meshes',[]):
        for prim in mesh['primitives']:
            assert prim.get('mode',4)==4
            acc=j['accessors'][prim['indices'] if 'indices' in prim else prim['attributes']['POSITION']];tris+=acc['count']//3
    return {'meshes':len(j.get('meshes',[])),'triangles':tris,'skins':len(j.get('skins',[])),'materials':len(j.get('materials',[])),'animations':[{'name':a['name'],'durationSeconds':max(j['accessors'][s['input']].get('max',[0])[0] for s in a['samplers'])} for a in j.get('animations',[])]}
def info(p):return {'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
entries=[]
for m in models:
    p=P/'models'/(m['slug']+'.glb');item={**info(p),'slug':m['slug'],**glb(p),'contentBounds':m['bounds'],'sourceCollection':('children-' if m['slug'].startswith('character-') else 'pets-' if m['slug'].startswith('pet-') else 'collectibles-')+m['slug'].split('-',1)[1]};entries.append(item)
assert len(entries)==20
(P/'models/manifest.json').write_text(json.dumps({'status':'review-candidates','units':'meters','upAxis':'Y','frontAxis':'+Z','rootOrigin':[0,0,0],'commonRoomFloorY':.1,'entries':entries},ensure_ascii=False,indent=2)+'\n')
(P/'materials/manifest.json').write_text(json.dumps({'status':'review-candidates','source':'Blender procedural nodes retained in source .blend','colorSpace':'sRGB','maps':[dict(info(p),width=512,height=512,channel='baseColor') for p in sorted((P/'materials').glob('*.png'))]},ensure_ascii=False,indent=2)+'\n')
(P/'previews/manifest.json').write_text(json.dumps({'status':'review-only-not-app-assets','source':'real Three.js WebGL captures, no generated replacement screenshots','entries':[info(p) for p in sorted((P/'previews').glob('*.png'))]},ensure_ascii=False,indent=2)+'\n')
files=[]
for p in sorted(P.rglob('*')):
    if p.is_file() and p!=P/'manifest.json' and p.suffix not in ('.blend1','.pyc') and '__pycache__' not in str(p):
        e=info(p);e['file']=str(p.relative_to(P));files.append(e)
(P/'manifest.json').write_text(json.dumps({'status':'reference-driven-3d-review-candidates','supersedes':{'reviewDirection':'../game-direction-v3/viewer.html','productionAssets':None},'artApproved':False,'nativeValidated':False,'sourceTool':'Blender 5.0.1','viewerDependency':'Three.js 0.180.0 via pinned CDN, no app dependency','inventory':{'children':3,'pets':4,'collectibles':13,'standaloneGLB':20,'baseColorMaps':9,'timePhases':list(phases),'weathers':list(weathers),'combinations':24},'room':glb(P/'gina-room-reference.glb'),'sources':['../../../room-v2/references/child-home-approved.png',refs+'rooms/v2/',refs+'gamification/illustrated-v3/'],'files':files},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'models':len(entries),'files':len(files),'room':glb(P/'gina-room-reference.glb')},ensure_ascii=False))
