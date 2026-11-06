import { useRouteMotion } from "@/lib/use-route-motion";
import {useQuery} from "@tanstack/react-query";
import {useState} from "react";
import {supabase} from "@/lib/supabase";
import { Redirect, Stack, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { PAIRING_GATE_KEY, pairingReceiptPending, receiptGatePassed } from "@/components/device/pairing-receipt-ack";

import { useSession, refreshClaims } from "@/lib/session";
import { usePush } from "@/lib/push";

export default function ChildLayout() {
  const motion = useRouteMotion();
  // Push: eşleşmiş tablette izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("device");
  const { claims } = useSession();
  const path = usePathname();
  // C06: remember why the device left so the pairing screen can say so calmly.
  const [revoked, setRevoked] = useState(false);
  useQuery({queryKey:['device_session',claims?.device_id,claims?.child_id],enabled:claims?.role==='device',refetchInterval:30000,refetchIntervalInBackground:false,
    queryFn:async()=>{
      const {data,error}=await supabase.from('devices').select('id,active_child_id,revoked_at').eq('id',claims!.device_id!).maybeSingle();
      if(error)throw error;
      // A revoked device can no longer read its own row (RLS), so "no row" means access was removed.
      if(!data||data.revoked_at){setRevoked(true);await refreshClaims();}
      else if(data.active_child_id!==(claims?.child_id??null))await refreshClaims();
      return data??null;
    },
  });
  // D2: a pairing made while the app was closed is shown ("… joined / not my family") before the child
  // area, while the server's 15-minute undo window is open and this tablet has not confirmed it yet.
  // Checked once per app run; a failed check lets the child in (the parent can still remove the device).
  const gate = useQuery({queryKey:[PAIRING_GATE_KEY,claims?.device_id??null],enabled:claims?.role==='device'&&!!claims.device_id,
    staleTime:Infinity,gcTime:Infinity,retry:1,queryFn:()=>pairingReceiptPending(claims!.device_id!)});
  if (claims?.role !== "device") return <Redirect href={revoked ? { pathname: "/device/pair", params: { revoked: "1" } } : "/"} />;
  if (gate.isPending && gate.fetchStatus !== "idle" && !receiptGatePassed(claims.device_id)) return <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#FCFAF6"}}><ActivityIndicator color="#6042DE" /></View>;
  if (gate.data === true) return <Redirect href={{ pathname: "/device/pair", params: { receipt: "1" } }} />;
  if (!claims.child_id && path !== "/child" && path !== "/child/pin") return <Redirect href="/child" />;
  return <Stack screenOptions={{ ...motion, headerShown: false, gestureEnabled: false, orientation: "default" }} />;
}
