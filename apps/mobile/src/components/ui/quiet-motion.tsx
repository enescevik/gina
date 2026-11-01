import { useEffect, useState, useCallback } from 'react';
import { AccessibilityInfo, Animated, AppState, View, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Check, Link2, Smartphone, Tablet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

/** Motion only communicates an active operation; pauses off-screen and respects OS preferences. */
export function ConnectionMoment({status='waiting'}:{status?:'waiting'|'connected'|'idle'}) {
 const {t}=useTranslation();
 const [reduce,setReduce]=useState(true);
 const [active,setActive]=useState(AppState.currentState==='active');
 const [focused,setFocused]=useState(false);
 useFocusEffect(useCallback(()=>{setFocused(true);return ()=>setFocused(false);},[]));
 const [opacity]=useState(()=>new Animated.Value(1));
 useEffect(()=>{
  let live=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduce(v);});
  const pref=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);
  const app=AppState.addEventListener('change',v=>setActive(v==='active'));
  return ()=>{live=false;pref.remove();app.remove();};
 },[]);
 useEffect(()=>{
  opacity.setValue(1);
  if(reduce||!active||!focused||status!=='waiting')return;
  const loop=Animated.loop(Animated.sequence([
   Animated.timing(opacity,{toValue:.35,duration:1100,useNativeDriver:true,isInteraction:false}),
   Animated.timing(opacity,{toValue:1,duration:1100,useNativeDriver:true,isInteraction:false}),
  ])); loop.start();return ()=>loop.stop();
 },[reduce,active,focused,status,opacity]);
 return <View style={{alignItems:'center',gap:12,paddingVertical:12}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:22}}>
   <View style={{padding:18,borderRadius:24,backgroundColor:'#EEE8FA'}}><Smartphone size={38} color="#6042DE"/></View>
   <Animated.View style={{opacity}}>{status==='connected'?<Check size={30} color="#247A68"/>:<Link2 size={28} color="#6042DE"/>}</Animated.View>
   <View style={{padding:18,borderRadius:24,backgroundColor:'#DDF5EB'}}><Tablet size={46} color="#247A68"/></View>
  </View>
  <Text accessibilityLiveRegion="polite" style={{fontFamily:'Nunito_700Bold',fontSize:17,color:'#201951'}}>{t(`experience.connection.${status}`)}</Text>
 </View>;
}
