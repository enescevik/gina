import { useEffect, useRef, useState, type ComponentRef } from "react";
import { usePreventRemove } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Minus, Plus, X } from "lucide-react-native";
import {
  localDateOf,
  taskTemplateInputSchema,
  type IsoWeekday,
} from "@gina/core";
import { Avatar } from "@/components/avatar";
import { TASK_ICON_SLUGS } from "@/components/task-icon";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { IconButton, SatinButton, p, u } from "@/components/planner/ui";
import type { PlannerChild } from "@/components/planner/timetable-editor";
import { supabase } from "@/lib/supabase";
import { TaskTile, StarReward } from "./task-visuals";
const DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const FAVORITES = [
  "brush-teeth",
  "read-book",
  "tidy-room",
  "get-dressed",
  "water-plants",
];
export function TaskForm({
  child,
  familyId,
  timeZone,
  onClose,
  onCreated,
}: {
  child: PlannerChild;
  familyId: string;
  timeZone: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const cache = useQueryClient();
  const [title, setTitle] = useState("");
  const [stars, setStars] = useState(1);
  const [days, setDays] = useState<IsoWeekday[]>([1, 2, 3, 4, 5]);
  const [icon, setIcon] = useState("task-custom");
  const [allIcons, setAllIcons] = useState(false);
  const [error, setError] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const saving = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const dirty =
    title !== "" ||
    stars !== 1 ||
    icon !== "task-custom" ||
    days.join(",") !== "1,2,3,4,5";
  const add = useMutation({
    mutationFn: async () => {
      const parsed = taskTemplateInputSchema.safeParse({
        child_id: child.id,
        title,
        icon,
        stars,
        days_of_week: days,
        starts_on: localDateOf(new Date(), timeZone),
      });
      if (!parsed.success) throw Error("invalid");
      const { error } = await supabase
        .from("task_templates")
        .insert({ ...parsed.data, family_id: familyId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["parent_task_templates", familyId, child.id],
        }),
        cache.invalidateQueries({ queryKey: ["task_templates", child.id] }),
        cache.invalidateQueries({
          queryKey: ["family_task_templates", familyId],
        }),
      ]);
      onCreated();
    },
    onError: (e) =>
      setError(
        t(
          e.message === "invalid"
            ? "taskPremium.invalid"
            : "taskPremium.saveError",
        ),
      ),
    onSettled: () => {
      saving.current = false;
    },
  });
  const busy = add.isPending;
  usePreventRemove(dirty || busy, ({ repeat }) => {
    if (!busy) {
      setLeave(() => repeat);
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function close() {
    if (busy) return;
    if (dirty) {
      setLeave(() => onClose);
      scroll.current?.scrollTo({ y: 0, animated: false });
    } else onClose();
  }
  function save() {
    if (saving.current) return;
    saving.current = true;
    setError("");
    add.mutate();
  }
  const summary =
    days.length === 7
      ? t("redesign.everyDay")
      : days.map((d) => t(`weekday.${d}`)).join(" · ");
  function iconChoice(slug: string) {
    return (
      <Pressable
        key={slug}
        accessibilityRole="button"
        accessibilityLabel={t(`taskIcon.${slug}`)}
        accessibilityState={{ selected: icon === slug }}
        onPress={() => setIcon(slug)}
        style={{
          padding: 3,
          borderRadius: 21,
          borderWidth: 2,
          borderColor: icon === slug ? p.purple : "transparent",
        }}
      >
        <TaskTile slug={slug} size={52} />
      </Pressable>
    );
  }
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={close}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#20195166",
            justifyContent: "center",
            padding: wide ? 24 : 0,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              width: "100%",
              maxWidth: 620,
              alignSelf: "center",
              maxHeight: "100%",
              height: wide ? Math.min(height - 96, 860) : undefined,
              flex: wide ? undefined : 1,
            }}
          >
            <View
              style={{
                backgroundColor: p.cream,
                borderRadius: wide ? 30 : 24,
                overflow: "hidden",
                flexShrink: 1,
                flex: 1,
              }}
            >
              <ScrollView
                ref={scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, gap: 14 }}
              >
                <View style={u.row}>
                  <Text accessibilityRole="header" style={[u.title, u.fill]}>
                    {t("tasks.new")}
                  </Text>
                  <IconButton
                    label={t("common.cancel")}
                    disabled={busy}
                    onPress={close}
                  >
                    <X color={p.ink} />
                  </IconButton>
                </View>
                {leave ? (
                  <View style={u.card}>
                    <Text style={u.heading}>{t("planner.discardTitle")}</Text>
                    <Text style={u.copy}>{t("planner.discardBody")}</Text>
                    <SatinButton
                      title={t("planner.keepEditing")}
                      onPress={() => setLeave(null)}
                    />
                    <SatinButton
                      secondary
                      title={t("planner.discard")}
                      onPress={() => {
                        const action = leave;
                        setLeave(null);
                        action();
                      }}
                    />
                  </View>
                ) : null}
                <View
                  pointerEvents={busy || leave ? "none" : "auto"}
                  style={{ gap: 18, opacity: leave ? 0.45 : 1 }}
                >
                  <View
                    style={[
                      u.row,
                      { justifyContent: "space-between", height: 84 },
                    ]}
                  >
                    <View style={[u.tag, { backgroundColor: p.mint }]}>
                      <Avatar slug={child.avatar} size={30} />
                      <Text style={u.bold}>
                        {t("taskPremium.forChild", { name: child.name })}
                      </Text>
                    </View>
                    <Image
                      accessible={false}
                      source={require("../../../../../packages/assets/brand/growing-friend/contextual/planner.png")}
                      style={{ height: 100, width: 145 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Field
                    label={t("taskPremium.title")}
                    placeholder={t("tasks.titlePlaceholder")}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={80}
                  />
                  <View style={{ gap: 8 }}>
                    <Text style={u.bold}>{t("taskPremium.icon")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={[u.row, { gap: 5 }]}>
                        {FAVORITES.map(iconChoice)}
                      </View>
                    </ScrollView>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: allIcons }}
                      onPress={() => setAllIcons(!allIcons)}
                      style={u.link}
                    >
                      <Text style={u.linkText}>
                        {t(
                          allIcons
                            ? "taskPremium.fewerIcons"
                            : "taskPremium.allIcons",
                        )}
                      </Text>
                    </Pressable>
                    {allIcons ? (
                      <View style={[u.row, { flexWrap: "wrap", gap: 5 }]}>
                        {TASK_ICON_SLUGS.filter(
                          (s) => !FAVORITES.includes(s),
                        ).map(iconChoice)}
                      </View>
                    ) : null}
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text style={u.bold}>{t("taskPremium.stars")}</Text>
                    <View
                      style={[
                        u.row,
                        {
                          justifyContent: "space-between",
                          backgroundColor: "#F0EBF8",
                          borderRadius: 20,
                          padding: 8,
                        },
                      ]}
                    >
                      <IconButton
                        label={t("taskPremium.lessStars")}
                        disabled={stars === 0}
                        onPress={() => setStars((v) => Math.max(0, v - 1))}
                      >
                        <Minus color={p.purple} />
                      </IconButton>
                      <Text
                        accessibilityLiveRegion="polite"
                        accessibilityLabel={t("room.starCount", { count: stars })}
                        style={u.title}
                      >
                        {stars}
                      </Text>
                      <IconButton
                        label={t("taskPremium.moreStars")}
                        disabled={stars === 10}
                        onPress={() => setStars((v) => Math.min(10, v + 1))}
                      >
                        <Plus color={p.purple} />
                      </IconButton>
                    </View>
                  </View>
                  <View style={{ gap: 10 }}>
                    <Text style={u.bold}>{t("taskPremium.whichDays")}</Text>
                    <View style={[u.row, { flexWrap: "wrap", gap: 2 }]}>
                      {DAYS.map((d) => (
                        <Pressable
                          key={d}
                          accessibilityRole="button"
                          accessibilityLabel={t(`planner.day${d}`)}
                          accessibilityState={{ selected: days.includes(d) }}
                          onPress={() =>
                            setDays((prev) =>
                              prev.includes(d)
                                ? prev.filter((v) => v !== d)
                                : [...prev, d].sort(),
                            )
                          }
                          style={{
                            minWidth: 48,
                            minHeight: 48,
                            borderRadius: 16,
                            padding: 8,
                            backgroundColor: days.includes(d)
                              ? p.purple
                              : "#F2EEF6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={[
                              u.bold,
                              {
                                color: days.includes(d) ? "#fff" : p.ink,
                                fontSize: 14,
                              },
                            ]}
                          >
                            {t(`weekday.${d}`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {!days.length ? (
                      <Text style={u.error}>{t("taskPremium.selectDay")}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      u.card,
                      { backgroundColor: "#F0EAFB", boxShadow: "none" },
                    ]}
                  >
                    <Text style={u.bold}>
                      {t("taskPremium.preview", { name: child.name })}
                    </Text>
                    <View style={u.row}>
                      <TaskTile slug={icon} />
                      <View style={[u.fill, { gap: 5 }]}>
                        <Text style={u.bold}>
                          {title.trim() || t("tasks.titlePlaceholder")}
                        </Text>
                        <Text style={u.small}>
                          {summary} · {t("room.starCount", { count: stars })}
                        </Text>
                        <StarReward count={stars} />
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={[u.error, { paddingHorizontal: 20, paddingVertical: 8 }]}
                >
                  {error}
                </Text>
              ) : null}
              <View style={u.footer}>
                <SatinButton
                  secondary
                  title={t("common.cancel")}
                  disabled={busy}
                  onPress={close}
                />
                <SatinButton
                  title={t("taskPremium.save")}
                  busy={busy}
                  disabled={busy || !title.trim() || !days.length || !!leave}
                  onPress={save}
                  style={u.fill}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
