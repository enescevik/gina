import {useRef,useState,type ComponentRef} from 'react';
import {TextInput,Text,View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {LockKeyhole} from 'lucide-react-native';
import {Pressable} from './pressable';
import {Button} from './button';
import {InfoCard} from './parent-screen';

/**
 * The single PIN control used by every 4-digit PIN screen (child device, child mode on the
 * parent phone, PIN setup). Real secure input stays accessible and supports keyboard/paste;
 * dots never reveal the PIN.
 */
export function PinEntry({label,value,onChange,disabled=false,onSubmit,compact=false,invalid=false,autoFocus=false}:{
 label:string;value:string;onChange:(v:string)=>void;disabled?:boolean;onSubmit?:()=>void;
 /** Hides the lock badge for forms with more than one PIN field. */
 compact?:boolean;
 /** Marks the boxes as invalid (e.g. confirmation mismatch) without announcing the PIN. */
 invalid?:boolean;
 autoFocus?:boolean;
}){
 const input=useRef<ComponentRef<typeof TextInput>>(null);
 const border=(i:number)=>invalid?'#C9534F':value.length===i?'#6042DE':'#DCD3EE';
 return <View style={{gap:compact?10:16,alignItems:compact?'stretch':'center'}}>
  {compact?null:<View style={{width:64,height:64,borderRadius:24,backgroundColor:'#DDF5EB',justifyContent:'center',alignItems:'center'}}><LockKeyhole color="#247A68" size={30}/></View>}
  <Text style={{fontFamily:'Nunito_700Bold',fontSize:compact?16:18,color:'#201951',textAlign:compact?'left':'center'}}>{label}</Text>
  <Pressable accessible={false} onPress={()=>input.current?.focus()} style={{width:'100%',maxWidth:320,height:compact?60:68,alignSelf:'center'}}>
   <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={{flexDirection:'row',gap:12,height:compact?60:68}}>
    {[0,1,2,3].map(i=><View key={i} style={{flex:1,borderRadius:20,borderWidth:2,borderColor:border(i),backgroundColor:value.length>i?'#EEE8FA':'#FFFFFF',alignItems:'center',justifyContent:'center'}}><View style={{width:12,height:12,borderRadius:6,backgroundColor:value.length>i?'#6042DE':'#E9E3F0'}}/></View>)}
   </View>
   <TextInput ref={input} accessibilityLabel={label} autoFocus={autoFocus} autoComplete="off" value={value} onChangeText={v=>onChange(v.replace(/\D/g,'').slice(0,4))} onSubmitEditing={onSubmit} secureTextEntry keyboardType="number-pad" maxLength={4} editable={!disabled} caretHidden style={{position:'absolute',inset:0,fontSize:30,color:'transparent',backgroundColor:'transparent'}}/>
  </Pressable>
 </View>;
}

/**
 * Same recovery path on every PIN screen: who can help, where a new PIN is set and what
 * happens after repeated wrong attempts. `audience` only changes the wording (child/parent).
 */
export function PinRecovery({audience,kind='child'}:{audience:'child'|'parent';kind?:'child'|'parent'}){
 const {t}=useTranslation();
 const [open,setOpen]=useState(false);
 const prefix=kind==='parent'?'u02.pinRecovery.parent':audience==='child'?'u02.pinRecovery.child':'u02.pinRecovery.adult';
 return <View style={{gap:10}}>
  <Button variant="ghost" title={t('experience.pin.help')} accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)}/>
  {open?<InfoCard title={t('unified.pinHelpTitle')} steps={[t(`${prefix}.step1`),t(`${prefix}.step2`),t('u02.pinRecovery.lock')]}/>:null}
 </View>;
}

