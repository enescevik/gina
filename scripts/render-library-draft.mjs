/** Local editorial preview only. No application route, upload or publication. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {drawMath6} from './render-math6-diagrams.mjs';
const folder=path.resolve(process.argv[2]??'docs/learning/library-pilot/grade-5-science');
const data=JSON.parse(await fs.readFile(path.join(folder,'pilot.json'),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ink='#201951', purple='#6442DA',mint='#52BFA8',cream='#FFFDF8';
const text=(x,y,s,size=36)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${ink}" font-size="${size}" font-family="Arial,sans-serif">${esc(s)}</text>`;
const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const half=(x,y,r,side)=>`<path d="M ${x} ${y-r} A ${r} ${r} 0 0 ${side==='right'?1:0} ${x} ${y+r} Z" fill="#FFF6C9"/>`;
function draw(d){
 const math6=drawMath6(d,{text,ink,purple,mint,circle});if(math6)return math6;
 if(d.type==='phase_cards'){
  const body=d.cards.map((phase,i)=>{const x=230+(i%2)*340,y=140+Math.floor(i/2)*280,r=75;return circle(x,y,r,ink,`data-phase="${phase}"`)+(phase==='full'?circle(x,y,r,'#FFF6C9'):phase==='first'?half(x,y,r,'right'):phase==='last'?half(x,y,r,'left'):'')+circle(x,y,r,'none',`stroke="${purple}" stroke-width="3"`)+text(x,y+120,'ABCD'[i],48);}).join('');
  return {w:800,h:600,body};
 }
 if(d.type==='same_face'){
  const [cx,cy]=d.center;let body=`<circle cx="${cx}" cy="${cy}" r="240" fill="none" stroke="#BDB2DD" stroke-width="3" stroke-dasharray="9 9"/>`+circle(cx,cy,65,mint)+text(cx,cy+12,'Dünya',26);
  for(const [i,[x,y]] of d.positions.entries()){
   const norm=Math.hypot(cx-x,cy-y),mx=x+(cx-x)/norm*d.marker_offset,my=y+(cy-y)/norm*d.marker_offset;
   body+=circle(x,y,48,'#EBE5FA',`stroke="${purple}" stroke-width="3"`)+circle(mx,my,9,purple,`data-marker="${i+1}"`)+text(x+(x===cx?100:(x<cx?-90:90)),y+10,i+1);
  }
  body+=text(600,735,'Şema: aynı yüzey işareti Dünya’ya dönük',28);return {w:1200,h:780,body};
 }
 if(d.type==='lighting'){
  const [cx,cy]=d.center;let body=circle(...d.sun,75,'#E8B861')+text(d.sun[0],d.sun[1]+125,'Güneş',30)+circle(cx,cy,45,mint)+text(cx,cy+80,'Dünya',26);
  body+=`<circle cx="${cx}" cy="${cy}" r="190" fill="none" stroke="#BDB2DD" stroke-width="3" stroke-dasharray="9 9"/>`;
  for(const y of [285,350,415])body+=`<path d="M 230 ${y} L 390 ${y} M 370 ${y-12} L 390 ${y} L 370 ${y+12}" stroke="#AB791F" stroke-width="4" fill="none"/>`;
  for(const [label,[x,y]] of Object.entries(d.positions))body+=circle(x,y,38,ink)+half(x,y,38,d.illuminated_side)+circle(x,y,38,'none',`stroke="${purple}" stroke-width="2" data-position="${label}"`)+text(x+(label==='K'?-65:label==='M'?65:0),y+(label==='N'?-65:label==='L'?80:12),label);
  body+=text(600,680,'Ölçeksiz üstten görünüm · Yörünge eğimi gösterilmez',28);return {w:1200,h:730,body};
 }
 if(d.type==='sizes')return {w:1200,h:430,body:d.radii.map((r,i)=>circle([250,620,950][i],190,r,['#E8B861',mint,'#BDB2DD'][i],`data-size="${'ABC'[i]}"`)+text([250,620,950][i],345,'ABC'[i])).join('')};
 throw Error('unregistered diagram type');
}
const safe=relative=>{const dest=path.resolve(folder,relative);if(!dest.startsWith(folder+path.sep))throw Error('outside draft folder');return dest;};
const manifest=[];
for(const s of data.sources){
 if(!s.image)continue;
 const {body,w,h}=draw(s.diagram);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(s.title)}</title><desc>${esc(s.alt)}</desc><rect width="${w}" height="${h}" fill="${cream}"/>${body}</svg>\n`;
 const png=await sharp(Buffer.from(svg)).png().withIccProfile('srgb').toBuffer();
 await fs.writeFile(safe(s.svg),svg);await fs.writeFile(safe(s.image),png);
 manifest.push({id:s.id,svg:s.svg,png:s.image,width:w,height:h,color_space:'sRGB',alpha:false,minimum_reading_width:s.minimum_reading_width,sha256:createHash('sha256').update(png).digest('hex'),svg_sha256:createHash('sha256').update(svg).digest('hex'),origin:s.origin,geometry:s.diagram,review_status:'technical_checks_pending_editorial_pending'});
}
await fs.writeFile(path.join(folder,'assets/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const student={id:data.id,title:data.title,status:data.status,publishable:false,grade:data.grade,subject:data.subject,sources:data.sources.map(({id,title,body,image,alt,minimum_reading_width})=>({id,title,body,image,alt,minimum_reading_width})),questions:data.questions.map(({id,stem,source_id,response})=>({id,stem,source_id,response_mode:response.mode}))};
await fs.writeFile(path.join(folder,'student.json'),JSON.stringify(student,null,2)+'\n');
const css=`*{box-sizing:border-box}body{margin:0;background:#F7F4EF;color:${ink};font:18px/1.6 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:36px 24px}h1{font-size:34px;line-height:1.2}h2{font-size:23px}article{margin:24px 0;padding:28px;border:1px solid #E3DDEE;background:${cream};border-radius:22px;break-inside:avoid}header{padding-bottom:20px;border-bottom:2px solid #E3DDEE}.badge{color:${purple};font-size:14px;font-weight:700}.source{background:#F4F0FA;border-radius:16px;padding:18px}.diagram{overflow:auto}img{display:block;width:100%;height:auto;margin:12px 0}.answer{border-left:4px solid #218574;padding:14px 22px;background:#EAF5EF;margin-top:24px}.write{height:145px;margin-top:20px;border:1px solid #E3DDEE;border-radius:12px;background:repeating-linear-gradient(white,white 32px,#EBE5F2 33px)}p{white-space:pre-line}li{margin:8px 0}@media(max-width:600px){main{padding:22px 12px}article{padding:18px}h1{font-size:28px}}@media print{main{padding:0}article{border-radius:0}}`;
function html(teacher){return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${teacher?'Editör incelemesi':'Öğrenci önizlemesi'} · ${esc(data.title)}</title><style>${css}</style><main><header><div class="badge">GINA · ${data.grade}. SINIF ${esc(data.subject)} · YAYIMLANMAMIŞ TASLAK</div><h1>${esc(data.title)}</h1><p>Bu havuz tek oturumda çözülmesi gereken bir sınav değildir. Resmî okul sınavı veya yayımlanmış içerik değildir.</p><p>${teacher?'Cevap, program eşlemesi, Türkçe ve erişilebilirlik için alan editörü incelemesi bekleniyor. Teknik testler insan onayı değildir.':'Yanıtını yazarak veya etiketli çizimle anlatabilirsin. Şemalar ölçekli değildir; ekranı cetvelle ölçmen gerekmez.'}</p></header>${data.questions.map((q,i)=>{const s=student.sources.find(s=>s.id===q.source_id);return `<article id="${esc(q.id)}"><span class="badge">Soru ${i+1}${teacher?' · '+esc(q.curriculum.candidate_code):''}</span><h2>${teacher?'Soru ve değerlendirme':'Sıra sende'}</h2>${s?`<section class="source"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p>${s.image?`<div class="diagram"><a href="${esc(s.image)}" aria-label="Şemayı tam boy aç"><img src="${esc(s.image)}" alt="${esc(s.alt)}" style="min-width:${s.minimum_reading_width}px"></a></div><p class="badge">${s.minimum_reading_width?'Dar ekranda şemayı yatay kaydırabilirsin. ':''}Şemaya dokunarak tam boy açabilirsin.</p>`:''}</section>`:''}<p><strong>${esc(q.stem)}</strong></p>${teacher?`<section class="answer"><h3>Beklenen cevap</h3><p>${esc(q.expected_answer)}</p><h3>Çözüm yolu</h3><p>${esc(q.solution)}</p><h3>Puan ölçütleri · ${q.rubric.max_points} puan</h3><ul>${q.rubric.criteria.map(c=>`<li>${c.points} puan — ${esc(c.criterion)}</li>`).join('')}</ul><p>${esc(q.rubric.scoring)}</p><h3>Olası yanılgı</h3><p>${esc(q.common_misconception)}</p><h3>Sonraki adım</h3><p>${esc(q.next_step)}</p><p>${esc(q.response.accommodation)}</p><p class="badge">Kanıt birimi: ${esc(q.evidence_unit)} · Alan incelemesi bekliyor.</p></section>`:'<div class="write" aria-label="Yanıt alanı"></div>'}</article>`;}).join('')}</main></html>`;}
await fs.writeFile(path.join(folder,'student.html'),html(false));await fs.writeFile(path.join(folder,'review.html'),html(true));
console.log(`Rendered ${data.questions.length} unpublished questions; ${manifest.length} diagrams. No import or publication.`);
