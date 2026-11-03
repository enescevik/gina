import {useEffect,useMemo,useRef,useState} from 'react';
import {reconcileCommandSchema,reconcileJobsSchema,type ReconcileCommand} from '@gina/core';
import {useAuth} from '@/lib/auth';
import {useSupportQuery} from '@/lib/use-support-query';
import {reconcileQueue,sendReconcile,reconcileStatus,reconcileExplanation} from '@/lib/reconcile-command';
import {supabase} from '@/lib/supabase';
import {fmtDateTime} from '@/lib/format';
import {Card,Notice} from './Layout';
export type ReconcileTarget={family:string;subscription:string;name:string;store:string};
export function ReconcileControl({target,close,done}:{target:ReconcileTarget|null;close:()=>void;done:()=>void}){
 const {session}=useAuth(),user=session?.user.id??'';
 const queue=useMemo(()=>reconcileQueue(user),[user]);
 const [pending,setPending]=useState<ReconcileCommand|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 const [busy,setBusy]=useState(false),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[tone,setTone]=useState<'ok'|'error'>('ok');
 const gate=useRef(false),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(target||pending){panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'start'});}},[target,pending]);
 useEffect(()=>{if(!user)return;let active=true;void queue.restore().then(c=>{if(active)setPending(c);}).catch(()=>{if(active)setStorageError(true);}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[queue,user]);
 async function submit(){
  if(gate.current||!ready||storageError)return;gate.current=true;setBusy(true);setMessage('');let c=pending;
  try{
   if(!c){if(!target)return;c=reconcileCommandSchema.parse({request:crypto.randomUUID(),family:target.family,subscription:target.subscription,reason});await queue.prepare(c);setPending(c);}
   const job=await sendReconcile(c);
   if(job.status==='queued'||job.status==='processing'){
    setTone('ok');setMessage('Kontrol sürüyor. Mevcut işlemin sonucunu aynı istekle yeniden kontrol edebilirsiniz.');
   }else{
    await queue.acknowledge(c.request);setPending(null);setReason('');close();setTone(job.status==='failed'?'error':'ok');setMessage(reconcileStatus[job.status]+'. '+reconcileExplanation(job.code));
   }
   done();
  }catch(error){
   const e=error as Error&{definitive?:boolean};
   if(e.definitive&&c){try{await queue.acknowledge(c.request);setPending(null);}catch{setStorageError(true);}}
   if(e.message.startsWith('library_'))setStorageError(true);
   setTone('error');setMessage(e.message==='reconcile_rate_limit'?'Bu abonelik için kontrol sınırına ulaşıldı. Bir saatlik pencerenin dolmasını bekleyin.':e.message==='reconcile_pending'?'Bu abonelik için başka bir kontrol sürüyor. Geçmişi yenileyin; kesilmiş kontrolün iki dakikalık süresi dolunca yeniden deneyebilirsiniz.':e.message==='forbidden'?'Bu işlem için güncel finans yetkiniz bulunmuyor.':e.definitive?'İstek kabul edilmedi. Seçilen aileyi, aboneliği ve gerekçeyi kontrol edin.':'Kayıt sonucu doğrulanamadı. Bekleyen aynı isteği tekrar kontrol edin.');
   done();
  }finally{gate.current=false;setBusy(false);}
 }
 return <>
 {message?<Notice tone={tone}>{message}</Notice>:null}
 {storageError?<Notice tone="error">Güvenli kayıt alanı açılamadı. İşleme devam etmeden önce sayfayı yenileyin.</Notice>:null}
 <div ref={panel} tabIndex={-1} aria-label="Mağaza kontrol işlemi">
 {pending?<Card title="Bekleyen mağaza kontrolü"><p className="mb-2">{pending.reason}</p><p className="mb-3 break-all text-sm text-slate-500">Aile: {pending.family}</p><p className="mb-4">Sonucu doğrulamadan yeni istek oluşturmayın. Kontrol kesilmişse aynı istek iki dakika sonra güvenle devam ettirilebilir.</p><button className="btn" disabled={busy||storageError} onClick={()=>void submit()}>{busy?'Kontrol ediliyor…':'Aynı kontrolün sonucunu getir'}</button></Card>:
 target?<Card title="Mağazadan kontrol et"><p className="mb-3"><strong>{target.name} · {target.store}</strong></p><p className="mb-4">Mağazanın güncel abonelik durumu doğrulanıp GINA erişimine uygulanacak. Ücret tahsil edilmez, iade veya abonelik iptali başlatılmaz.</p><form onSubmit={e=>{e.preventDefault();void submit();}}><label className="label" htmlFor="reconcile-reason">Kontrol gerekçesi</label><input id="reconcile-reason" className="input" required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy||!ready||storageError} placeholder="Örneğin: aile satın aldığı paketi göremiyor"/><div className="mt-4 flex flex-wrap gap-3"><button className="btn" disabled={busy||!ready||storageError}>Mağazadan doğrula</button><button className="btn-secondary" type="button" disabled={busy} onClick={close}>Vazgeç</button></div></form></Card>:null}
 </div>
 </>;
}
export function ReconcileHistory({family,refresh}:{family:string;refresh:number}){
 const result=useSupportQuery(async()=>{const {data,error}=await supabase().rpc('finance_reconcile_jobs',{p_family_id:family}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return reconcileJobsSchema.parse(data);},family+':'+refresh,'finance');
 return <section className="billing-section"><div className="billing-section-heading"><h3>Mağaza kontrol geçmişi</h3><button className="billing-text-link" onClick={result.reload}>Yenile</button></div>
 {result.error?<Notice tone="error">Kontrol geçmişi yenilenemedi. Görünen kayıtlar eski olabilir.</Notice>:null}
 {result.data?.length===0?<p className="billing-hint">Henüz yönetimden kontrol istenmemiş.</p>:null}
 {result.data?.map(j=><article className="billing-override" key={j.id}><div><strong>{reconcileStatus[j.status]}</strong><small>{fmtDateTime(j.created_at)}</small></div><p>{j.reason}</p><p className="billing-hint">{j.status==='queued'||j.status==='processing'?'Sonuç bekleniyor. Kesilen kontrol iki dakika sonra aynı işlemle sürdürülebilir.':reconcileExplanation(j.code)}</p></article>)}
 </section>;
}
