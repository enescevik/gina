import { supabase } from './supabase';

export interface DeviceAccess {
 id: string; name: string; access_mode: 'all' | 'selected'; pin_policy: 'existing' | 'required' | 'none';
 children: {id:string;name:string;avatar:string;grade:number|null;allowed:boolean;pin_set:boolean;needs_pin:boolean}[];
}
export interface FamilyChoice {id:string;name:string;children:number;active?:boolean;already_member?:boolean;error?:string}
export async function deviceAccess(id?:string) {
 const {data,error}=await supabase.rpc('get_child_device_access',{p_device_id:id});
 if(error) throw error;
 return data as unknown as DeviceAccess;
}
export async function myFamilies() {
 const {data,error}=await supabase.rpc('list_my_families'); if(error) throw error;
 return data as unknown as FamilyChoice[];
}
