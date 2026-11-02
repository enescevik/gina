// Temporary local QA route. Removed after phone/tablet verification.
import { useState } from "react";
import { NotebookWorkspace } from "@/components/learning/notebook-workspace";
import { SatinButton } from "@/components/planner/ui";
import { emptyNotebook } from "@gina/core";
import { queryClient } from "@/lib/query";
import i18n from "@/lib/i18n";
const q="30000000-0000-4000-8000-000000009901",src="80000000-0000-4000-8000-000000009901";
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360"><rect width="600" height="360" fill="#FFFEFA"/><path d="M140 60V290H450Z" fill="#EEE8FA" stroke="#6042DE" stroke-width="4"/><path d="M140 264H166V290" fill="none" stroke="#6042DE" stroke-width="3"/><g font-family="sans-serif" font-size="26" fill="#201951"><text x="115" y="45">A</text><text x="110" y="325">B</text><text x="455" y="325">C</text><text x="46" y="183">6 cm</text><text x="258" y="327">8 cm</text><text x="310" y="150">10 cm</text></g></svg>';
void i18n.changeLanguage("tr");
queryClient.setQueryDefaults(["question_media"],{staleTime:Infinity});
queryClient.setQueryData(["question_media",undefined,undefined,q],[{source_id:src,question_id:q,width:600,height:360,alt:"ABC dik üçgeni; AB 6 cm, BC 8 cm, AC 10 cm."}]);
queryClient.setQueryDefaults(["question_image_url"],{staleTime:Infinity});
queryClient.setQueryData(["question_image_url",undefined,undefined,src,q],{url:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)});
export default function Preview(){const [document,setDocument]=useState(emptyNotebook);const[text,setText]=useState("");return <NotebookWorkspace title="Matematik · 1 / 3" questionId={q} stem="ABC üçgeninin çevresi kaç santimetredir? |AB| = 6 cm, |BC| = 8 cm ve |AC| = 10 cm. Çözümünü göster." document={document} text={text} onChange={setDocument} onTextChange={setText} status="Kaydedildi" saved progress="1 / 3" disabled={false} onExit={()=>{}} alerts={null} footer={<SatinButton title="Sonraki soru" onPress={()=>{}}/>}/>;}
