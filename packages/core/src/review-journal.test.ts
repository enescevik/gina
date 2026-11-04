import { describe, expect, it } from "vitest";
import { ReviewJournal, reviewJournalKey, type ReviewDraft } from "./review-journal";
import { emptyNotebook } from "./notebook";
const id = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const base = {revision:2,answerHash:"answer-hash",openEnded:true};
const draft:ReviewDraft = {score:"85",feedback:"İşlemi doğru kurdun.",document:emptyNotebook(),appliedAi:null};
function fixture() {
  const data=new Map<string,string>();let seq=10;
  const store={get:(k:string)=>data.get(k)??null,set:(k:string,v:string)=>{data.set(k,v);},remove:(k:string)=>{data.delete(k);},keys:()=>[...data.keys()]};
  const key=reviewJournalKey(id(1),id(2),id(3),id(4));
  return {data,store,key,open:()=>new ReviewJournal(store,key,()=>id(++seq))};
}
describe("parent review write-ahead journal",()=>{
  it("recovers score, feedback, ink and applied AI identity after process restart",()=>{
    const f=fixture(),j=f.open();j.restore();
    const document=emptyNotebook();document.elements.push({id:id(7),type:"stroke",color:"#201951",size:3,points:[[1,2],[3,4]]});
    const value={...draft,document,appliedAi:id(8)};j.edit(base,value);
    expect(f.open().restore()).toEqual({version:1,base,draft:value,pending:null});
  });
  it("replays exactly the original pending request even after the server revision advances",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);const command=j.prepare();
    const reopened=f.open();expect(reopened.restore()).toEqual(command);
    expect(reopened.prepare()).toEqual(command);
    expect(()=>reopened.edit({...base,revision:8},{...draft,feedback:"new"})).toThrow("review_local_pending");
    reopened.acknowledge(command.pending!,4);expect(f.open().restore()).toBeNull();
  });
  it("never silently rebases an old local draft on another parent's newer review",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);
    const reopened=f.open();reopened.restore();reopened.edit({...base,revision:5,answerHash:"new-answer"},{...draft,score:"90"});
    expect(reopened.prepare().base).toEqual(base);
  });
  it("preserves the draft after a definitive rejection and uses a new receipt only then",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);const a=j.prepare();
    j.reject(a.pending!);j.edit(base,{...draft,score:"90"});const b=j.prepare();
    expect(b.pending).not.toEqual(a.pending);expect(b.draft.score).toBe("90");expect(b.base).toEqual(base);
  });
  it("does not return a network command when its write-ahead storage fails",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);f.store.set=()=>{throw Error("disk_full");};
    expect(()=>j.prepare()).toThrow("disk_full");expect(f.open().restore()?.pending).toBeNull();
  });
  it("keeps the pending receipt when acknowledgement cleanup fails",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);const a=j.prepare();const remove=f.store.remove;
    f.store.remove=()=>{throw Error("disk_full");};expect(()=>j.acknowledge(a.pending!,4)).toThrow("disk_full");
    f.store.remove=remove;const next=f.open();expect(next.restore()).toEqual(a);next.acknowledge(a.pending!,4);expect(f.data.size).toBe(0);
  });
  it("does not clear another tab's newer draft on a late reply or discard",()=>{
    const f=fixture(),a=f.open(),b=f.open();a.restore();b.restore();a.edit(base,draft);
    expect(()=>b.edit(base,{...draft,score:"1"})).toThrow("review_local_changed");
    expect(()=>b.discard()).toThrow("review_local_changed");
    const command=a.prepare();f.data.clear();expect(()=>a.acknowledge(command.pending!,4)).toThrow("review_local_changed");expect(f.data.size).toBe(0);
  });
  it("isolates actor, family, attempt and question",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);
    for(let n=0;n<4;n++){const args=[id(1),id(2),id(3),id(4)];args[n]=id(99);expect(new ReviewJournal(f.store,reviewJournalKey(args[0]!,args[1]!,args[2]!,args[3]!),()=>id(9)).restore()).toBeNull();}
  });
  it("keeps unknown or damaged records without discarding them",()=>{
    const f=fixture();f.data.set(f.key,'{"version":2}');expect(()=>f.open().restore()).toThrow();expect(f.data.get(f.key)).toBe('{"version":2}');
  });
  it("accepts incomplete input as a draft but blocks invalid score submission",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,{...draft,score:""});expect(()=>j.prepare()).toThrow("invalid_score");expect(f.open().restore()?.draft.score).toBe("");
    j.edit(base,{...draft,score:"101"});expect(()=>j.prepare()).toThrow("invalid_score");
    j.edit(base,{...draft,score:"0"});expect(j.prepare().draft.score).toBe("0");
  });
  it("requires a valid receipt and prevents abandoning an uncertain operation",()=>{
    const f=fixture(),j=f.open();j.restore();j.edit(base,draft);const a=j.prepare();
    for(const value of [null,{},-1,1,2.2])expect(()=>j.acknowledge(a.pending!,value)).toThrow("review_receipt_invalid");
    expect(()=>j.discard()).toThrow("review_local_pending");
    j.acknowledge(a.pending!,base.revision);expect(f.data.size).toBe(0);
  });
});
it("keeps multiple-choice feedback without requiring a manual score",()=>{
  const f=fixture(),j=f.open();j.restore();j.edit({...base,openEnded:false},{...draft,score:""});
  expect(j.prepare().base.openEnded).toBe(false);
});
it("retains a definitively rejected request if clearing its pending flag fails, then retries cleanup",()=>{
  const f=fixture(),j=f.open();j.restore();j.edit(base,draft);const a=j.prepare(),set=f.store.set;
  f.store.set=()=>{throw Error("disk_full");};expect(()=>j.reject(a.pending!)).toThrow("disk_full");
  expect(j.prepare()).toEqual(a);f.store.set=set;j.reject(a.pending!);expect(f.open().restore()?.pending).toBeNull();
});
