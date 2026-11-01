import {useRef,type ComponentRef} from 'react';
import {TextInput,Text,View} from 'react-native';
import {LockKeyhole} from 'lucide-react-native';
import {Pressable} from './pressable';

/** Real secure input remains accessible and supports keyboard/paste; dots never reveal the PIN. */
export function PinEntry({label,value,onChange,disabled=false,onSubmit}:{label:string;value:string;onChange:(v:string)=>void;disabled?:boolean;onSubmit?:()=>void}){
 const input=useRef<ComponentRef<typeof TextInput>>(null);
 return <View style={{gap:16,alignItems:'center'}}>
  <View style={{width:64,height:64,borderRadius:24,backgroundColor:'#DDF5EB',justifyContent:'center',alignItems:'center'}}><LockKeyhole color="#247A68" size={30}/></View>
  <Text style={{fontFamily:'Nunito_700Bold',fontSize:18,color:'#201951'}}>{label}</Text>
  <Pressable accessible={false} onPress={()=>input.current?.focus()} style={{width:'100%',maxWidth:320,height:68}}>
   <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" style={{flexDirection:'row',gap:12,height:68}}>
    {[0,1,2,3].map(i=><View key={i} style={{flex:1,borderRadius:20,borderWidth:2,borderColor:value.length===i?'#6042DE':'#DCD3EE',backgroundColor:value.length>i?'#EEE8FA':'#FFFFFF',alignItems:'center',justifyContent:'center'}}><View style={{width:12,height:12,borderRadius:6,backgroundColor:value.length>i?'#6042DE':'#E9E3F0'}}/></View>)}
   </View>
   <TextInput ref={input} accessibilityLabel={label} value={value} onChangeText={v=>onChange(v.replace(/\D/g,'').slice(0,4))} onSubmitEditing={onSubmit} secureTextEntry keyboardType="number-pad" maxLength={4} editable={!disabled} caretHidden style={{position:'absolute',inset:0,fontSize:30,color:'transparent',backgroundColor:'transparent'}}/>
  </Pressable>
 </View>;
}
