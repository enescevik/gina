import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ParentReviewWorkspace } from '@/components/learning/parent-review-workspace';
import { DrawingPad } from '@/components/learning/drawing-pad';
import { emptyNotebook } from '@gina/core';
export default function Fixture() {
 const {mode='empty'}=useLocalSearchParams<{mode:string}>();
 const [closed,setClosed]=useState(false);
 if(mode==='draw'&&!closed) return <DrawingPad onClose={()=>setClosed(true)} onSave={()=>{}}/>;
 const mc=mode==='mc'; const ink=mode==='ink';
 const original={...emptyNotebook(),elements:[{id:'70000000-0000-4000-8000-000000000001',type:'stroke',color:'#201951',size:4,points:[[100,100],[200,150],[300,90]]}]};
 return <ParentReviewWorkspace key={mode} attemptId="80000000-0000-4000-8000-000000000001" childName="Emre" index={0} count={10} finished onNavigate={()=>{}} aiRemaining={10} questionStates={Array(10).fill('waiting')}
 question={{id:'70000000-0000-4000-8000-000000000001',stem:mc?'Kenarları 6 cm ve 8 cm olan dikdörtgenin çevresi kaç santimetredir?':'Kenarları 6 cm ve 8 cm olan dikdörtgenin çevresini hesapla. Nasıl bulduğunu açıkla.',kind:mc?'multiple_choice':'open_ended',choices:mc?[{key:'A',text:'14 cm'},{key:'B',text:'28 cm'},{key:'C',text:'48 cm'},{key:'D',text:'56 cm'}]:null,correct_key:mc?'B':null,expected_answer:mc?null:'28 cm',solution:'2 × (6 + 8) = 28 cm'}}
 answer={mode==='empty'?undefined:{answer_document:ink?original:null,answer_text:mode==='text'?'İki uzun ve iki kısa kenarı topladım: 28 cm.':null,answer_key:mc?'A':null,is_correct:mc?false:null}}
 review={{score:null,feedback:null,document:null,revision:0,answer_hash:'qa-only'}}/>;
}
