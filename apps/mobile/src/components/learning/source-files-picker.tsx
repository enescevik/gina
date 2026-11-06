import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Linking, Text, View } from "react-native";
import {
  ArrowUp,
  Camera,
  Files,
  FileText,
  Images,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { readSourceLimits } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import {
  chooseLearningFiles,
  learningFileSet,
  type LearningPickSource,
  type LocalLearningFile,
} from "@/lib/learning-files";
import { IconButton, p, SatinButton, u } from "@/components/planner/ui";

export function SourceFilesPicker({
  value,
  onChange,
  disabled = false,
  onBusyChange,
}: {
  value: LocalLearningFile | null;
  onChange: (v: LocalLearningFile | null) => void;
  disabled?: boolean;
  onBusyChange?: (v: boolean) => void;
}) {
  const { t } = useTranslation(), { claims, session } = useSession();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const gate = useRef(false);
  const policy = useQuery({
    queryKey: ["learning_source_policy", session?.user.id, claims?.family_id],
    queryFn: async () => {
      const r = await supabase.rpc("get_learning_source_policy");
      if (r.error) throw r.error;
      // C08: sınırlar sunucuyla aynı okuyucudan (yönetimde değişen dosya sayısı/toplam bayt ikisinde de aynı).
      const data = r.data as { enabled?: boolean } | null;
      return { enabled: data?.enabled === true, ...readSourceLimits(data) };
    },
  });
  const max = policy.data?.max_files ?? 5,
    files = value?.members ?? (value ? [value] : []),
    locked = disabled || busy;
  const replace = (next: LocalLearningFile[]) => {
    setError("");
    onChange(learningFileSet(next));
  };
  async function pick(kind: LearningPickSource) {
    if (gate.current || locked || !policy.data?.enabled) return;
    gate.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const added = await chooseLearningFiles(kind, max - files.length);
      if (!added.length) return;
      const seen = new Set(files.map((f) => f.sha256));
      const unique = added.filter((f) => {
        if (seen.has(f.sha256)) return false;
        seen.add(f.sha256);
        return true;
      });
      if (
        [...files, ...unique].reduce((n, f) => n + f.bytes.byteLength, 0) >
          (policy.data?.max_total_bytes ?? 20971520)
      ) throw Error("source_size_or_type");
      if (unique.length) replace([...files, ...unique]);
      if (unique.length !== added.length) setError("duplicate");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        message === "source_camera_permission"
          ? "permission"
          : message === "source_file_limit"
          ? "limit"
          : message === "source_size_or_type"
          ? "size"
          : "failed",
      );
    } finally {
      gate.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <View style={{ gap: 12, minWidth: 0 }}>
      <Text style={u.bold}>{t("sourcePicker.title")}</Text>
      <Text style={u.small}>{t("sourcePicker.help", { max })}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {([["files", Files], ["gallery", Images], ["camera", Camera]] as const)
          .map(([kind, Icon]) => (
            <SatinButton
              key={kind}
              secondary
              title={t(`sourcePicker.${kind}`)}
              icon={<Icon color={p.purple} size={20} />}
              disabled={locked || files.length >= max || !policy.data?.enabled}
              onPress={() => void pick(kind)}
            />
          ))}
      </View>
      {files.map((f, i) => (
        <View
          key={f.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 10,
            backgroundColor: p.lilac,
            borderRadius: 18,
          }}
        >
          {f.mime === "application/pdf"
            ? <FileText size={40} color={p.purple} />
            : (
              <Image
                source={{ uri: f.uri }}
                style={{ width: 52, height: 60, borderRadius: 8 }}
                contentFit="contain"
                accessibilityLabel={f.name}
              />
            )}
          <Text style={[u.small, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
            {i + 1}. {f.name}
          </Text>
          {i > 0
            ? (
              <IconButton
                label={t("sourcePicker.up", { name: f.name })}
                disabled={locked}
                onPress={() => {
                  const next = [...files];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  replace(next);
                }}
              >
                <ArrowUp size={20} color={p.purple} />
              </IconButton>
            )
            : null}
          <IconButton
            label={t("sourcePicker.remove", { name: f.name })}
            disabled={locked}
            onPress={() => replace(files.filter((_, n) => n !== i))}
          >
            <X size={20} color={p.purple} />
          </IconButton>
        </View>
      ))}
      <Text style={u.small}>
        {t("sourcePicker.count", { count: files.length, max })}
      </Text>
      {files.length
        ? <Text style={u.small}>{t("sourcePicker.cost")}</Text>
        : null}
      {error
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t(`sourcePicker.${error}`, { max })}
          </Text>
        )
        : null}
      {error === "permission"
        ? (
          <SatinButton
            secondary
            title={t("sourcePicker.settings")}
            onPress={() =>
              void Linking.openSettings().catch(() => setError("failed"))}
          />
        )
        : null}
      {policy.data && !policy.data.enabled
        ? <Text style={u.small}>{t("sources.unavailable")}</Text>
        : null}
      {policy.error
        ? (
          <SatinButton
            secondary
            title={t("common.retry")}
            onPress={() => void policy.refetch()}
          />
        )
        : null}
    </View>
  );
}
