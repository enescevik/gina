import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react-native";
import type { SetupCommand } from "@gina/core";
import { p, u } from "@/components/planner/ui";
import { TaskTile, StarReward } from "@/components/tasks/task-visuals";
import { RewardTile, RewardCost } from "@/components/rewards/reward-visuals";

export function SetupSaveRecovery({ pending, blocked }: { pending: SetupCommand | null; blocked: boolean }) {
  const { t, i18n } = useTranslation();
  return <View style={{ gap: 16 }}>
    <View style={[u.card, { backgroundColor: p.lilac }]}>
      <RefreshCw color={p.purple} size={28} />
      <Text style={u.heading}>{t(blocked ? "setupRecovery.blockedTitle" : "setupRecovery.title")}</Text>
      <Text style={u.copy}>{t(blocked ? "setupRecovery.blockedBody" : "setupRecovery.body")}</Text>
    </View>
    {pending ? <Text style={u.bold}>{t("setupRecovery.count", { count: pending.p_items.length })}</Text> : null}
    {pending?.p_items.map((item, i) => <View key={i} style={u.card}>
      <View style={u.row}>
        {pending.p_kind === "task" ? <TaskTile slug={item.icon} size={56}/> : <RewardTile slug={item.icon} size={56}/>}
        <Text style={[u.bold, u.fill]}>{item.title}</Text>
        {pending.p_kind === "task" ? <StarReward count={item.stars}/> : <RewardCost count={item.stars}/>}
      </View>
      {pending.p_kind === "task" ? <Text style={u.small}>{item.days.map(day => t(`weekday.${day}`)).join(" · ")}{"\n"}{t("setupRecovery.starts", { date: item.starts_on ? new Date(item.starts_on + "T12:00:00Z").toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "" })}</Text> : null}
    </View>)}
  </View>;
}
