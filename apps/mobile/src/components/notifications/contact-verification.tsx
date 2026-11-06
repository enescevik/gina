import {
  channelErrorKey,
  contactLooksValid,
  contactVerificationConfirm,
  normalizeVerificationCode,
  resendWaitSeconds,
  type ContactKind,
  type MyNotificationChannels,
} from "@gina/core";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field } from "@/components/ui/field";
import { parentStyles } from "@/components/ui/parent-screen";
import { supabase } from "@/lib/supabase";

/** Reads the `message` of a PostgREST error without ever showing it to the parent. */
function errorKey(error: unknown): string {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : null;
  return channelErrorKey(message);
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * One contact address (email or SMS number): add → code → verify, change, remove.
 * Having a verified address is not consent; the purpose toggles below decide what may be sent.
 * Nothing is promised while the channel is not ready (no provider yet: X01/X02).
 */
export function ContactVerificationCard({ kind, view, prefillCode, onChanged }: {
  kind: ContactKind;
  view: MyNotificationChannels;
  /** Code from the verification deep link; filled in, never auto-submitted. The parent keys the card
   * by this value, so a new link remounts it with the new code. */
  prefillCode?: string | null;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const contact = view.contacts.find(c => c.kind === kind);
  const pending = view.pending.find(p => p.kind === kind);
  const limit = view.limits?.[kind];
  const ready = !!view.readiness[kind];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [code, setCode] = useState(prefillCode ?? "");
  const [notice, setNotice] = useState<string | null>(prefillCode ? t("channels.verify.linkFilled") : null);
  const now = useNow(!!limit?.last_requested_at || !!pending);
  const wait = resendWaitSeconds(limit, now);

  const request = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_contact_verification", { p_kind: kind, p_value: value });
      if (error) throw error;
      return data as { status: "pending" | "already_verified"; masked?: string };
    },
    onSuccess: (data) => {
      setEditing(false);
      setCode("");
      setNotice(data.status === "already_verified" ? t("channels.verify.alreadyVerified") : t(`channels.verify.sent.${kind}`, { masked: data.masked ?? "" }));
      onChanged();
    },
  });
  const confirm = useMutation({
    mutationFn: async () => {
      const token = normalizeVerificationCode(kind, code);
      if (!token) throw new Error("code_shape");
      const { data, error } = await supabase.rpc("confirm_contact_verification", { p_token: token });
      if (error) throw error;
      return contactVerificationConfirm.parse(data);
    },
    onSuccess: (result) => {
      if (result.status === "verified") {
        setCode("");
        request.reset();
        setNotice(t(`channels.verify.done.${kind}`, { masked: result.masked }));
      } else {
        setNotice(result.remaining > 0 ? t("channels.verify.wrong", { count: result.remaining }) : t("channels.verify.locked"));
      }
      onChanged();
    },
  });
  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("revoke_contact_channel", { p_kind: kind });
      if (error) throw error;
    },
    onSuccess: () => { setNotice(t(`channels.contact.removed.${kind}`)); onChanged(); },
  });

  const valid = contactLooksValid(kind, value);
  const codeValid = !!normalizeVerificationCode(kind, code);
  const showForm = editing || (!contact && !pending && ready);
  const formatTime = (iso: string) => new Date(iso).toLocaleString(i18n.language === "en" ? "en-GB" : "tr-TR", { dateStyle: "medium", timeStyle: "short" });
  const error = request.error ?? confirm.error ?? revoke.error;

  return <View testID={`contact-${kind}`} style={parentStyles.card}>
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t(`channels.contact.title.${kind}`)}</Text>
      <Text style={parentStyles.muted}>{t("channels.contact.notConsent")}</Text>
    </View>

    {contact && !editing ? <View style={{ gap: 6 }}>
      <Text testID={`contact-${kind}-verified`} style={parentStyles.copy}>{contact.masked}</Text>
      <Text style={parentStyles.muted}>{t("channels.contact.verifiedAt", { date: formatTime(contact.verified_at) })}</Text>
      {!ready ? <Text style={parentStyles.muted}>{t(`channels.contact.notReadyVerified.${kind}`)}</Text> : null}
    </View> : null}

    {!ready && !contact && !pending ? <Text testID={`contact-${kind}-not-ready`} style={parentStyles.muted}>{t(`channels.contact.notReady.${kind}`)}</Text> : null}

    {pending && !editing ? <View style={{ gap: 12 }} testID={`contact-${kind}-pending`}>
      <Text style={parentStyles.copy}>{t(`channels.verify.pending.${kind}`, { masked: pending.masked, time: formatTime(pending.expires_at) })}</Text>
      <Field label={t(`channels.verify.codeLabel.${kind}`)} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
        keyboardType={kind === "sms" ? "number-pad" : "default"} textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={kind === "sms" ? 7 : 10}
        hint={pending.attempts_left !== undefined ? t("channels.verify.attemptsLeft", { count: pending.attempts_left }) : undefined} />
      <Button title={t("channels.verify.confirm")} disabled={!codeValid} loading={confirm.isPending} onPress={() => confirm.mutate()} />
      <Button variant="ghost" title={t("channels.verify.newCode")} disabled={confirm.isPending} onPress={() => { setEditing(true); setNotice(null); }} />
    </View> : null}

    {showForm && ready ? <View style={{ gap: 12 }}>
      <Field label={t(`channels.contact.input.${kind}`)} value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false}
        keyboardType={kind === "email" ? "email-address" : "phone-pad"} textContentType={kind === "email" ? "emailAddress" : "telephoneNumber"}
        autoComplete={kind === "email" ? "email" : "tel"} hint={t(`channels.contact.inputHint.${kind}`)}
        error={value.length > 4 && !valid ? t(`channels.contact.invalid.${kind}`) : null} />
      <Button title={t("channels.verify.send")} disabled={!valid || wait > 0} loading={request.isPending} onPress={() => request.mutate()} />
      {wait > 0 ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{limit && limit.requests_left <= 0 ? t("channels.verify.hourLimit", { minutes: Math.ceil(wait / 60) }) : t("channels.verify.cooldown", { seconds: wait })}</Text> : null}
      {limit ? <Text style={parentStyles.muted}>{t("channels.verify.requestsLeft", { count: limit.requests_left })}</Text> : null}
      {editing ? <Button variant="ghost" title={t("common.cancel")} onPress={() => setEditing(false)} /> : null}
    </View> : null}

    {contact && !editing ? <View style={{ gap: 10 }}>
      {ready ? <Button variant="secondary" title={t("channels.contact.change")} onPress={() => { setEditing(true); setNotice(null); }} /> : null}
      <ConfirmAction title={t("channels.contact.remove")} busy={revoke.isPending} message={t(`channels.contact.removeConfirm.${kind}`)} onConfirm={() => revoke.mutate()} />
    </View> : null}

    {notice ? <Text testID={`contact-${kind}-notice`} accessibilityLiveRegion="polite" style={[parentStyles.copy, { color: "#287460" }]}>{notice}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{t(error instanceof Error && error.message === "code_shape" ? `channels.verify.codeShape.${kind}` : errorKey(error))}</Text> : null}
  </View>;
}
