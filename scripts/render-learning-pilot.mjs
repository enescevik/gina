import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/learning/library-pilot/grade-5-math');
const data = JSON.parse(await fs.readFile(path.join(folder, 'pilot.json'), 'utf8'));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const ink = '#201951', purple = '#6442DA', mint = '#218574';
const line = (x1,y1,x2,y2,color=ink,width=4) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const text = (x,y,s,color=ink,size=42,anchor='middle') => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" stroke="#FFFDF8" stroke-width="6" paint-order="stroke fill" font-size="${size}" text-anchor="${anchor}">${esc(s)}</text>`;
const dot = (x,y) => `<circle cx="${x}" cy="${y}" r="6" fill="${ink}"/>`;
const poly = (points,closed=true,color=purple) => `<${closed?'polygon':'polyline'} points="${points.map(p=>p.join(',')).join(' ')}" fill="${closed?'#F0EBFA':'none'}" stroke="${color}" stroke-width="4" stroke-linejoin="round"/>`;
const circle=(x,y,r,color=purple)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="4"/>`;
const arrow=(x,y,angle,color=ink)=>{const a=angle*Math.PI/180; const pts=[[x,y],[x-20*Math.cos(a)+9*Math.sin(a),y-20*Math.sin(a)-9*Math.cos(a)],[x-20*Math.cos(a)-9*Math.sin(a),y-20*Math.sin(a)+9*Math.cos(a)]];return `<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${color}"/>`;};
const point=(cx,cy,r,deg)=>[cx+r*Math.cos(deg*Math.PI/180),cy-r*Math.sin(deg*Math.PI/180)];
function draw(d) {
 let s='';
 if(d.type==='segments'){
  s+=line(170,280,500,280)+dot(170,280)+dot(500,280)+text(170,245,'A')+text(500,245,'B');
  s+=line(660,280,1070,280)+dot(660,280)+dot(900,280)+arrow(1070,280,0)+text(660,245,'C')+text(900,245,'D');
  return {body:s,w:1200,h:430};
 }
 if(d.type==='protractor'){
  const cx=600,cy=560,r=450; let labels="";
  s+=`<path d="M 150 560 A 450 450 0 0 1 1050 560" fill="none" stroke="#B8ACC9" stroke-width="3"/>`;
  for(let a=0;a<=180;a+=5){const p=point(cx,cy,r,a),q=point(cx,cy,r-(a%10===0?22:12),a);s+=line(...p,...q,'#766B8B',2);if(a%10===0){const n=point(cx,cy,405,a),m=point(cx,cy,350,a);labels+=text(n[0],n[1]+7,180-a,ink,28)+text(m[0],m[1]+7,a,purple,28);}}
  const b=point(cx,cy,480,d.angle);
  s+=line(130,cy,1080,cy,'#766B8B',2)+'<g id="angle-rays">'+line(cx,cy,1100,cy,purple,5)+line(cx,cy,...b,purple,5)+'</g>'+arrow(1100,cy,0,purple)+arrow(...b,-d.angle,purple)+dot(cx,cy)+labels;
  s+=text(cx-20,cy+43,'O')+text(1125,cy+10,'A')+text(b[0]+18,b[1]-18,'B')+text(600,670,'İç dizi: mor sayılar · Dış dizi: koyu sayılar',ink,25);
  return {body:s,w:1200,h:720};
 }
 if(d.type==='crossing'){
  const cx=600,cy=360,a=180-d.angle,c=point(cx,cy,270,a),e=point(cx,cy,270,a+180);
  s+=line(160,cy,1040,cy)+arrow(160,cy,180)+arrow(1040,cy,0)+line(...c,...e)+arrow(...c,-a)+arrow(...e,-a-180)+dot(cx,cy);
  for(const [x,y,label] of [[210,cy+42,'A'],[990,cy+42,'B'],[c[0]-28,c[1]-12,'C'],[e[0]+28,e[1]+30,'D'],[cx+20,cy+55,'O']]) s+=text(x,y,label);
  const p=point(cx,cy,105,180),q=point(cx,cy,105,a);
  s+=`<path d="M ${p[0]} ${p[1]} A 105 105 0 0 1 ${q[0]} ${q[1]}" fill="none" stroke="${purple}" stroke-width="3"/>`;
  const label=point(cx,cy,150,180-d.angle/2);s+=text(label[0],label[1],`${d.angle}°`,purple,32);
  return {body:s,w:1200,h:720};
 }
 if(d.type==='polygons'){
  s+=poly([[100,280],[100,120],[400,120],[400,280]],false)+text(250,335,'A');
  s+=poly([[710,280],[910,90],[1080,280]])+text(900,335,'B');
  s+=circle(250,555,130)+text(250,740,'C');
  s+=poly([[900,410],[1060,515],[1000,680],[800,680],[740,515]])+text(900,740,'D');
  return {body:s,w:1200,h:800};
 }
 if(d.type==='rectangles'){
  const scale=65, h=d.square_side*scale, left=90, top=220, right=600, rh=d.rectangle_height*scale, rw=d.rectangle_width*scale;
  s+=poly([[left,top],[left+h,top],[left+h,top+h],[left,top+h]])+poly([[right,top],[right+rw,top],[right+rw,top+rh],[right,top+rh]]);
  for(const [x,y,label] of [[left-20,top-20,'A'],[left+h+20,top-20,'B'],[left+h+20,top+h+36,'C'],[left-20,top+h+36,'D'],[right-20,top-20,'E'],[right+rw+20,top-20,'F'],[right+rw+20,top+rh+36,'G'],[right-20,top+rh+36,'H']])s+=text(x,y,label);
  s+=text(left+h/2,top-30,d.square_side)+text(left+h/2,top+h+45,d.square_side)+text(left-38,top+h/2,d.square_side)+text(left+h+38,top+h/2,d.square_side);
  s+=text(right+rw/2,top-30,d.rectangle_width)+text(right+rw/2,top+rh+45,d.rectangle_width)+text(right-38,top+rh/2,d.rectangle_height)+text(right+rw+38,top+rh/2,d.rectangle_height);
  s+=text(600,640,'Her iki modelin bütün iç açıları 90°.',ink,30);
  return {body:s,w:1200,h:720};
 }
 if(d.type==='circles'){
  const ra=d.radius_a,rb=d.radius_b,dist=d.distance,scale=Math.min(1000/(ra+dist+rb),560/(2*Math.max(ra,rb)));
  const ax=(1200-(ra+dist+rb)*scale)/2+ra*scale,bx=ax+dist*scale,cy=410;
  const along=(ra*ra-rb*rb+dist*dist)/(2*dist),rise=Math.sqrt(ra*ra-along*along),x=ax+along*scale,y=cy-rise*scale;
  s+=circle(ax,cy,ra*scale,purple)+circle(bx,cy,rb*scale,mint)+`<polyline id="triangle" points="${ax},${cy} ${bx},${cy} ${x},${y} ${ax},${cy}" fill="none" stroke="${ink}" stroke-width="4"/>`;
  for(const [px,py,label,dy] of [[ax,cy,'A',55],[bx,cy,'B',55],[x,y,'C',-20],[x,cy+rise*scale,'D',55]])s+=dot(px,py)+text(px,py+dy,label);
  s+=text((ax+bx)/2,cy+55,dist,ink,42)+text(600,55,`A çemberi: r = ${ra} birim     B çemberi: r = ${rb} birim`,ink,40);
  return {body:s,w:1200,h:820};
 }
 throw new Error('unknown diagram');
}
const manifest=[];
for(const source of data.sources){
 const {body,w,h}=draw(source.diagram);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(source.title)}</title><desc>${esc(source.alt)}</desc><rect width="${w}" height="${h}" fill="#FFFDF8"/>${body}</svg>`;
 await fs.writeFile(path.join(folder,source.svg),svg+'\n');
 const png=await sharp(Buffer.from(svg)).png().withIccProfile('srgb').toBuffer();
 await fs.writeFile(path.join(folder,source.image),png);
 manifest.push({id:source.id,svg:source.svg,png:source.image,width:w,height:h,color_space:'sRGB',alpha:false,minimum_reading_width:source.minimum_reading_width,sha256:createHash('sha256').update(png).digest('hex'),svg_sha256:createHash('sha256').update(svg+'\n').digest('hex'),origin:source.origin,geometry:source.diagram,review_status:'technical_checks_passed_editorial_pending'});
}
await fs.writeFile(path.join(folder,'assets/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
// Deliberately separate student projection from teacher-only answer/rubric data.
const student={id:data.id,title:data.title,status:data.status,publishable:false,grade:data.grade,subject:data.subject,sources:data.sources.map(({id,title,body,image,alt,minimum_reading_width})=>({id,title,body,image,alt,minimum_reading_width})),questions:data.questions.map(({id,stem,source_id,response})=>({id,stem,source_id,response_mode:response.mode}))};
await fs.writeFile(path.join(folder,'student.json'),JSON.stringify(student,null,2)+'\n');
const style=`*{box-sizing:border-box}body{margin:0;background:#F7F4EF;color:${ink};font:18px/1.65 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.2}h2{font-size:24px;margin-top:0}.intro{border-bottom:2px solid #DDD3F3;padding-bottom:24px}article{background:#FFFDF8;border:1px solid #E4DCEE;border-radius:24px;padding:28px;margin:28px 0;break-inside:avoid}.badge{font-size:14px;color:#6442DA;font-weight:700}img{display:block;width:100%;max-height:520px;object-fit:contain;margin:20px auto}.diagram{overflow-x:auto}.diagram img{max-height:none}p{white-space:pre-line}.answer{border-left:4px solid #218574;padding:4px 20px;background:#EAF5EF;margin-top:24px}li{margin:10px 0}.write{height:140px;border:1px solid #E4DCEE;border-radius:12px;background:repeating-linear-gradient(white,white 33px,#EEE8F5 34px)}@media(max-width:600px){main{padding:24px 12px}article{padding:18px}h1{font-size:28px}body{font-size:17px}}@media print{body{background:white}main{padding:0}article{break-inside:avoid;border-radius:0}a{color:inherit}}`;
function page(teacher){
 const cards=data.questions.map((q,i)=>{const s=student.sources.find(s=>s.id===q.source_id);return `<article id="${esc(q.id)}"><div class="badge">Soru ${i+1} · ${teacher?esc(q.curriculum.candidate_code)+' · '+esc(q.difficulty):'Geometri atölyesi'}</div><h2>${teacher?'Soru ve değerlendirme':'Sıra sende'}</h2>${s?`<h3>${esc(s.title)}</h3><p>${esc(s.body)}</p><div class="diagram"><a href="${esc(s.image)}" aria-label="Şekli tam boy aç"><img style="min-width:${s.minimum_reading_width}px" src="${esc(s.image)}" alt="${esc(s.alt)}"/></a></div><p class="badge">${s.minimum_reading_width?'Dar ekranda şekli yatay kaydırabilirsin. ':''}Şekle dokunarak tam boy açabilirsin.</p>`:''}<p><strong>${esc(q.stem)}</strong></p>${teacher?`<section class="answer"><h3>Beklenen cevap</h3><p>${esc(q.expected_answer)}</p><h3>Çözüm yolu</h3><p>${esc(q.solution)}</p><h3>Puan ölçütleri · ${q.rubric.max_points} puan</h3><ul>${q.rubric.criteria.map(c=>`<li>${c.points} puan — ${esc(c.criterion)}</li>`).join('')}</ul><p>${esc(q.rubric.scoring)}</p><h3>Bir sonraki adım</h3><p>${esc(q.next_step)}</p><p><strong>Olası yanılgı:</strong> ${esc(q.common_misconception)}</p><p><strong>Kabul edilen yanıt:</strong> ${esc(q.response.accommodation)}</p><p><strong>Kanıt birimi:</strong> ${esc(q.evidence_unit)} · Editoryal inceleme bekliyor.</p></section>`:'<div class="write" aria-label="Yanıt alanı"></div>'}</article>`;}).join('');
 return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${teacher?'İnceleme':'Öğrenci'} · GINA geometri pilotu</title><style>${style}</style><main><header class="intro"><span class="badge">GINA · 5. SINIF MATEMATİK · YAYIMLANMAMIŞ TASLAK</span><h1>${teacher?'20 soru · cevap ve puanlama incelemesi':'Geometri atölyesi'}</h1><p>Bu bir soru havuzudur; tek oturumda tamamlanması gereken sınav değildir. Resmî okul sınavı veya onaylanmış içerik olarak kullanılmaz.</p><p>${teacher?'Ortak görselli sorular birbirinden tamamen bağımsız öğrenme kanıtları sayılmaz. Program, cevap, dil ve erişilebilirlik incelemesi bekliyor.':'Şekillerin üzerindeki bilgileri kullan. Ekranı cetvelle ölçmen gerekmez. Yanıtını yazarak veya anlamı açık bir çizimle anlatabilirsin.'}</p></header>${cards}</main></html>`;
}
await fs.writeFile(path.join(folder,'student.html'),page(false));
await fs.writeFile(path.join(folder,'review.html'),page(true));
console.log(`Rendered ${data.questions.length} questions and ${manifest.length} diagrams. No import or publication.`);
