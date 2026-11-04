import {useState} from 'react';
import {useLocalSearchParams,router} from 'expo-router';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Text,View,useWindowDimensions} from 'react-native';
import {ShieldCheck,UserRound,Users,Check} from 'lucide-react-native';
import {ParentScreen, parentStyles,InfoCard,NavigationCard} from '@/components/ui/parent-screen';
import {Field} from '@/components/ui/field';
import {Button} from '@/components/ui/button';
import {Toggle} from '@/components/ui/toggle';
import {Pressable} from '@/components/ui/pressable';
import {Avatar} from '@/components/avatar';
import {ErrorText} from '@/components/ui/screen';
import {deviceAccess,type DeviceAccess} from '@/lib/family-experience';
import {supabase} from '@/lib/supabase';

export default function DeviceAccessScreen(){
 const {t}=useTranslation();const {deviceId:requestedDevice}=useLocalSearchParams<{deviceId?:string}>();
 const deviceId=typeof requestedDevice==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedDevice)?requestedDevice:undefined;
 const data=useQuery({queryKey:['device_access',deviceId],enabled:!!deviceId,queryFn:()=>deviceAccess(deviceId)});
 return <ParentScreen title={t('experience.device.title')} subtitle={t('experience.device.body')} loading={data.isLoading} error={data.error} onRetry={()=>void data.refetch()}>
  {data.data?<DeviceForm key={data.data.id} data={data.data}/>:<InfoCard title={t('experience.device.chooseFirst')} body={t('experience.device.chooseFirstBody')}><Button title={t('experience.device.openDevices')} onPress={()=>router.replace('/parent/menu?section=devices')}/></InfoCard>}
 </ParentScreen>;
}
function DeviceForm({data}:{data:DeviceAccess}){
 const {t}=useTranslation();const qc=useQueryClient();const {width,fontScale}=useWindowDimensions();const wide=width>=850&&fontScale<1.3;
 const [name,setName]=useState(data.name);const [selected,setSelected]=useState(data.children.filter(c=>c.allowed).map(c=>c.id));
 const [personal,setPersonal]=useState(data.access_mode==='selected'&&selected.length===1);
 const [pin,setPin]=useState(data.pin_policy!=='none');
 const missing=pin&&data.children.some(c=>selected.includes(c.id)&&!c.pin_set);
 const save=useMutation({mutationFn:async()=>{
  const {error}=await supabase.rpc('configure_child_device',{p_device_id:data.id,p_name:name.trim(),p_child_ids:selected,p_pin_required:pin});if(error)throw error;
 },onSuccess:()=>{void qc.invalidateQueries({queryKey:['devices']});void qc.invalidateQueries({queryKey:['device_access']});}});
 return <>
  <View style={{flexDirection:wide?'row':'column',gap:20,alignItems:wide?'flex-start':'stretch'}}>
  <View style={[parentStyles.card,wide&&{flex:1.2}]}>
   <Field label={t('experience.device.name')} value={name} editable={!save.isPending} maxLength={60} onChangeText={v=>{setName(v);save.reset();}}/>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{([true,false] as const).map(value=>{const Icon=value?UserRound:Users;return <Pressable key={String(value)} disabled={save.isPending} accessibilityRole="radio" accessibilityState={{checked:personal===value}} onPress={()=>{setPersonal(value);if(value)setSelected(selected.slice(0,1));save.reset();}} style={{flex:1,minWidth:130,minHeight:116,padding:18,gap:10,borderRadius:22,borderWidth:2,borderColor:personal===value?'#6042DE':'#EEE8EF',backgroundColor:personal===value?'#F2EDFF':'#FCFAF6'}}><Icon color="#6042DE" size={28}/><Text style={parentStyles.copy}>{t(value?'experience.device.personal':'experience.device.shared')}</Text></Pressable>;})}</View>
   <Text style={parentStyles.muted}>{t(personal?'experience.device.personalHelp':'experience.device.sharedHelp')}</Text>
   <View style={{gap:8}}>{data.children.map(c=><Pressable key={c.id} disabled={save.isPending} accessibilityRole={personal?'radio':'checkbox'} accessibilityState={personal?{checked:selected.includes(c.id)}:{checked:selected.includes(c.id)}} onPress={()=>{setSelected(personal?[c.id]:selected.includes(c.id)?selected.filter(id=>id!==c.id):[...selected,c.id]);save.reset();}} style={{minHeight:72,flexDirection:'row',alignItems:'center',gap:12,borderRadius:20,padding:10,backgroundColor:selected.includes(c.id)?'#DDF5EB':'#FCFAF6'}}><Avatar slug={c.avatar} size={48}/><Text style={[parentStyles.copy,{flex:1}]}>{c.name}</Text>{selected.includes(c.id)?<Check size={24} color="#247A68"/>:null}</Pressable>)}</View>
   {!data.children.length?<NavigationCard title={t('parent.addChild')} onPress={()=>router.push('/parent/menu?section=family')}/>:null}
  </View>
  <View style={[parentStyles.card,wide&&{flex:1}]}>
   <View style={parentStyles.row}><ShieldCheck color="#6042DE" size={26}/><Text style={parentStyles.title}>{t('experience.device.pinTitle')}</Text></View>
   <Toggle label={t('experience.device.requirePin')} value={pin} disabled={save.isPending} onChange={v=>{setPin(v);save.reset();}}/>
   <Text style={parentStyles.muted}>{t(pin?'experience.device.pinOn':'experience.device.pinOff')}</Text>
   {missing?<InfoCard title={t('experience.device.pinMissing')} body={t('experience.device.pinMissingBody')}><Button variant="ghost" title={t('experience.device.setPins')} onPress={()=>router.push('/parent/menu?section=family')}/></InfoCard>:null}
  </View>
  </View>
  <ErrorText error={save.error}/>
  {save.isSuccess?<InfoCard title={t('common.saved')} body={t('experience.device.saved')}/>:null}
  <Button title={t('common.save')} disabled={missing||!selected.length||!name.trim()} loading={save.isPending} onPress={()=>save.mutate()}/>
  <Button variant="ghost" title={t('common.back')} onPress={()=>router.back()}/>
 </>;
}
