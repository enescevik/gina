import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  EDUCATION_STAGES,
  educationPlaceLabel,
  type EducationCatalog,
  type EducationCalendarPreview,
  type EducationStage,
} from "@gina/core";
import { Field } from "@/components/ui/field";
import { ChoiceCard } from "@/components/setup/wizard";
import { p, u, SatinButton } from "@/components/planner/ui";

export function CalendarContext({
  catalog,
  placeId,
  stage,
  onPlace,
  onStage,
  fixedStage,
  preview,
  loading,
  failed,
  onRetry,
  reason,
  detail,
  onReason,
  onDetail,
}: {
  catalog: EducationCatalog | undefined;
  placeId: string;
  stage: EducationStage;
  fixedStage: boolean;
  onPlace: (id: string, school: string | null) => void;
  onStage: (stage: EducationStage) => void;
  preview: EducationCalendarPreview | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  reason: string | null;
  detail: string;
  onReason: (v: string) => void;
  onDetail: (v: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value + "T12:00:00Z"));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const places = catalog?.places ?? [];
  const current = places.find((x) => x.id === placeId);
  const matched = places
    .filter((x) =>
      educationPlaceLabel(x, places)
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
    )
    .slice(0, 15);
  return (
    <View style={{ gap: 12 }}>
      <Text style={u.heading}>{t("schoolCalendar.title")}</Text>
      <Text style={u.copy}>{t("schoolCalendar.explanation")}</Text>
      <View style={[u.card, { backgroundColor: p.lilac }]}>
        <Text style={u.bold}>
          {current
            ? educationPlaceLabel(current, places)
            : t("schoolCalendar.selectPlace")}
        </Text>
        <Text style={u.small}>{t(`schoolCalendar.stage.${stage}`)}</Text>
        <SatinButton
          secondary
          title={t(
            editing
              ? "schoolCalendar.closeSelection"
              : "schoolCalendar.selectPlace",
          )}
          onPress={() => setEditing(!editing)}
        />
      </View>
      {editing && (
        <>
          <Field
            label={t("schoolCalendar.searchPlace")}
            value={search}
            onChangeText={setSearch}
            maxLength={120}
          />
          <Text style={u.small}>{t("schoolCalendar.unknownSchool")}</Text>
          {matched.map((place) => (
            <ChoiceCard
              key={place.id}
              title={place.name}
              body={educationPlaceLabel(place, places)}
              selected={place.id === placeId}
              onPress={() => {
                onPlace(place.id, place.kind === "school" ? place.name : null);
                setEditing(false);
              }}
            />
          ))}
          {!matched.length && (
            <Text style={u.copy}>{t("schoolCalendar.noPlace")}</Text>
          )}
          {places.length > 15 && (
            <Text style={u.small}>{t("schoolCalendar.searchMore")}</Text>
          )}
        </>
      )}
      {!fixedStage &&
        EDUCATION_STAGES.map((value) => (
          <ChoiceCard
            key={value}
            title={t(`schoolCalendar.stage.${value}`)}
            selected={value === stage}
            onPress={() => onStage(value)}
          />
        ))}
      {loading && <Text style={u.copy}>{t("common.loading")}</Text>}
      {failed && (
        <>
          <Text style={u.error}>{t("schoolCalendar.loadError")}</Text>
          <SatinButton secondary title={t("common.retry")} onPress={onRetry} />
        </>
      )}
      {preview?.calendar && (
        <View style={[u.card, { backgroundColor: p.mint }]}>
          <Text style={u.bold}>{preview.calendar.value.title}</Text>
          <Text style={u.copy}>{preview.calendar.place_name}</Text>
          <Text style={u.small}>
            {formatDate(preview.calendar.value.starts_on)} —{" "}
            {formatDate(preview.calendar.value.ends_on)}
          </Text>
          {preview.calendar.value.terms.map((term) => (
            <Text style={u.small} key={term.starts_on}>
              {term.title} · {formatDate(term.starts_on)} —{" "}
              {formatDate(term.ends_on)}
            </Text>
          ))}
          <SatinButton
            secondary
            title={t("schoolCalendar.source")}
            onPress={() =>
              void Linking.openURL(preview.calendar!.value.source_url).catch(
                () => {},
              )
            }
          />
        </View>
      )}
      {preview?.warning && (
        <View style={[u.card, { gap: 12, backgroundColor: p.lilac }]}>
          <Text accessibilityRole="alert" style={u.bold}>
            {t(`schoolCalendar.warning.${preview.warning}`)}
          </Text>
          <Text style={u.copy}>{t("schoolCalendar.allowOverride")}</Text>
          {[
            "school_calendar",
            "personal",
            "correction",
            ...(preview.warning === "calendar_missing"
              ? ["calendar_missing"]
              : []),
          ].map((value) => (
            <ChoiceCard
              key={value}
              title={t(`schoolCalendar.reason.${value}`)}
              selected={reason === value}
              onPress={() => onReason(value)}
            />
          ))}
          {reason === "school_calendar" && (
            <>
              <Field
                label={t("schoolCalendar.detail")}
                value={detail}
                onChangeText={onDetail}
                multiline
                maxLength={2000}
                placeholder={t("schoolCalendar.detailExample")}
              />
              <Text style={u.small}>{t("schoolCalendar.reportPrivacy")}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
