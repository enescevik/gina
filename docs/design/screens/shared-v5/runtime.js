export const A='/packages/assets/';
export const G=A+'gamification/illustrated-v3/';
export const R=A+'rooms/v2/';
export const S='/docs/design/screens/shared-v5/';
export const art=(src,cls='art-icon',alt='')=>`<img class="${cls}" src="${src}" alt="${alt}" draggable="false">`;
export const task=(slug)=>art(A+'icons/tasks/illustrated-v3/'+slug+'.webp');
export const subject=(slug)=>art(A+'icons/subjects/illustrated-v3/'+slug+'.webp');
export const event=(slug)=>art(A+'icons/events/illustrated-v3/'+slug+'.webp');
export const avatar=(who='girl')=>art(A+'avatars/illustrated-v3/avatar-reference-'+who+'.webp','avatar');
export const award=(slug,cls='large-art')=>art(G+slug+'.webp',cls);
export const btn=(text,variant='',disabled=false)=>`<button type="button" class="button ${variant}" ${disabled?'disabled':''}>${text}</button>`;
export const link=(text,id,variant='ghost')=>`<a class="button ${variant}" href="?screen=${id}&device=${new URLSearchParams(location.search).get('device')||'phone'}">${text}</a>`;
export const tag=(text,cls='')=>`<span class="badge ${cls}">${text}</span>`;
export const card=(body,tone='')=>`<section class="paper ${tone}">${body}</section>`;
export const stack=(...content)=>`<div class="stack">${content.join('')}</div>`;
export const row=(image,title,sub='',right='')=>`<div class="row">${image}<div class="grow"><p><strong>${title}</strong></p>${sub?`<small>${sub}</small>`:''}</div>${right}</div>`;
export const tabs=(names,active=0)=>`<div class="tabs">${names.map((n,i)=>{const on=Array.isArray(active)?active.includes(i):i===active;return `<button type="button" class="tab ${on?'active':''}" aria-pressed="${on}" aria-label="${n.replace(/<[^>]*>/g,'').trim()||('Görünüm '+(i+1))}">${n}</button>`}).join('')}</div>`;
export const kids=(all=false)=>tabs([...(all?['Tümü']:[]),avatar('girl')+'Ece',avatar('boy')+'Can'],all?0:0);
let nextField=0;
export const field=(label,value='',type='text',hint='')=>{const id='f-'+nextField++;return `<label class="field" for="${id}">${label}${type==='textarea'?`<textarea id="${id}" spellcheck="false">${value}</textarea>`:`<input id="${id}" type="${type}" value="${value}" ${type==='password'?'maxlength="4"':''} autocomplete="off">`}${hint?`<small>${hint}</small>`:''}</label>`};
export const select=(label,values)=>{const id='f-'+nextField++;return `<label class="field" for="${id}">${label}<select id="${id}">${values.map(v=>`<option>${v}</option>`).join('')}</select></label>`};
export const title=(t,more='')=>`<div class="section-title"><h2>${t}</h2>${more}</div>`;
export const hint=t=>`<p class="hint">${t}</p>`;
export const toggle=(label,on=true,sub='')=>`<div class="toggle"><div><strong>${label}</strong>${sub?`<small>${sub}</small>`:''}</div><button type="button" aria-label="${label}" aria-pressed="${on}" class="switch ${on?'':'off'}"></button></div>`;
export const progress=(n)=>`<div class="progress" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="100"><span style="width:${n}%"></span></div>`;
export const actions=(...x)=>`<div class="actions">${x.join('')}</div>`;
export const columns=(a,b)=>`<div class="tablet-columns">${a}${b}</div>`;
export const grid=(...items)=>`<div class="grid2">${items.join('')}</div>`;
export const empty=(label,desc,icon='display-bookworm',action='')=>`<div class="empty">${award(icon)}<h2>${label}</h2>${hint(desc)}${action}</div>`;
export function error(label='Bağlantı kurulamadı',desc='Bilgilerin güvende. Bağlantını kontrol edip yeniden deneyebilirsin.'){return `<div class="empty">${award('loading/loading-star-static')}<h2>${label}</h2>${hint(desc)}${btn('Yeniden dene')}</div>`}
export const loading=(label='Yükleniyor…')=>`<div aria-busy="true"><p class="loading-label">${label}</p>${[1,2,3].map(()=>card('<div class="skeleton short"></div><div class="skeleton"></div>')).join('<div style="height:12px"></div>')}</div>`;
export const fields=(...f)=>stack(...f);
export function render(group,screens){
 const q=new URLSearchParams(location.search),id=q.get('screen')||screens[0].id,state=q.get('state')||'normal',device=group==='child'&&q.get('device')==='tablet'?'tablet':'phone';
 const s=screens.find(x=>x.id===id)||screens[0],ctx={state,device,blank:state==='empty'};
 const value=(v)=>typeof v==='function'?v(ctx):v;
 let content=state==='normal'?value(s.body):s.states?.[state]?value(s.states[state]):state==='empty'?empty(s.emptyTitle||'Henüz bir kayıt yok',s.emptyText||'Hazır olduğunda burada görünecek.'):state==='loading'?loading():error();
 const plate=s.kind==='desk'?'desk':s.kind==='shelf'&&state==='normal'?'collection':'board';
 const child=group==='child';
 const frame=document.getElementById('frame');frame.className=`${device} ${child?'child':'parent'} ${s.kind||'board'} ${state!=='normal'?'state-view':''}`;
 if(s.kind==='shelf'&&state!=='normal')frame.classList.remove('shelf');
 frame.innerHTML=`${child?`<img class="scene ${s.kind==='home'?'home-room':''}" src="${s.kind==='home'?'/docs/design/screens/child/art-direction-v5/room-day.png':S+'art/'+plate+'-tablet.png'}" alt="">`:''}<div class="statusbar"><span>9:41</span><span class="signal" aria-label="Sinyal ve pil">▮▮▮ ▰</span></div><header class="head ${s.kind==='home'?'home-header':''}">${!child?art(S+'art/parent-header.png','header-art'):''}<div class="topbar"><button class="back" aria-label="Geri" type="button">‹</button><span class="chip">${child?art(G+'stars/star-filled.webp')+'12':s.tag||'Gina Aile'}</span></div><div class="eyebrow">${child?'Ece’nin dünyası':s.eyebrow||'Birlikte büyüyoruz'}</div><h1>${s.title}</h1>${s.subtitle?`<p class="subtitle">${s.subtitle}</p>`:''}</header><main class="body ${s.kind==='home'?'home-body':''}" tabindex="0">${content}<div class="page-end"></div></main><div class="safe-bottom"></div>`;
 if(!child){const head=frame.querySelector('.head');frame.querySelector('.body').style.height=`${844-42-head.offsetHeight-26}px`;}
 document.title=`${s.title} · ${state} · Gina v5 tasarım`;
 window.design={group,screen:id,state,device,route:s.route,screens:screens.map(({id,title,route,variants=[]})=>({id,title,route,variants})),isMockup:true};
 window.ready=Promise.all([document.fonts.ready,...[...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r}))]);
 document.querySelector('.back').addEventListener('click',()=>history.length>1?history.back():location.assign('index.html'));
}
