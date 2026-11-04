/** Original instructional graphics. No borrowed illustration or embedded raster. */
export function drawTurkish5(d,{text,ink,purple,mint,circle}) {
 const frame=(x,y,w,h,fill='#F1EBFA')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${fill}" stroke="${purple}" stroke-width="3"/>`;
 if(d.type==='turkish5_poster') {
  let body=frame(20,20,560,710)+text(300,94,d.title,32);
  body+=`<g data-symbol="dice">${frame(100,150,160,160,'#FFFFFF')}${[[140,190],[220,190],[180,230],[140,270],[220,270]].map(([x,y])=>circle(x,y,10,purple)).join('')}</g>`;
  body+=`<g data-symbol="puzzle"><path d="M 330 150 H 400 V 190 C 440 170 440 230 400 210 V 250 H 330 Z" fill="${mint}" stroke="${ink}" stroke-width="3"/><path d="M 400 150 H 470 V 250 H 400 V 210 C 440 230 440 170 400 190 Z" fill="#D9CEF4" stroke="${ink}" stroke-width="3"/></g>`;
  body+=text(300,395,d.day,42)+text(300,450,d.time,46)+text(300,530,d.place,36)+text(300,628,d.message,30);
  return {w:600,h:750,body};
 }
 if(d.type==='turkish5_sequence') {
  let body='';
  const shape=(name,x,y,panel,position)=>{
   const a=`data-panel="${panel}" data-piece="${name}" data-position="${position}"`;
   if(name==='square')return `<rect ${a} x="${x-30}" y="${y-30}" width="60" height="60" fill="${mint}" stroke="${ink}" stroke-width="3"/>`;
   if(name==='triangle')return `<path ${a} d="M ${x} ${y-34} L ${x+34} ${y+30} H ${x-34} Z" fill="#D9CEF4" stroke="${ink}" stroke-width="3"/>`;
   if(name==='circle')return circle(x,y,30,'#EAC580',`${a} stroke="${ink}" stroke-width="3"`);
   throw Error('unknown piece');
  };
  for(const [i,p] of d.panels.entries()) {
   const top=20+i*340,y=top+170;
   body+=frame(20,top,560,300,'#FFFFFF')+text(65,top+53,p.label,34);
   body+=`<g data-box="${p.label}" data-lid="${p.lid}"><rect x="130" y="${y-75}" width="300" height="150" rx="8" fill="#F2D9B5" stroke="${ink}" stroke-width="4"/>`;
   if(p.lid==='open') {
    body+=`<path d="M 130 ${y-75} L 150 ${y-115} H 410 L 430 ${y-75} Z" fill="#F9E7CF" stroke="${ink}" stroke-width="3"/>`;
    for(const [j,n] of p.inside.entries())body+=shape(n,[185,280,375][j],y,p.label,'inside');
    for(const n of p.outside)body+=shape(n,505,y,p.label,'outside');
   } else body+=`<path d="M 130 ${y-55} H 430" stroke="${ink}" stroke-width="3"/>`;
   body+='</g>';
   if(i<2)body+=`<path data-next="${p.label}" d="M 300 ${top+308} V ${top+330} M 289 ${top+319} L 300 ${top+330} L 311 ${top+319}" fill="none" stroke="${purple}" stroke-width="4"/>`;
  }
  return {w:600,h:1040,body};
 }
 return null;
}
