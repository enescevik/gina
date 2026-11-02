import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { emptyNotebook, readNotebook } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { p, SatinButton } from "@/components/planner/ui";
import { NotebookPage } from "./notebook-page";

export function ChildReviewFeedback({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const [open, setOpen] = useState(false), [width, setWidth] = useState(300);
  const feedback = useQuery({
    queryKey: [
      "child_answer_reviews",
      claims?.family_id,
      claims?.child_id,
      attemptId,
    ],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_child_answer_reviews", {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
      return data as unknown as {
        question_id: string;
        position: number;
        feedback: string | null;
        score: number | null;
        document: unknown;
        answer_document: unknown;
        answer_text: string | null;
      }[];
    },
  });
  if (!feedback.data?.length && !feedback.error) return null;
  return (
    <View
      style={{ gap: 12 }}
      onLayout={(e) => setWidth(Math.min(700, e.nativeEvent.layout.width))}
    >
      <SatinButton
        title={t(
          open ? "parentReview.hideFeedback" : "parentReview.showFeedback",
        )}
        secondary
        onPress={() => setOpen(!open)}
      />
      {open && feedback.error && (
        <SatinButton
          title={t("common.retry")}
          secondary
          onPress={() => void feedback.refetch()}
        />
      )}
      {open && feedback.data?.map((item) => {
        const original = readNotebook(item.answer_document),
          notes = readNotebook(item.document);
        return (
          <View key={item.question_id} style={{ gap: 12, paddingVertical: 16 }}>
            <Text
              style={{
                fontFamily: "Nunito_800ExtraBold",
                fontSize: 20,
                color: p.ink,
              }}
            >
              {t("parentReview.childFeedback")} · {item.position}
            </Text>
            {!!item.answer_text && (
              <Text style={{ fontFamily: "Nunito_600SemiBold", color: p.ink }}>
                {item.answer_text}
              </Text>
            )}
            <Text
              style={{
                fontFamily: "Nunito_700Bold",
                fontSize: 18,
                color: "#227D73",
              }}
            >
              {item.feedback}
            </Text>
            {item.answer_document != null && !original
              ? (
                <Text accessibilityRole="alert" style={{ color: p.ink }}>
                  {t("parentReview.unknownDocument")}
                </Text>
              )
              : notes && (
                <View style={{ width, height: width * 1.4 }}>
                  <NotebookPage
                    document={original ?? emptyNotebook()}
                    width={width}
                  />
                  <View style={{ position: "absolute", top: 0, left: 0 }}>
                    <NotebookPage
                      document={notes}
                      width={width}
                      grid={false}
                      transparent
                    />
                  </View>
                </View>
              )}
          </View>
        );
      })}
    </View>
  );
}
