import { focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { queryClient } from "./query";
import { supabase } from "./supabase";

/** Native apps have no browser focus/online events. Pause token refresh in background, refetch on return. */
export function useAppLifecycle() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    let live = true; let networkChanged = false;
    const updateNetwork = (state: Network.NetworkState) => {
      if (live && typeof state.isConnected === "boolean") onlineManager.setOnline(state.isConnected && state.isInternetReachable !== false);
    };
    const network = Network.addNetworkStateListener(state => { networkChanged = true; updateNetwork(state); });
    void Network.getNetworkStateAsync().then(state => { if (!networkChanged) updateNetwork(state); }).catch(() => undefined);
    const updateFocus = (state: string | null | undefined) => {
      const active = state === "active";
      focusManager.setFocused(active);
      if (active) {
        void supabase.auth.startAutoRefresh().catch(() => undefined);
        void queryClient.invalidateQueries({ queryKey: ["push-permission"] });
      } else void supabase.auth.stopAutoRefresh().catch(() => undefined);
    };
    updateFocus(AppState.currentState);
    const app = AppState.addEventListener("change", updateFocus);
    return () => { live = false; network.remove(); app.remove(); void supabase.auth.stopAutoRefresh().catch(() => undefined); };
  }, []);
}
