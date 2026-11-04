/** Instructional data labels, not application controls. Original fixed diagrams. */
export function drawMath6(d,{text,ink,purple,mint,circle}) {
 if(d.type==='value_table'){
  let body='';
  [d.headers,...d.rows].forEach((row,i)=>{
   const y=30+i*105;
   body+=`<rect x="20" y="${y}" width="560" height="100" rx="16" fill="${i===0?'#EBE5FA':i%2?'#F2F8F4':'#FFFFFF'}"/>`;
   row.forEach((v,j)=>{body+=text(155+j*290,y+63,v,i===0?30:42);});
  });return {w:600,h:470,body};
 }
 if(d.type==='route_lengths'){
  let body=`<path d="M 120 300 L 470 130 L 870 300" fill="none" stroke="${purple}" stroke-width="9"/><path d="M 120 300 Q 490 640 870 300" fill="none" stroke="${mint}" stroke-width="9"/>`;
  for(const [x,y,label] of [[120,300,'Başlangıç'],[470,130,'Köprü'],[870,300,'Bitiş']])body+=circle(x,y,12,ink)+text(x,y-35,label,30);
  body+=text(270,170,'1,2 km',38)+text(700,165,'350 m',38)+text(490,420,'1,6 km',38)+text(500,550,'Ölçeksiz şema · Uzunluklar etiketlerde',26);
  return {w:1000,h:600,body};
 }
 if(d.type==='frequency_dots'){
  let body=`<path d="M 50 410 H 650" stroke="${ink}" stroke-width="3" fill="none"/>`;
  d.values.forEach((value,i)=>{
   const x=100+i*160;
   body+=text(x,457,value,38);
   for(let level=0;level<d.frequencies[i];level++)body+=circle(x,370-level*65,21,purple,`data-value="${value}" data-level="${level}"`);
  });body+=text(350,520,d.x_label,38)+text(350,65,'Her nokta bir kişi',34);
  return {w:700,h:560,body};
 }
 return null;
}
