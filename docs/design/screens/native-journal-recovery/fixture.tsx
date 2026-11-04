// Temporary simulator-only acceptance route; never include in an app release.
import { useState } from "react";
import { Text, View, ScrollView, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { randomUUID } from "expo-crypto";
import { emptyNotebook, type NotebookDocument } from "@gina/core";
import { createAnswerJournal } from "@/lib/answer-journal";
import { createReviewJournal } from "@/lib/review-journal";
import { deviceRecordStorage as store } from "@/lib/device-record-storage";
import { NotebookPage } from "@/components/learning/notebook-page";
type AnswerReceipt = Parameters<Parameters<ReturnType<typeof createAnswerJournal>["send"]>[1]>[0];
const id=(n:number)=>`04002611-0000-4000-8000-${String(n).padStart(12,"0")}`;
const witnessKey="gina.qa.native-journal-recovery.20261104";
const processNonce=randomUUID();
const answer=()=>createAnswerJournal(id(1),id(2),id(3),id(4));
const review=(q:number)=>createReviewJournal(id(1),id(2),id(4),id(q));
function document():NotebookDocument {
  const doc=emptyNotebook();
  doc.elements.push({id:id(30),type:"stroke",color:"#6042DE",size:4,points:[[100,100],[100,350],[450,350],[100,100]]});
  doc.elements.push({id:id(31),type:"text",x:100,y:420,width:650,height:100,text:"6 + 8 + 10 = 24 cm",color:"#201951",size:40});
  return doc;
}
const parentDoc=()=>({...document(),elements:document().elements.filter(e=>e.type==="text").map(e=>({...e,text:"İşlemi doğru kurdun.",color:"#227D73" as const}))});
const draft=()=>({score:"85",feedback:"Sonucu birimiyle yazdın.",document:parentDoc(),appliedAi:id(40)});
function same(a:unknown,b:unknown,label:string) {if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label);}
export default function JournalAcceptance(){
  const {width}=useWindowDimensions();
  const[message,setMessage]=useState(store.get(witnessKey)?"Önceki süreçten test kaydı bulundu.":"Henüz test kaydı yok.");
  const[preview,setPreview]=useState<NotebookDocument|null>(null);
  const[busy,setBusy]=useState(false);
  const run=(fn:()=>Promise<void>)=>{setBusy(true);void fn().catch(e=>setMessage(`BAŞARISIZ: ${e.message}`)).finally(()=>setBusy(false));};
  const prepare=async()=>{
    if(store.get(witnessKey))throw Error("Önce mevcut test kaydını doğrula.");
    const a=answer();if(Object.keys(a.restore()).length)throw Error("Test kapsamı boş değil.");
    const value={text:"24 cm",document:document()};a.edit(id(10),value,2);
    let receipt:AnswerReceipt|undefined;
    try{await a.send(id(10),async r=>{receipt=r;throw Error("simulated_response_loss");},()=>{throw Error("unexpected_ack");});}catch(e){if((e as Error).message!=="simulated_response_loss")throw e;}
    if(!receipt)throw Error("missing_receipt");
    const later={...value,text:"24 cm; çevre."};a.edit(id(10),later,2);
    a.edit(id(11),value,0);
    const r=review(20),unsent=review(21);if(r.restore()||unsent.restore())throw Error("Veli test kapsamı boş değil.");
    const base={revision:0,answerHash:"qa-only-answer-hash",openEnded:true};
    r.edit(base,draft());const pending=r.prepare();unsent.edit(base,draft());
    store.set(witnessKey,JSON.stringify({processNonce,receipt,later,value,pending,unsent:unsent.restore()}));
    setPreview(document());setMessage("HAZIR: Çocuk çizimi/yazısı ve veli puanı/notu ayrı ayrı saklandı. İki belirsiz kayıt isteği ve iki gönderilmemiş taslak var. Şimdi uygulama sürecini kapatıp yeniden aç.");
  };
  const recover=async()=>{
    const raw=store.get(witnessKey);if(!raw)throw Error("missing_witness");const expected=JSON.parse(raw);
    if(expected.processNonce===processNonce)throw Error("Uygulama süreci henüz yeniden başlamadı.");
    const a=answer(),restored=a.restore();same(restored[id(10)],expected.later,"child_latest_lost");same(restored[id(11)],expected.value,"child_unsent_lost");
    const r=review(20),u=review(21);same(r.restore(),expected.pending,"parent_pending_lost");same(u.restore(),expected.unsent,"parent_unsent_lost");same(r.prepare(),expected.pending,"parent_receipt_changed");
    let rejected=false;try{r.acknowledge(expected.pending.pending,0);}catch(e){rejected=(e as Error).message==="review_receipt_invalid";}if(!rejected)throw Error("invalid_ack_accepted");
    same(review(20).restore(),expected.pending,"invalid_ack_lost_draft");
    const transmissions:AnswerReceipt[]=[];const saved:number[]=[];
    await a.send(id(10),async receipt=>{transmissions.push(receipt);if(transmissions.length===1){same(receipt,expected.receipt,"child_receipt_changed");return 3;}same(receipt.answer,expected.later,"later_edit_lost");if(receipt.id===expected.receipt.id||receipt.revision!==3)throw Error("later_revision_invalid");return 4;},(_value,rev)=>saved.push(rev));
    same(saved,[3,4],"save_order_invalid");if(a.restore()[id(10)])throw Error("ack_not_removed");same(a.restore()[id(11)],expected.value,"unrelated_child_draft_removed");
    r.acknowledge(expected.pending.pending,1);if(review(20).restore())throw Error("review_ack_not_removed");same(review(21).restore(),expected.unsent,"unrelated_parent_draft_removed");
    setPreview(restored[id(10)]!.document!);
    a.discard(id(11));u.discard();store.remove(witnessKey);
    console.info("NATIVE_JOURNAL_RECOVERY_PASS",JSON.stringify({freshProcess:true,childPendingSame:true,parentPendingSame:true,unsentPreserved:true,laterEditPreserved:true,invalidReceiptRetained:true,syntheticCleanup:true}));
    setMessage("GEÇTİ: Yeni uygulama sürecinde çocuk çizimi/yazısı, veli puanı/notu ve AI kimliği aynen okundu. İstek kimlikleri değişmedi. Sonraki düzenleme korundu. Hatalı yanıt taslağı silmedi. Yalnız bu testin kayıtları temizlendi.");
  };
  return <SafeAreaView style={{flex:1,backgroundColor:"#FCFAF6"}}><ScrollView contentContainerStyle={{padding:24,gap:16}}>
    <Text style={{fontSize:26,color:"#201951",fontWeight:"700"}}>Cihazda taslak kurtarma denetimi</Text>
    <Text style={{fontSize:17,color:"#201951"}}>Sentetik test · Gerçek aile kaydı ve ağ gönderimi yok</Text>
    <Text accessibilityRole="alert" style={{fontSize:19,lineHeight:29,color:"#227D73"}}>{message}</Text>
    <Pressable disabled={busy} accessibilityRole="button" onPress={()=>run(prepare)} style={{padding:18,borderRadius:18,backgroundColor:"#6042DE"}}><Text style={{fontSize:18,color:"white"}}>1. Test taslaklarını hazırla</Text></Pressable>
    <Pressable disabled={busy} accessibilityRole="button" onPress={()=>run(recover)} style={{padding:18,borderRadius:18,backgroundColor:"#EEE8FA"}}><Text style={{fontSize:18,color:"#201951"}}>2. Yeniden açılışı doğrula</Text></Pressable>
    {preview&&<View style={{alignItems:"center"}}><NotebookPage document={preview} width={Math.min(width-48,500)}/></View>}
  </ScrollView></SafeAreaView>;
}
