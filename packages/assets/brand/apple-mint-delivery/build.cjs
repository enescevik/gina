const sharp=require('sharp'),fs=require('fs'),path=require('path');
const D=__dirname;
(async()=>{
const {data,info}=await sharp(path.join(D,'references/imagegen-master.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
const palette=[[100,76,207],[76,192,171],[249,249,239],[44,38,74]];
const rgba=Buffer.alloc(info.width*info.height*4),mono=Buffer.alloc(rgba.length),tint=Buffer.alloc(rgba.length);
for(let p=0;p<info.width*info.height;p++){
 const c=[data[p*3],data[p*3+1],data[p*3+2]];
 let k=0,best=1e9;for(let j=0;j<4;j++){const dist=c.reduce((s,v,i)=>s+(v-palette[j][i])**2,0);if(dist<best){best=dist;k=j;}}
 // Quantization removes generated texture; all derivatives share this exact raster mask.
 const a=k?255:0;for(let j=0;j<3;j++){rgba[p*4+j]=palette[k][j];mono[p*4+j]=palette[3][j];tint[p*4+j]=k===1?190:k===2?245:35;}rgba[p*4+3]=a;mono[p*4+3]=a;tint[p*4+3]=a;
}
// Retain only exterior transparency; color-transition pixels inside the face are not cutouts.
const seen=new Uint8Array(info.width*info.height),queue=new Int32Array(seen.length);let head=0,tail=0;queue[tail++]=0;seen[0]=1;
while(head<tail){let p=queue[head++],x=p%info.width,y=Math.floor(p/info.width);for(const q of [x>0?p-1:-1,x<info.width-1?p+1:-1,y>0?p-info.width:-1,y<info.height-1?p+info.width:-1])if(q>=0&&!seen[q]&&rgba[q*4+3]===0){seen[q]=1;queue[tail++]=q;}}
for(let p=0;p<seen.length;p++)if(!seen[p]&&rgba[p*4+3]===0){rgba[p*4+3]=mono[p*4+3]=tint[p*4+3]=255;for(let j=0;j<3;j++){rgba[p*4+j]=palette[3][j];tint[p*4+j]=35;}}
const raw={width:info.width,height:info.height,channels:4};
const mark=await sharp(rgba,{raw}).resize(2048,2048).withIccProfile('srgb').png().toBuffer();
await sharp(mark).withIccProfile('srgb').toFile(path.join(D,'mascot-mark.png'));
await sharp(mono,{raw}).resize(2048,2048).withIccProfile('srgb').png().toFile(path.join(D,'mascot-mark-mono.png'));
for(const [name,bg] of [['app-icon.png','#6650CD'],['app-icon-dark.png','#211B38']]) await sharp(mark).resize(1024,1024).flatten({background:bg}).removeAlpha().withIccProfile('srgb').png().toFile(path.join(D,name));
await sharp(tint,{raw}).resize(1024,1024).flatten({background:'#181818'}).removeAlpha().withIccProfile('srgb').png().toFile(path.join(D,'app-icon-tinted.png'));
await sharp(path.join(D,'references/approved-board.png')).extract({left:79,top:735,width:225,height:218}).resize(450,436).png().toFile(path.join(D,'references/approved-icon-crop.png'));
const tiles=[['references/approved-icon-crop.png','Onaylı kaynak · panodan kırpım'],['app-icon.png','Açık · 1024 × 1024'],['app-icon-dark.png','Koyu · teknik uyarlama'],['mascot-mark.png','Şeffaf maskot · 2048 × 2048'],['mascot-mark-mono.png','Tek renk siluet · 2048 × 2048'],['app-icon-tinted.png','Tinted · gri ton teknik uyarlama']];
const layers=[];for(let i=0;i<tiles.length;i++){let x=40+(i%3)*500,y=100+Math.floor(i/3)*540;layers.push({input:await sharp(path.join(D,tiles[i][0])).resize(450,450,{fit:'contain',background:'#EEECE7'}).flatten({background:'#EEECE7'}).png().toBuffer(),left:x,top:y});}
const texts=tiles.map((v,i)=>`<text x="${40+(i%3)*500}" y="${580+Math.floor(i/3)*540}" font-size="23">${v[1]}</text>`).join('');
const svg=Buffer.from(`<svg width="1540" height="1220"><g font-family="Arial" fill="#29233F"><text x="40" y="54" font-size="32">GINA · Apple ikon teslimi / kaynak karşılaştırması</text>${texts}<text x="40" y="1185" font-size="21">Raster yeniden üretim: küçük kontur farkları vardır. Köşeler yalnız iOS tarafından maskelenir.</text></g></svg>`);
layers.push({input:svg,left:0,top:0});await sharp({create:{width:1540,height:1220,channels:3,background:'#FAF9F6'}}).composite(layers).withIccProfile('srgb').png().toFile(path.join(D,'contact-sheet.png'));
const assets=[];for(const name of ['app-icon.png','app-icon-dark.png','app-icon-tinted.png','mascot-mark.png','mascot-mark-mono.png','contact-sheet.png']){const m=await sharp(path.join(D,name)).metadata();assets.push({file:name,width:m.width,height:m.height,alpha:m.hasAlpha,color_space:m.space,icc_profile:!!m.icc});}console.log(JSON.stringify(assets,null,2));fs.writeFileSync(path.join(D,'technical-validation.json'),JSON.stringify(assets,null,2));
})();
