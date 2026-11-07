import {useMutation,useQuery,useInfiniteQuery} from "@tanstack/react-query";
import {useRef,useState} from "react";
import {router} from "expo-router";
import {randomUUID} from "expo-crypto";
import {newProvaDraft,type ProvaBlock,type ProvaDraft} from "@gina/core";
import {persistProvaDraft} from "@/lib/prova-draft";
import {loadBuilderMaterial,questionsOf} from "@/components/learning/prova-builder-data";
import {Toggle} from "@/components/ui/toggle";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { QuestionLike } from "@/components/learning/question-like";
import { ParentScreen, EmptyCard, parentStyles, ChildPicker } from "@/components/ui/parent-screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export default function FavoriteQuestions() {
  const { t } = useTranslation();
  const { claims, session } = useSession();
  const family = claims?.family_id;
  const user = session?.user.id;
  const [childId,setChildId]=useState<string|null>(null);
  const [selection,setSelection]=useState<{child:string;ids:string[]}>({child:"",ids:[]});
  const starting=useRef(false);
  const prepared=useRef(new Map<string,{id:string;request:string;content:ProvaDraft}>());
  const children=useQuery({queryKey:["favorite_children",family],enabled:!!family,queryFn:async()=>{
    const {data,error}=await supabase.from("children").select("id,name,grade,avatar").eq("family_id",family!).is("archived_at",null).order("sort_order");if(error)throw error;return data;
  }});
  const child=children.data?.find(c=>c.id===childId)??children.data?.[0];
  const selected=selection.child===child?.id?selection.ids:[];
  const create=useMutation({mutationFn:async()=>{
    if(!child?.grade||selected.length===0||selected.length>10)throw Error("invalid_selection");
    const identity=child.id+":"+[...selected].sort().join(":");let entry=prepared.current.get(identity);
    if(!entry){
      const members=await supabase.from("question_source_members").select("question_id,group_id").in("question_id",selected);if(members.error)throw members.error;
      const blocks:ProvaBlock[]=[];const seen=new Set<string>();
      for(const id of selected){const group=members.data.find(m=>m.question_id===id)?.group_id;const key=group??id;
        if(seen.has(key))continue;seen.add(key);blocks.push({kind:group?"group":"question",id:key,source:"manual"});}
      const material=await loadBuilderMaterial(blocks);const questions=blocks.flatMap(b=>questionsOf(b,material));
      if(!questions.length||questions.length>100||questions.some(q=>q.grade!==child.grade||q.family_id!==family))throw Error("invalid_selection");
      for(const block of blocks){const q=questionsOf(block,material)[0];const pv=q?.provenance;
        const generator=pv&&typeof pv==="object"&&!Array.isArray(pv)?pv.generator:null;
        block.source=generator==="gina-library"?"library":generator==="ai"||generator==="ai_edited"?"ai":"manual";}
      entry={id:randomUUID(),request:randomUUID(),content:{...newProvaDraft(),childId:child.id,grade:child.grade,
        title:t("questionLikes.practiceTitle"),purpose:"practice",format:"practice",kind:"mixed",step:2,
        subjects:[...new Set(questions.map(q=>q.subject))],topics:[...new Set(questions.map(q=>q.topic))].slice(0,30),target:questions.length,blocks}};
      prepared.current.set(identity,entry);
    }
    await persistProvaDraft(entry.id,0,entry.content,entry.request);return entry.id;
  },onSuccess:id=>router.push({pathname:"/parent/prova/builder",params:{draftId:id}})});
  const favorites = useInfiniteQuery({
    queryKey: ["question_favorites", family, user],
    initialPageParam: 0,
    enabled: !!family && !!user,
    queryFn: async ({pageParam}) => {
      const {data, error} = await supabase.from("question_reactions")
        .select("question_id,created_at,question_bank(id,stem,subject,topic,grade)")
        .eq("family_id",family!).eq("parent_user_id",user!)
        .order("created_at",{ascending:false}).order("question_id")
        .range(pageParam,pageParam+29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) => last.length === 30 ? pages.length*30 : undefined,
  });
  const rows = favorites.data?.pages.flat() ?? [];
  return <ParentScreen title={t("questionLikes.title")} subtitle={t("questionLikes.body")}
    loading={favorites.isPending} error={favorites.error} onRetry={() => void favorites.refetch()}>
    {!rows.length && !favorites.isPending && !favorites.error ? <EmptyCard title={t("questionLikes.empty")} slug="display-bookworm" /> : null}
    {children.data&&children.data.length>1?<ChildPicker profiles={children.data} selected={child?.id??null} onSelect={id=>{setChildId(id);setSelection({child:id??"",ids:[]});}} />:null}
    {child?<View style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t("questionLikes.practiceHelp",{name:child.name})}</Text>
      <Text style={parentStyles.muted}>{t("questionLikes.groupHelp")}</Text>
      <Button title={t("questionLikes.practice",{count:selected.length})} disabled={!selected.length||create.isPending} loading={create.isPending} onPress={()=>{if(starting.current)return;starting.current=true;create.mutate(undefined,{onSettled:()=>{starting.current=false;}});}} />
      {create.error?<Text accessibilityRole="alert">{t("questionLikes.error")}</Text>:null}
    </View>:null}
    {rows.map(row => row.question_bank ? <View key={row.question_id} style={[parentStyles.card,{gap:12}]}>
      <Text style={parentStyles.muted}>{row.question_bank.subject} · {row.question_bank.topic}</Text>
      <Text style={parentStyles.copy}>{row.question_bank.stem}</Text>
      {child?.grade===row.question_bank.grade?<Toggle label={t("questionLikes.selectPractice")} value={selected.includes(row.question_id)} disabled={create.isPending||(!selected.includes(row.question_id)&&selected.length>=10)} onChange={checked=>{if(child)setSelection({child:child.id,ids:checked?[...selected,row.question_id]:selected.filter(id=>id!==row.question_id)});}} />:null}
      <QuestionLike questionId={row.question_id} />
    </View> : null)}
    {favorites.hasNextPage ? <Button variant="secondary" title={t("questionLikes.more")}
      loading={favorites.isFetchingNextPage} onPress={() => void favorites.fetchNextPage()} /> : null}
  </ParentScreen>;
}
