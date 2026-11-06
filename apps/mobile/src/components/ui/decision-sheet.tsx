import type { ReactNode } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NOTEBOOK_MODAL_PROPS } from "@/components/learning/notebook-layout";
import { p, u } from "@/components/planner/ui";
import { useRouteMotion } from "@/lib/use-route-motion";

/** One orientation-neutral host for decisions that must remain visible above the canvas. */
export function DecisionSheet({ visible, title, children, onClose, footer }: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  // Q00-C12-12: azaltılmış hareket tercihinde pencere solmadan, anında açılır/kapanır.
  const { animation } = useRouteMotion();
  return (
    <Modal
      {...NOTEBOOK_MODAL_PROPS}
      visible={visible}
      transparent
      animationType={animation}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "rgba(32,25,81,.32)",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxWidth: 560,
            width: "100%",
            maxHeight: "100%",
            alignSelf: "center",
            backgroundColor: p.cream,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <Text
            accessibilityRole="header"
            style={[u.heading, { padding: 24, paddingBottom: 12 }]}
          >
            {title}
          </Text>
          <ScrollView
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 16 }}
          >
            {children}
          </ScrollView>
          {footer
            ? (
              <View
                style={{ padding: 16, borderTopWidth: 1, borderColor: p.line }}
              >
                {footer}
              </View>
            )
            : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
