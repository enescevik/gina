import {reconcileCommandSchema,reconcileJobSchema,type ReconcileCommand} from '@gina/core';
import {createLibraryQueue} from './library-review';
import {supabase} from './supabase';
export const reconcileQueue=(user:string)=>createLibraryQueue(user,'store-reconcile',v=>reconcileCommandSchema.parse(v));
export async function sendReconcile(c:ReconcileCommand){
 const {data,error}=await supabase().functions.invoke('iap-operator-reconcile',{body:{id:c.request,family:c.family,subscription:c.subscription,reason:c.reason},signal:AbortSignal.timeout(25000)});
 if(error){
  const response=(error as {context?:Response}).context;
  if(response instanceof Response){
   const body=await response.clone().json().catch(()=>null);
   const safe=['forbidden','invalid_input','subscription_not_found','request_conflict','reconcile_pending','reconcile_rate_limit'];
   if(typeof body?.error==='string'&&safe.includes(body.error))throw Object.assign(Error(body.error),{definitive:true});
  }
  throw Error('result_unconfirmed');
 }
 const job=reconcileJobSchema.parse(data?.job);
 if(job.id!==c.request||job.family_id!==c.family||job.subscription_id!==c.subscription||job.reason!==c.reason)throw Error('receipt_mismatch');
 return job;
}
export const reconcileStatus={queued:'Kontrol bekliyor',processing:'Mağazadan kontrol ediliyor',succeeded:'Doğrulandı ve kaydedildi',unchanged:'Değişiklik yapılmadı',failed:'Kontrol tamamlanamadı'};
export function reconcileExplanation(code:string|null){
 return code==='store_not_configured'?'Mağaza bağlantı ayarları eksik. Bağlantı kurulmadan doğrulama yapılamaz.':code==='no_data'?'Mağazadan uygulanabilir bir durum alınamadı. Mevcut hak korundu.':code==='stale'?'Kayıt zaten aynı veya daha yeni mağaza durumunu içeriyor.':code==='replaced'?'Bu satın alma daha yeni bir abonelikle değiştirilmiş; eski hak yeniden açılmadı.':code==='account_mismatch'?'Mağaza işlemi seçilen abonelikle eşleşmedi. Hak değiştirilmedi.':code==='interrupted'?'Önceki kontrol kesildi. Yeni bir kontrol isteği başlatabilirsiniz.':code?'Mağaza durumu doğrulanamadı. Bağlantıyı ve mağaza ayarlarını kontrol edip yeniden deneyin.':'Güncel mağaza durumu doğrulandı. Bu işlem ücret iadesi başlatmadı.';
}
