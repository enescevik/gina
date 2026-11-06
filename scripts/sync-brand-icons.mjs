// Technical derivatives of the existing approved mint mascot. No generative redraw.
import sharp from 'sharp';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const master = resolve(root, 'packages/assets/brand/apple-mint-delivery');
const out = resolve(root, 'packages/assets/brand/platform-mint');
await mkdir(out, { recursive: true });
const records=[];
async function save(name, buffer, source) {
  await writeFile(resolve(out,name),buffer);
  const m=await sharp(buffer).metadata();
  records.push({file:name,source,width:m.width,height:m.height,alpha:m.hasAlpha,colorSpace:m.space,sha256:createHash('sha256').update(buffer).digest('hex')});
}
for(const size of [32,48,180,192,512]) await save(`icon-${size}.png`,await sharp(resolve(master,'app-icon.png')).resize(size,size).png().toBuffer(),'apple-mint-delivery/app-icon.png');
const transparent={r:0,g:0,b:0,alpha:0};
for (const [name,src] of [['android-foreground.png','mascot-mark.png'],['android-monochrome.png','mascot-mark-mono.png']]) {
 const mark=await sharp(resolve(master,src)).trim().resize(620,620,{fit:'inside'}).png().toBuffer();
 await save(name,await sharp({create:{width:1024,height:1024,channels:4,background:transparent}}).composite([{input:mark,gravity:'centre'}]).png().toBuffer(),`apple-mint-delivery/${src}`);
}
await save('android-background.png',await sharp({create:{width:1024,height:1024,channels:3,background:'#6650CD'}}).png().toBuffer(),'apple-mint-delivery/manifest.json');
const white=await sharp(resolve(master,'mascot-mark-mono.png')).trim().resize(72,72,{fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<white.data.length;i+=4) white.data[i]=white.data[i+1]=white.data[i+2]=255;
const small=await sharp(white.data,{raw:white.info}).png().toBuffer();
await save('notification.png',await sharp({create:{width:96,height:96,channels:4,background:transparent}}).composite([{input:small,gravity:'centre'}]).png().toBuffer(),'apple-mint-delivery/mascot-mark-mono.png');
const mobile=resolve(root,'apps/mobile/assets/images');
for(const [from,to] of [['icon-48.png','favicon.png'],['android-foreground.png','android-icon-foreground.png'],['android-background.png','android-icon-background.png'],['android-monochrome.png','android-icon-monochrome.png'],['notification.png','notification-icon.png']]) await copyFile(resolve(out,from),resolve(mobile,to));
for(const [from,to] of [['app-icon.png','icon.png'],['app-icon-dark.png','icon-dark.png'],['app-icon-tinted.png','icon-tinted.png']]) await copyFile(resolve(master,from),resolve(mobile,to));
for(const [app,name,start] of [['mobile','GINA','/'],['backoffice','GINA Yönetim','/sign-in']]) {
 const pub=resolve(root,`apps/${app}/public`);await mkdir(resolve(pub,'brand'),{recursive:true});
 for(const size of [32,48,180,192,512]) await copyFile(resolve(out,`icon-${size}.png`),resolve(pub,`brand/icon-${size}.png`));
 await writeFile(resolve(pub,'site.webmanifest'),JSON.stringify({id:'/',name,short_name:'GINA',start_url:start,scope:'/',display:'standalone',background_color:'#FCFAF6',theme_color:'#6650CD',icons:[192,512].map(s=>({src:`/brand/icon-${s}.png`,sizes:`${s}x${s}`,type:'image/png',purpose:'any'}))},null,2)+'\n');
}
await writeFile(resolve(out,'manifest.json'),JSON.stringify({source:'../apple-mint-delivery/manifest.json',method:'Deterministic resizing and transparent padding of existing raster sources; no new artwork or claimed vector source.',androidSafeArea:'620px content inside 1024px canvas',assets:records},null,2)+'\n');
console.log(`Synced ${records.length} approved-icon derivatives to mobile and web surfaces.`);
