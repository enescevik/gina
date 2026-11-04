/** Original instructional diagrams. No external art, application controls or AI images. */
export function drawScience6(d,{text,ink,purple,mint,circle}) {
 if(d.type==='science6_planets'){
  let body='';
  const rows=[['Sıra / gezegen','Yapı','Halka'],...d.rows.map((r,i)=>[`${i+1}. ${r[0]}`,r[1],r[2]])];
  rows.forEach((row,i)=>{
   const y=20+i*70;body+=`<rect x="15" y="${y}" width="610" height="66" rx="12" fill="${i===0?'#EBE5FA':i%2?'#F2F8F4':'#FFFFFF'}"/>`;
   row.forEach((v,j)=>{body+=text([190,415,555][j],y+44,v,i===0?30:32);});
  });return {w:640,h:665,body};
 }
 if(d.type==='science6_eclipses'){
  let body='';d.rows.forEach((row,i)=>{
   const y=190+i*290;body+=text(70,y+8,d.labels[i],40);
   row.forEach((label,j)=>{
    const x=[230,500,770][j],r=label==='Güneş'?62:label==='Dünya'?43:24;
    body+=circle(x,y,r,label==='Güneş'?'#E8B861':label==='Dünya'?mint:'#BDB2DD',`data-row="${d.labels[i]}" data-body="${label}"`)+text(x,y+110,label,34);
   });
   body+=`<path data-light="${d.labels[i]}" d="M 325 ${y} H 405 M 389 ${y-10} L 405 ${y} L 389 ${y+10}" fill="none" stroke="${ink}" stroke-width="4"/>`;
  });body+=text(460,660,'Yalnız sıralama modeli · Ölçekli değildir',27);return {w:920,h:700,body};
 }
 if(d.type==='science6_forces'){
  let body=text(110,42,'Batı ←',30)+text(790,42,'→ Doğu',30);
  d.rows.forEach((row,i)=>{
   const cy=130+i*185;body+=text(65,cy+28,row.label,40)+`<rect x="380" y="${cy-27}" width="140" height="110" rx="16" fill="#EBE5FA" stroke="${purple}" stroke-width="3"/>`;
   row.forces.forEach((n,j)=>{
    const x=450,y=cy+j*50,end=x+n*38,head=end-Math.sign(n)*16;
    body+=`<path data-force="${row.label}-${j}" data-newtons="${n}" d="M ${x} ${y} L ${end} ${y} M ${head} ${y-10} L ${end} ${y} L ${head} ${y+10}" fill="none" stroke="${j?ink:purple}" stroke-width="5"/>`+text(n>0?end+54:end-54,y+10,`${Math.abs(n)} N`,32);
   });
  });body+=text(450,660,'Oklar okunabilirlik için aralıklı gösterilmiştir.',25);return {w:900,h:700,body};
 }
 if(d.type==='science6_routes'){
  let body='';d.paths.forEach((p,i)=>{
   const points=p.map(k=>d.points[k]);const path=points.map(([x,y],j)=>`${j?'L':'M'} ${x} ${y}`).join(' ');
   body+=`<path data-route="${i===0?'purple':'mint'}" d="${path}" fill="none" stroke="${i===0?purple:mint}" stroke-width="9"/>`;
  });
  for(const [label,[x,y]] of Object.entries(d.points))body+=circle(x,y,11,ink,`data-point="${label}"`)+text(x+(x<400?-42:42),y+10,label,38);
  body+=text(430,81,'Mint: A–C–D–B',32)+text(430,365,'Mor: A–B',32)+text(430,490,'Aynı başlangıç ve bitiş · Eşit toplam süre',27);
  return {w:860,h:530,body};
 }
 return null;
}
