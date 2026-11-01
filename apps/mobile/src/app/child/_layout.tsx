import {useQuery} from "@tanstack/react-query";
import {supabase} from "@/lib/supabase";
import { Redirect, Stack, usePathname } from "expo-router";

import { useSession, refreshClaims } from "@/lib/session";
import { usePush } from "@/lib/push";

export default function ChildLayout() {
  // Push: eşleşmiş tablette izin + token kaydı, bildirime dokununca yönlendirme (web'de no-op).
  usePush("device");
  const { claims } = useSession();
  const path = usePathname();
  useQuery({queryKey:['device_session',claims?.device_id,claims?.child_id],enabled:claims?.role==='device',refetchInterval:30000,refetchIntervalInBackground:false,
    queryFn:async()=>{
      const {data,error}=await supabase.from('devices').select('id,active_child_id,revoked_at').eq('id',claims!.device_id!).maybeSingle();
      if(error)throw error;
      if(!data||data.revoked_at||data.active_child_id!==(claims?.child_id??null))await refreshClaims();
      return data;
    },
  });
  if (claims?.role !== "device") return <Redirect href="/" />;
  if (!claims.child_id && path !== "/child" && path !== "/child/pin") return <Redirect href="/child" />;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, orientation: "default" }} />;
}
