import { AiSuggestions } from "./ai-suggestions";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Avatar, CHILD_AVATAR_SLUGS } from "@/components/avatar";
import { Field } from "@/components/ui/field";
import { Pressable } from "@/components/ui/pressable";
import { IconButton, p, u } from "@/components/planner/ui";
import { TaskTile } from "@/components/tasks/task-visuals";
import { SetupWizard, ChoiceCard } from "./wizard";
import { TASK_STARTERS } from "./templates";
export type SetupChild = {
  id: string;
  name: string;
  avatar: string | null;
  grade: number | null;
  birth_year: number | null;
  gender: string;
  interests: string[];
};
const INTERESTS = ["reading", "science", "art", "music", "sports", "nature"];
export function ChildSetup({
  child,
  onClose,
  onSaved,
}: {
  child?: SetupChild;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(child?.name ?? "");
  const [avatar, setAvatar] = useState(child?.avatar ?? "avatar-default");
  const [year, setYear] = useState(
    child?.birth_year ? String(child.birth_year) : "",
  );
  const [grade, setGrade] = useState<number | null>(child?.grade ?? null);
  const [gender, setGender] = useState(child?.gender ?? "unspecified");
  const [interests, setInterests] = useState(child?.interests ?? []);
  const [tasks, setTasks] = useState(() =>
    TASK_STARTERS.map((item) => ({
      id: String(item.id),
      title: t(`betaUx.taskTemplates.${item.id}`),
      icon: String(item.icon),
      stars: Number(item.stars),
      days: [...item.days] as number[],
      selected: false,
    })),
  );
  const saving = useRef(false);
  const request = useRef({ id: randomUUID(), payload: "" });
  const currentYear = new Date().getFullYear();
  const validYear =
    /^\d{4}$/.test(year) &&
    Number(year) >= currentYear - 18 &&
    Number(year) <= currentYear - 2;
  const dirty =
    name !== (child?.name ?? "") ||
    year !== (child?.birth_year ? String(child.birth_year) : "") ||
    avatar !== (child?.avatar ?? "avatar-default") ||
    grade !== (child?.grade ?? null) ||
    gender !== (child?.gender ?? "unspecified") ||
    interests.join() !== (child?.interests ?? []).join() ||
    tasks.some((task) => task.selected);
  const selectedTasks = tasks.filter((task) => task.selected);
  const valid =
    step === 0
      ? !!name.trim()
      : step === 1
        ? validYear
        : selectedTasks.every(
            (task) => !!task.title.trim() && task.days.length > 0,
          );
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !validYear || !valid) throw Error("invalid_profile");
      const profile = {
        name: name.trim(),
        avatar,
        birth_year: Number(year),
        grade,
        gender,
        interests,
      };
      const starters = child
        ? []
        : selectedTasks.map(({ title, icon, stars, days }) => ({
            title,
            icon,
            stars,
            days,
          }));
      const payload = JSON.stringify({ profile, starters });
      if (request.current.payload && request.current.payload !== payload)
        request.current.id = randomUUID();
      request.current.payload = payload;
      const { error } = await supabase.rpc("save_child_setup", {
        p_request_id: request.current.id,
        p_profile: profile,
        p_tasks: starters,
        ...(child ? { p_child_id: child.id } : {}),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries();
      onSaved();
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const steps = [
    t("betaUx.profile"),
    t("betaUx.school"),
    ...(!child ? [t("betaUx.routines")] : []),
    t("betaUx.review"),
  ];
  const review = step === steps.length - 1;
  return (
    <SetupWizard
      title={t(child ? "betaUx.editChild" : "parent.addChild")}
      steps={steps}
      step={step}
      setStep={setStep}
      dirty={dirty}
      busy={save.isPending}
      valid={valid}
      onClose={onClose}
      saveLabel={t("common.save")}
      onSave={() => {
        if (saving.current) return;
        saving.current = true;
        save.mutate();
      }}
      error={
        save.error
          ? t(
              save.error.message.includes("plan_limit")
                ? "betaUx.planLimit"
                : save.error.message.includes("education_use_transition")
                  ? "education.profileGradeHelp"
                  : "betaUx.childSaveError",
            )
          : null
      }
    >
      {step === 0 && (
        <>
          <Text style={u.heading}>{t("betaUx.meetChild")}</Text>
          <Text style={u.copy}>{t("betaUx.childPrivacy")}</Text>
          <Field
            label={t("betaUx.childName")}
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
          <Text style={u.bold}>{t("betaUx.avatar")}</Text>
          <View style={[u.row, { flexWrap: "wrap" }]}>
            {CHILD_AVATAR_SLUGS.map((slug, i) => (
              <Pressable
                key={slug}
                accessibilityRole="button"
                accessibilityLabel={t("parentV5.avatarLabel", {
                  number: i + 1,
                })}
                accessibilityState={{ selected: avatar === slug }} aria-pressed={avatar === slug}
                onPress={() => setAvatar(slug)}
                style={{
                  padding: 3,
                  borderRadius: 40,
                  borderWidth: 2,
                  borderColor: avatar === slug ? p.purple : "transparent",
                }}
              >
                <Avatar slug={slug} size={56} />
              </Pressable>
            ))}
          </View>
        </>
      )}
      {step === 1 && (
        <>
          <Text style={u.heading}>{t("betaUx.childLearning")}</Text>
          <Field
            label={t("betaUx.birthYear")}
            value={year}
            onChangeText={(value) => setYear(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={u.small}>{t("betaUx.birthYearHelp")}</Text>
          {year.length === 4 && !validYear && (
            <Text style={u.error}>
              {t("betaUx.birthYearError", {
                min: currentYear - 18,
                max: currentYear - 2,
              })}
            </Text>
          )}
          {child ? (
            <Text style={u.copy}>{t("education.profileGradeHelp")}</Text>
          ) : (
            <>
              <Text style={u.bold}>{t("betaUx.grade")}</Text>
              <View style={[u.row, { flexWrap: "wrap" }]}>
                {[null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                  (value) => (
                    <Pressable
                      key={String(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: grade === value }} aria-pressed={grade === value}
                      onPress={() => {
                        setGrade(value);
                        if (!value)
                          setTasks(
                            tasks.map((item) =>
                              item.id === "bag"
                                ? { ...item, selected: false }
                                : item,
                            ),
                          );
                      }}
                      style={{
                        minHeight: 48,
                        minWidth: 48,
                        padding: 12,
                        borderRadius: 16,
                        justifyContent: "center",
                        backgroundColor: grade === value ? p.purple : p.lilac,
                      }}
                    >
                      <Text
                        style={[
                          u.bold,
                          { color: grade === value ? "#fff" : p.ink },
                        ]}
                      >
                        {value === null
                          ? t("betaUx.noSchool")
                          : value === 0
                            ? t("betaUx.preschool")
                            : String(value)}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </>
          )}
          <Text style={u.bold}>{t("betaUx.gender")}</Text>
          <View style={[u.row, { flexWrap: "wrap" }]}>
            {["unspecified", "girl", "boy"].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: gender === value }} aria-pressed={gender === value}
                onPress={() => setGender(value)}
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: gender === value ? p.mint : "#fff",
                }}
              >
                <Text style={u.bold}>{t(`betaUx.genders.${value}`)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={u.bold}>{t("betaUx.interests")}</Text>
          <View style={[u.row, { flexWrap: "wrap" }]}>
            {INTERESTS.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: interests.includes(value) }} aria-pressed={interests.includes(value)}
                onPress={() =>
                  setInterests(
                    interests.includes(value)
                      ? interests.filter((v) => v !== value)
                      : [...interests, value],
                  )
                }
                style={{
                  minHeight: 48,
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: interests.includes(value) ? p.purple : p.line,
                  backgroundColor: interests.includes(value) ? p.lilac : "#fff",
                }}
              >
                <Text style={u.bold}>{t(`betaUx.interest.${value}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {!child && step === 2 && (
        <>
          <Text style={u.heading}>{t("betaUx.firstRoutines")}</Text>
          <Text style={u.copy}>{t("betaUx.routinesBody")}</Text>
          {tasks
            .filter((task) => task.id !== "bag" || (grade ?? 0) > 0)
            .map((task) => (
              <View key={task.id} style={{ gap: 8 }}>
                <ChoiceCard
                  title={
                    task.id === "reading" &&
                    !task.selected &&
                    currentYear - Number(year) < 6
                      ? t("betaUx.readTogether")
                      : task.title
                  }
                  body={t("room.starCount", { count: task.stars })}
                  art={<TaskTile slug={task.icon} size={56} />}
                  selected={task.selected}
                  onPress={() =>
                    setTasks(
                      tasks.map((item) =>
                        item.id === task.id
                          ? {
                              ...item,
                              selected: !item.selected,
                              title:
                                item.id === "reading" &&
                                !item.selected &&
                                currentYear - Number(year) < 6
                                  ? t("betaUx.readTogether")
                                  : item.title,
                            }
                          : item,
                      ),
                    )
                  }
                />
                {task.selected && (
                  <View style={[u.card, { marginBottom: 10 }]}>
                    <Field
                      label={t("betaUx.taskName")}
                      maxLength={80}
                      value={task.title}
                      onChangeText={(title) =>
                        setTasks(
                          tasks.map((item) =>
                            item.id === task.id ? { ...item, title } : item,
                          ),
                        )
                      }
                    />
                    <View style={u.row}>
                      <Text style={[u.copy, u.fill]}>
                        {t("betaUx.taskStars")}
                      </Text>
                      <IconButton
                        label={t("taskPremium.lessStars")}
                        disabled={task.stars === 0}
                        onPress={() =>
                          setTasks(
                            tasks.map((item) =>
                              item.id === task.id
                                ? { ...item, stars: item.stars - 1 }
                                : item,
                            ),
                          )
                        }
                      >
                        <Minus color={p.purple} />
                      </IconButton>
                      <Text style={u.bold}>{task.stars}</Text>
                      <IconButton
                        label={t("taskPremium.moreStars")}
                        disabled={task.stars === 10}
                        onPress={() =>
                          setTasks(
                            tasks.map((item) =>
                              item.id === task.id
                                ? { ...item, stars: item.stars + 1 }
                                : item,
                            ),
                          )
                        }
                      >
                        <Plus color={p.purple} />
                      </IconButton>
                    </View>
                    <View style={[u.row, { flexWrap: "wrap", gap: 4 }]}>
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <Pressable
                          key={day}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: task.days.includes(day),
                          }} aria-pressed={task.days.includes(day)}
                          onPress={() =>
                            setTasks(
                              tasks.map((item) =>
                                item.id === task.id
                                  ? {
                                      ...item,
                                      days: item.days.includes(day)
                                        ? item.days.filter((d) => d !== day)
                                        : [...item.days, day].sort(),
                                    }
                                  : item,
                              ),
                            )
                          }
                          style={{
                            minWidth: 48,
                            minHeight: 48,
                            padding: 8,
                            borderRadius: 14,
                            backgroundColor: task.days.includes(day)
                              ? p.mint
                              : p.lilac,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={u.small}>{t(`weekday.${day}`)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          <AiSuggestions
            kind="task"
            age={currentYear - Number(year)}
            grade={grade}
            interests={interests}
            onChoose={(items) => {
              setTasks((prev) => [
                ...prev.filter((task) => !task.id.startsWith("ai-")),
                ...items.map((item, index) => ({
                  id: `ai-${index}`,
                  title: item.title,
                  icon: item.icon,
                  stars: item.stars,
                  days: [1, 2, 3, 4, 5],
                  selected: true,
                })),
              ]);
            }}
          />
        </>
      )}
      {review && (
        <>
          <Text style={u.heading}>{t("betaUx.childReady")}</Text>
          <View style={[u.card, { backgroundColor: p.lilac }]}>
            <View style={u.row}>
              <Avatar slug={avatar} size={80} />
              <View style={u.fill}>
                <Text style={u.heading}>{name}</Text>
                <Text style={u.copy}>
                  {t("betaUx.age", { count: currentYear - Number(year) })} ·{" "}
                  {grade === null
                    ? t("betaUx.noSchool")
                    : grade === 0
                      ? t("betaUx.preschool")
                      : t("parent.gradeShort", { grade })}
                </Text>
              </View>
            </View>
            {interests.length > 0 && (
              <Text style={u.copy}>
                {interests
                  .map((item) => t(`betaUx.interest.${item}`))
                  .join(" · ")}
              </Text>
            )}
          </View>
          {!child && (
            <Text style={u.copy}>
              {t("betaUx.selectedRoutines", { count: selectedTasks.length })}
            </Text>
          )}
          {selectedTasks.map((task) => (
            <View key={task.id} style={u.row}>
              <TaskTile slug={task.icon} size={56} />
              <View style={u.fill}>
                <Text style={u.bold}>{task.title}</Text>
                <Text style={u.small}>
                  {task.days.map((day) => t(`weekday.${day}`)).join(" · ")} ·{" "}
                  {t("room.starCount", { count: task.stars })}
                </Text>
              </View>
            </View>
          ))}
          <Text style={u.small}>{t("betaUx.childAfterSave")}</Text>
        </>
      )}
    </SetupWizard>
  );
}
