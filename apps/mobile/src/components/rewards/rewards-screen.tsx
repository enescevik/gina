import { useSetupSources, SetupSourceLinks, SourceLoadError } from "@/components/setup/source-links";
import { GoalSetup } from "@/components/setup/goal-setup";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock3, GraduationCap, Heart, House, MoreHorizontal, Pause, Play, Plus } from "lucide-react-native";
import { Avatar } from "@/components/avatar";
import { Pressable } from "@/components/ui/pressable";
import { CountBadge, IconButton, SatinButton, p, u } from "@/components/planner/ui";
import { useSession } from "@/lib/session";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { RewardCost, RewardTile } from "./reward-visuals";
import { RewardForm } from "./reward-form";
type Action = "approve" | "decline" | "deliver" | "cancel";
export function RewardsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const cache = useQueryClient();
  const params = useLocalSearchParams<{ goal?: string; childId?: string }>();
  const [choosingGoal, setChoosingGoal] = useState(params.goal === "1");
  const [catalog, setCatalog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const actionLock = useRef(false);
  const toggleLock = useRef(false);
  const rewards = useQuery({
    queryKey: ["family_rewards_all", familyId], enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("family_rewards").select("id,title,icon,cost_stars,active").eq("family_id", familyId).order("cost_stars");
      if (error) throw error;
      return data;
    },
  });
  const requests = useQuery({
    queryKey: ["reward_requests", familyId], enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reward_requests").select("id,status,cost_snapshot,requested_at,family_rewards(title,icon),children(name,avatar)").eq("family_id", familyId).in("status", ["requested", "approved"]).order("requested_at");
      if (error) throw error;
      return data;
    },
  });
  const catalogKeys = [["family_rewards_all", familyId], ["family_rewards"], ["child_goal"]];
  const requestKeys = [["reward_requests", familyId], ["family_star_totals", familyId], ["star_events"], ["star_balance"], ["child_goal"]];
  useRealtimeInvalidate("family_rewards", familyId ? `family_id=eq.${familyId}` : null, catalogKeys);
  useRealtimeInvalidate("reward_requests", familyId ? `family_id=eq.${familyId}` : null, requestKeys);
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: Action }) => {
      const { data, error } = action === "approve" || action === "decline"
        ? await supabase.rpc("decide_reward_request", { p_request_id: id, p_approve: action === "approve" })
        : action === "deliver" ? await supabase.rpc("deliver_reward_request", { p_request_id: id })
          : await supabase.rpc("cancel_reward_request", { p_request_id: id });
      if (error) throw error;
      const expected = { approve: "approved", decline: "declined", deliver: "delivered", cancel: "cancelled" }[action];
      if (data?.status !== expected) throw Error("request_changed");
    },
    onSuccess: (_, { action }) => setNotice(t(`rewardPremium.done.${action}`)),
    onSettled: async () => {
      try { await Promise.all(requestKeys.map(queryKey => cache.invalidateQueries({ queryKey }))); }
      finally { actionLock.current = false; }
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("family_rewards").update({ active }).eq("id", id).eq("family_id", familyId).select("id").single();
      if (error) throw error;
    },
    onSuccess: (_, { active }) => setNotice(t(active ? "rewardPremium.resumed" : "rewardPremium.paused")),
    onSettled: async () => {
      try { await Promise.all(catalogKeys.map(queryKey => cache.invalidateQueries({ queryKey }))); }
      finally { toggleLock.current = false; }
    },
  });
  function takeAction(id: string, action: Action) {
    if (actionLock.current) return;
    actionLock.current = true; setNotice(""); act.mutate({ id, action });
  }
  const query = catalog ? rewards : requests;
  const nav = [
    { label: t("calendar.today"), Icon: House, path: "/parent" as const },
    { label: t("parent.calendar"), Icon: CalendarDays, path: "/parent/calendar" as const },
    { label: t("prova.title"), Icon: GraduationCap, path: "/parent/prova" as const },
    { label: t("planner.more"), Icon: MoreHorizontal, path: "/parent/menu" as const },
  ];
  const sources = useSetupSources("reward", (rewards.data ?? []).map(item=>item.id));
  return <SafeAreaView edges={['top', 'left', 'right']} style={u.root}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[u.content, { maxWidth: 1060, gap: 10, paddingTop: 4 }]}>
      <View style={u.topbar}>
        <Image source={require("../../../../../packages/assets/brand/growing-friend/logo.png")} style={u.logo} accessibilityLabel="Gina" resizeMode="contain" />
        <IconButton label={t("push.menu")} onPress={() => router.push("/parent/notifications")}><Bell size={22} color={p.purple} /></IconButton>
      </View>
      <View style={[u.hero, { minHeight: 112 }]}>
        <View style={u.fill}>
          <View style={u.row}><IconButton label={t("common.back")} onPress={() => router.canGoBack() ? router.back() : router.replace("/parent")}><ArrowLeft color={p.purple} /></IconButton><Text accessibilityRole="header" style={[u.title, { flexShrink: 1 }]}>{t("rewards.title")}</Text></View>
          <Text style={[u.copy, { marginTop: 8 }]}>{t("rewardPremium.subtitle")}</Text>
        </View>
        <View accessible={false} pointerEvents="none" style={u.heroArt}><View style={u.blob} /><Image source={require("../../../../../packages/assets/brand/growing-friend/contextual/reward.png")} resizeMode="contain" style={{ width: "100%", height: "100%" }} /></View>
      </View>
      <View style={[u.segment, { maxWidth: 560 }]}>
        {[false, true].map(value => {
          const label = t(value ? "rewardPremium.catalog" : "rewardPremium.requests");
          const count = value ? undefined : requests.data?.length;
          return <View key={String(value)} style={u.fill}>{catalog === value ? <SatinButton selected badge={count} title={label} onPress={() => {}} style={{ minHeight: 48, paddingHorizontal: 8 }} /> : <Pressable accessibilityRole="button" accessibilityState={{ selected: false }} onPress={() => { setCatalog(value); setNotice(""); }} style={{ minHeight: 54, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}><Text style={u.bold}>{label}</Text>{count !== undefined && <CountBadge count={count} />}</Pressable>}</View>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setChoosingGoal(true)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}><Heart size={22} color={p.purple}/><Text style={[u.bold, { color: p.purple }]}>{t("betaUx.chooseGoal")}</Text></Pressable>
      <SourceLoadError error={sources.error} retry={()=>void sources.refetch()}/>
      {notice ? <Text accessibilityLiveRegion="polite" style={u.small}>{notice}</Text> : null}
      {query.isLoading ? <ActivityIndicator accessibilityLabel={t("rewardPremium.loading")} color={p.purple} /> : null}
      {query.error ? <View style={u.card}><Text accessibilityRole="alert" style={u.error}>{t("rewardPremium.loadError")}</Text><SatinButton title={t("common.retry")} onPress={() => { void query.refetch(); }} /></View> : null}
      {!query.isLoading && !query.error && !query.data?.length ? <View style={u.card}><Text style={u.heading}>{t(catalog ? "rewardPremium.emptyCatalog" : "rewards.noRequests")}</Text><Text style={u.copy}>{t(catalog ? "rewardPremium.emptyCatalogBody" : "rewardPremium.emptyRequestsBody")}</Text>{!catalog ? <SatinButton secondary title={t("rewardPremium.openCatalog")} onPress={() => setCatalog(true)} /> : null}</View> : null}
      <View style={{ flexDirection: wide ? "row" : "column", flexWrap: "wrap", gap: 14 }}>
        {!catalog && !requests.error ? requests.data?.map(request => {
          const pending = request.status === "requested";
          const primary: Action = pending ? "approve" : "deliver";
          const secondary: Action = pending ? "decline" : "cancel";
          const acting = act.isPending && act.variables?.id === request.id;
          const statusColor = pending ? "#985212" : "#246455";
          const StatusIcon = pending ? Clock3 : CheckCircle2;
          return <View key={request.id} testID={`request-${request.id}`} style={[u.card, { width: wide ? "48.5%" : "100%", padding: 14, gap: 10 }]}>
            <View style={[u.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
              <View style={[u.row, { flexShrink: 1 }]}><Avatar slug={request.children?.avatar} size={36} /><Text style={[u.bold, { flexShrink: 1 }]}>{request.children?.name ?? t("rewardPremium.childFallback")}</Text></View>
              <View style={[u.row, { gap: 5, backgroundColor: pending ? "#FFF0CE" : p.mint, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 }]}><StatusIcon size={16} color={statusColor} /><Text style={[u.small, { color: statusColor }]}>{t(pending ? "rewardPremium.pending" : "rewardPremium.approved")}</Text></View>
            </View>
            <View style={u.row}><RewardTile slug={request.family_rewards?.icon ?? null} size={96} /><View style={[u.fill, { gap: 5 }]}><Text style={[u.bold, { fontSize: 19 }]}>{request.family_rewards?.title ?? t("rewards.title")}</Text><RewardCost count={request.cost_snapshot} /></View></View>
            {act.error && act.variables?.id === request.id ? <Text accessibilityRole="alert" style={u.error}>{t(act.error.message.includes("insufficient_stars") ? "rewardPremium.insufficientStars" : act.error.message === "request_changed" ? "rewardPremium.requestChanged" : "rewardPremium.actionError")}</Text> : null}
            <View style={[u.row, { alignItems: "stretch", flexDirection: width < 360 ? "column" : "row" }]}>
              <SatinButton style={width < 360 ? undefined : { flex: 1.15, paddingHorizontal: 10 }} title={t(pending ? "parent.approve" : "rewards.deliver")} busy={acting && act.variables?.action === primary} disabled={act.isPending} onPress={() => takeAction(request.id, primary)} />
              <SatinButton style={width < 360 ? undefined : { flex: 1, paddingHorizontal: 8 }} secondary title={t(pending ? "rewards.decline" : "rewardPremium.cancelRefund")} busy={acting && act.variables?.action === secondary} disabled={act.isPending} onPress={() => takeAction(request.id, secondary)} />
            </View>
          </View>;
        }) : null}
        {catalog && !rewards.error ? rewards.data?.map(reward => <View key={reward.id} testID={`reward-${reward.id}`} style={[u.card, { width: wide ? "48.5%" : "100%", padding: 14 }]}>
          <View style={u.row}><RewardTile slug={reward.icon} size={96} /><View style={[u.fill, { gap: 6 }]}><Text style={[u.bold, { fontSize: 19 }]}>{reward.title}</Text><RewardCost count={reward.cost_stars} /><View style={[u.row, { justifyContent: "space-between", flexWrap: "wrap", gap: 4 }]}>
            <Text style={[u.small, { backgroundColor: reward.active ? p.purple : p.lilac, color: reward.active ? "#FFFFFF" : p.muted, borderRadius: 22, minWidth: 74, textAlign: "center", paddingHorizontal: 12, paddingVertical: 10 }]}>{t(reward.active ? "rewardPremium.active" : "rewardPremium.inactive")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t(reward.active ? "rewardPremium.pauseNamed" : "rewardPremium.resumeNamed", { title: reward.title })} accessibilityState={{ disabled: toggle.isPending, busy: toggle.isPending && toggle.variables?.id === reward.id }} disabled={toggle.isPending} onPress={() => { if (toggleLock.current) return; toggleLock.current = true; setNotice(""); toggle.mutate({ id: reward.id, active: !reward.active }); }} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 10, borderRadius: 24, backgroundColor: p.lilac, opacity: pressed ? .65 : 1, flexDirection: "row", alignItems: "center", gap: 5 })}>
              {toggle.isPending && toggle.variables?.id === reward.id ? <ActivityIndicator color={p.purple} /> : reward.active ? <Pause size={16} color={p.purple} /> : <Play size={16} color={p.purple} />}<Text style={[u.bold, { fontSize: 14, color: p.purple }]}>{t(reward.active ? "taskPremium.pause" : "taskPremium.resume")}</Text>
            </Pressable>
          </View></View></View>
          <SetupSourceLinks sources={(sources.data??[]).filter(s=>s.item_id===reward.id)}/>
          {toggle.error && toggle.variables?.id === reward.id ? <Text accessibilityRole="alert" style={u.error}>{t("rewardPremium.toggleError")}</Text> : null}
        </View>) : null}
      </View>
      {!query.error && !query.isLoading ? <View style={[u.row, { backgroundColor: "#F0EBFA", padding: 16, borderRadius: 22, justifyContent: "center" }]}><Heart size={23} color={p.purple} /><Text style={[u.copy, { flexShrink: 1 }]}>{t(catalog ? "rewardPremium.catalogHint" : "rewardPremium.requestHint")}</Text></View> : null}
    </ScrollView>
    <View style={{ paddingHorizontal: 18, paddingVertical: 8 }}><SatinButton title={t("rewardPremium.new")} disabled={!familyId} icon={<Plus size={24} color="#fff" />} onPress={() => { setNotice(""); setCreating(true); }} style={{ width: "100%", maxWidth: 560, alignSelf: "center" }} /></View>
    <View style={[u.footer, { paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6), justifyContent: "space-around" }]}>{nav.map(({ label, Icon, path }) => <Pressable key={path} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.navigate(path)} style={{ flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 3 }}><Icon size={23} color={p.muted} /><Text style={u.small}>{label}</Text></Pressable>)}</View>
    {choosingGoal && <GoalSetup onCreateReward={() => { setChoosingGoal(false); setCreating(true); }} initialChild={params.childId} onClose={() => setChoosingGoal(false)} onSaved={() => { setChoosingGoal(false); setNotice(t("betaUx.goalSaved")); }}/>}
    {creating ? <RewardForm familyId={familyId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setCatalog(true); setNotice(t("rewardPremium.created")); }} /> : null}
  </SafeAreaView>;
}
