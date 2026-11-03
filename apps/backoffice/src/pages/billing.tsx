import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { financeWorkspaceSchema, type FinanceWorkspace } from "@gina/core";
import { Card, Layout, Notice } from "@/components/Layout";
import { PublicationIcon } from "@/components/library-publication-icon";
import { useAuth } from "@/lib/auth";
import { useSupportQuery } from "@/lib/use-support-query";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
const sourceNames = {store:"Mağaza aboneliği",comp:"GINA geçici hakkı",beta:"Beta test seçimi",free:"Başlangıç paketi"};
const statusNames = {active:"Etkin",grace:"Ödeme için ek süre",on_hold:"Ödeme bekleniyor",expired:"Sona erdi",revoked:"Mağaza hakkı geri aldı"};
const eventNames = {processing:"İşleniyor",done:"Tamamlandı",failed:"Kontrol gerekiyor",waiting:"İşlenmeyi bekliyor"};
const planName = (plan:string) => plan === "free" ? "GINA Başlangıç" : `GINA ${plan === "pro" ? "Pro" : "Plus"}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function BillingPage() {
  const {session}=useAuth();
  return <Layout finance title="Paketler ve ödemeler">{session ? <Workspace key={session.user.id}/> : null}</Layout>;
}
function Workspace() {
  const router=useRouter(),{isAdmin}=useAuth();
  const [input,setInput]=useState(""),[query,setQuery]=useState("");
  const [tab,setTab]=useState<"families"|"notifications">("families");
  const family=typeof router.query.family==="string"&&uuid.test(router.query.family)?router.query.family:undefined;
  const result=useSupportQuery(async()=>{
    const {data,error}=await supabase().rpc("finance_workspace",{p_query:query,p_family_id:family}).abortSignal(AbortSignal.timeout(20000));
    if(error)throw error;return financeWorkspaceSchema.parse(data);
  },JSON.stringify({query,family}),"finance");
  const data=result.data;
  const search=(e:FormEvent)=>{e.preventDefault();setQuery(input.trim());};
  const select=(id?:string)=>void router.replace({pathname:"/billing",query:id?{family:id}:{}},undefined,{shallow:true});
  return <div className="billing-center">
    <div className="billing-intro"><p>Ailenin kullandığı paketi ve bu hakkın nereden geldiğini birlikte inceleyin.</p><button className="btn-secondary" onClick={result.reload}>Bilgileri yenile</button></div>
    {result.error?<Notice tone="error">Bilgiler yenilenemedi. Görünen kayıtlar son başarılı sorguya ait olabilir. Yeniden deneyin.</Notice>:null}
    <div className="billing-metrics" aria-label="Genel durum">
      <div><PublicationIcon name="family"/><span>Mağaza aboneliği olan aile<strong>{data?.summary.active_store_families??"—"}</strong></span></div>
      <div><PublicationIcon name="lock"/><span>Etkin geçici hak<strong>{data?.summary.active_overrides??"—"}</strong></span></div>
      <button onClick={()=>{setTab("notifications");select();}}><PublicationIcon name="info"/><span>İşlenememiş bildirim<strong>{data?.summary.unprocessed??"—"}</strong></span></button>
    </div>
    <div className="billing-tabs" onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();const next=tab==="families"?"notifications":"families";setTab(next);document.getElementById(`billing-${next}`)?.focus();}}} role="tablist" aria-label="Finans görünümü">
      <button role="tab" id="billing-families" aria-controls="billing-panel" tabIndex={tab==="families"?0:-1} aria-selected={tab==="families"} onClick={()=>setTab("families")}>Aile erişimi</button>
      <button role="tab" id="billing-notifications" aria-controls="billing-panel" tabIndex={tab==="notifications"?0:-1} aria-selected={tab==="notifications"} onClick={()=>setTab("notifications")}>Bildirim takibi</button>
    </div>
    {result.loading&&!data?<p role="status">Paket bilgileri yükleniyor…</p>:null}
    <section id="billing-panel" role="tabpanel" aria-labelledby={`billing-${tab}`}>
    {tab==="families"?<div className="billing-columns">
      <Card><h2>Aileyi bul</h2><form onSubmit={search} className="billing-search"><label htmlFor="billing-search" className="sr-only">Aile adı veya kimliği</label><input id="billing-search" className="input" value={input} maxLength={120} onChange={e=>setInput(e.target.value)} placeholder="Aile adı veya kimliği"/><button className="btn" type="submit">Ara</button></form>
        <p className="billing-hint">En fazla 50 aile gösterilir. Aramayla listeyi daraltabilirsiniz.</p>
        <div className="billing-family-list">{data?.families.map(f=><button key={f.id} aria-pressed={f.id===family} onClick={()=>select(f.id)}><strong>{f.name}</strong><span>{planName(f.plan)}</span><small>{sourceNames[f.source]}</small></button>)}</div>
        {data?.families.length===0?<div className="billing-empty"><PublicationIcon name="family"/><p>Bu aramayla eşleşen aile yok. Adın bir bölümünü veya aile kimliğini deneyin.</p></div>:null}
      </Card>
      {data?.detail?<FamilyDetail detail={data.detail} isAdmin={isAdmin} asOf={data.summary.as_of}/>:<Card><div className="billing-empty"><PublicationIcon name="eye"/><h2>Önce bir aile seçin</h2><p>Mağaza aboneliğini, geçici hakları ve güncel paket erişimini burada karşılaştırabilirsiniz.</p></div></Card>}
    </div>:<Card>
      <div className="billing-section-heading"><h2>{family?"Seçilen ailenin bildirimleri":"İşlenememiş mağaza bildirimleri"}</h2>{family?<button className="btn-secondary" onClick={()=>select()}>Tüm bildirimler</button>:null}</div>
      <p className="billing-hint">Son 50 açık kayıt. Ailesi henüz eşleşmeyen bildirimler de genel listede görünür. Bu liste mağazadan yeni veri istemez.</p>
      {data?.notifications.length===0?<div className="billing-empty"><PublicationIcon name="check"/><h3>Bu kapsamda bekleyen kayıt yok</h3><p>Bu sonuç, mağazadaki bütün işlemlerin ayrıca uzlaştırıldığı anlamına gelmez.</p></div>:null}
      <div className="billing-events">{data?.notifications.map(n=><article key={n.id}><div><strong>{n.platform==="apple"?"App Store":"Google Play"}</strong><span className="billing-chip warn">{eventNames[n.status]}</span></div><p>{n.family_name??"Aile henüz eşleşmedi"}</p><small>{fmtDateTime(n.received_at)} · {n.attempts} deneme</small><p>{n.error_code==="store_not_configured"?"Mağaza bağlantı ayarlarını kontrol edin.":n.error_code==="family_not_found"?"Ailenin satın almayı geri yüklemesi ve mağaza hesabının eşleşmesi gerekiyor.":n.status==="processing"?"İşlem sürüyor. Sonucu yenileyerek kontrol edebilirsiniz.":"Mağaza işlem geçmişini ve sunucu kaydını inceleyin; doğrulama tamamlanmadan paket hakkını değiştirmeyin."}</p><details><summary>Kayıt kimliği</summary><code>{n.id}</code></details></article>)}</div>
    </Card>}
    </section>
    {data?<p className="billing-hint">Son başarılı okuma: {fmtDateTime(data.summary.as_of)}. Görünür sekmede bilgiler düzenli yenilenir.</p>:null}
  </div>;
}
function FamilyDetail({detail:d,isAdmin,asOf}:{detail:NonNullable<FinanceWorkspace["detail"]>;isAdmin:boolean;asOf:string}) {
  const now=Date.parse(asOf);
  return <Card><div className="billing-section-heading"><h2>{d.name}</h2><span className="billing-chip">Aile erişimi</span></div>
    <div className="billing-effective"><PublicationIcon name="lock"/><div><small>Şu anda kullanılan paket</small><h3>{planName(d.effective.plan)}</h3><p>{sourceNames[d.effective.source]}{d.effective.expires_at?` · ${fmtDateTime(d.effective.expires_at)} tarihine kadar`:""}</p></div></div>
    <section className="billing-section"><h3>Mağaza abonelikleri</h3>
      {d.subscriptions.length===0?<p className="billing-hint">Bu aileye bağlanmış mağaza aboneliği yok. Beta veya geçici hakla kullanım, satın alma olarak sayılmaz.</p>:null}
      {d.subscriptions.map(s=><article className="billing-subscription" key={s.id}><div><strong>{s.platform==="apple"?"App Store":"Google Play"} · {planName(s.plan)}</strong><span className={`billing-chip ${s.status==="active"||s.status==="grace"?"live":""}`}>{(s.status==="active"||s.status==="grace")&&Date.parse(s.expires_at)<=now?"Süre bitti · güncelleme bekleniyor":statusNames[s.status]}</span></div><dl><div><dt>Hak bitişi</dt><dd>{fmtDateTime(s.expires_at)}</dd></div><div><dt>Otomatik yenileme</dt><dd>{s.auto_renewing?"Açık":"Kapalı"}</dd></div><div><dt>Son durum kaydı</dt><dd>{fmtDateTime(s.updated_at)}</dd></div></dl></article>)}
    </section>
    <section className="billing-section"><div className="billing-section-heading"><h3>GINA geçici hakları</h3>{isAdmin?<Link className="billing-text-link" href={{pathname:"/overrides",query:{family:d.id}}}>Hakları yönet</Link>:null}</div>
      <p className="billing-hint">Ücretsiz verilen erişimdir. Mağazadan ücret alınmaz ve ücret iadesi yapılmış olmaz.</p>
      {d.overrides.length===0?<p>Geçici hak tanımlanmamış.</p>:null}
      {d.overrides.map(o=><article className="billing-override" key={o.id}><div><strong>{planName(o.plan)}</strong><span className="billing-chip">{o.revoked_at?"Geri alındı":Date.parse(o.ends_at)<=now?"Süresi doldu":Date.parse(o.starts_at)>now?"Planlandı":"Etkin"}</span></div><p>{o.reason}</p><small>{fmtDateTime(o.starts_at)} — {fmtDateTime(o.ends_at)}</small></article>)}
    </section>
    <details className="billing-refund"><summary>İptal ve ücret iadesi nasıl ayrılır?</summary><p>Otomatik yenilemeyi kapatmak, mevcut dönemin ücretini geri ödemez. Ücret iadesi mağazanın işlemiyle doğrulanır; GINA içinde verilen geçici hak bundan ayrıdır.</p><p>Bu ekranda ücret iadesi başlatılmaz. Mağaza kararı ve güncel abonelik durumu doğrulanmadan “iade tamamlandı” olarak değerlendirmeyin.</p></details>
  </Card>;
}
