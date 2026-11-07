import { useState } from "react";
import { resources } from "@gina/core/i18n";
import { Card, Notice } from "./Layout";
import { useAdminQuery, unwrap } from "@/lib/use-async";
import { supabase } from "@/lib/supabase";

/** Existing BO is TR; both dictionaries live in the shared i18n namespace. */
const copy=resources.tr.common.questionReports;
export function QuestionReports(){
 const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState<unknown>(null);
 const reports=useAdminQuery(async()=>unwrap(await supabase().from("question_reports")
  .select("id,reason,created_at,question_bank(stem,subject,grade)").eq("status","open")
  .order("created_at").order("id").limit(50)),[]);
 async function resolve(id:string){setBusy(id);setError(null);
  try{unwrap(await supabase().rpc("resolve_question_report",{p_id:id,p_status:"reviewed"}));reports.reload();}
  catch(e){setError(e);}finally{setBusy(null);}
 }
 // PostgREST cannot see this new table before the coordinated migration.
 if(reports.error&&typeof reports.error==="object"&&"code" in reports.error&&["42P01","PGRST205"].includes(String(reports.error.code)))return null;
 return <Card title={copy.queue}>
  <p>{copy.queueHelp}</p>
  {reports.loading?<p>{copy.loading}</p>:null}
  {reports.error||error?<Notice tone="error">{copy.error}</Notice>:null}
  {!reports.loading&&!reports.error&&!reports.data?.length?<p>{copy.empty}</p>:null}
  {reports.data?.map(row=><div key={row.id} style={{borderTop:"1px solid #EAE5EE",padding:"16px 0",display:"grid",gap:8}}>
   <strong>{copy.reasons[row.reason as keyof typeof copy.reasons]}</strong>
   <p>{row.question_bank?.subject} · {row.question_bank?.grade}</p>
   <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.question_bank?.stem}</p>
   <button className="btn secondary" disabled={busy!==null} onClick={()=>void resolve(row.id)}>{copy.reviewed}</button>
  </div>)}
  {!reports.loading&&reports.data?.length===50?<p>{copy.firstPage}</p>:null}
 </Card>;
}
