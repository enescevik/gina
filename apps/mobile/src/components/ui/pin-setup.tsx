import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Field } from "./field";
import { Button } from "./button";
import { ErrorText } from "./screen";
import { parentStyles } from "./parent-screen";

/** PINs stay only in component memory and are cleared after a confirmed save. */
export function PinSetup({ childId, name, onState }: {
  childId?: string;
  name?: string;
  onState?: (state: { dirty: boolean; busy: boolean }) => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const sending = useRef(false);
  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error } = childId
        ? await supabase.rpc("set_child_pin", {
          p_child_id: childId,
          p_pin: value,
        })
        : await supabase.rpc("set_parent_pin", { p_pin: value });
      if (error) throw error;
    },
    onSuccess: () => {
      setPin("");
      setConfirmation("");
      void cache.invalidateQueries({ queryKey: ["device_access"] });
      void cache.invalidateQueries({ queryKey: ["parent_pin_set"] });
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const dirty = !!(pin || confirmation);
  useEffect(() => {
    onState?.({ dirty, busy: save.isPending });
  }, [dirty, save.isPending, onState]);
  useEffect(() => () => {
    onState?.({ dirty: false, busy: false });
  }, [onState]);
  const valid = /^\d{4}$/.test(pin) && pin === confirmation;
  return (
    <View style={{ gap: 12 }}>
      <Text style={parentStyles.muted}>
        {t(childId ? "unified.childPinHelp" : "unified.parentPinHelp")}
      </Text>
      <Field
        label={t(childId ? "parentV5.childPinLabel" : "parentV5.newParentPin", {
          name,
        })}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        autoComplete="off"
        editable={!save.isPending}
        value={pin}
        onChangeText={(value) => {
          setPin(value.replace(/\D/g, ""));
          save.reset();
        }}
      />
      <Field
        label={t("experience.confirmPin")}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        autoComplete="off"
        editable={!save.isPending}
        value={confirmation}
        error={confirmation.length === 4 && confirmation !== pin
          ? t("experience.pinMismatch")
          : null}
        onChangeText={(value) => {
          setConfirmation(value.replace(/\D/g, ""));
          save.reset();
        }}
      />
      <Button
        variant="secondary"
        title={t("parent.savePin")}
        loading={save.isPending}
        disabled={!valid}
        onPress={() => {
          if (!valid || sending.current) return;
          sending.current = true;
          save.mutate(pin);
        }}
      />
      {dirty
        ? (
          <Button
            variant="ghost"
            title={t("experience.clearPin")}
            disabled={save.isPending}
            onPress={() => {
              setPin("");
              setConfirmation("");
              save.reset();
            }}
          />
        )
        : null}
      {save.isSuccess
        ? (
          <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>
            {t("unified.pinSaved")}
          </Text>
        )
        : null}
      <ErrorText error={save.error} />
    </View>
  );
}
