import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * Push bildirimleri (iOS APNs / Android FCM, Expo push servisi kullanılmaz).
 * - Yerel cihaz token'ı getDevicePushTokenAsync ile alınır, register_push_token RPC'siyle yazılır.
 * - İzin: veli ilk girişte (parent layout), tablet eşleşmeden sonra (child layout) istenir.
 * - Bildirim içeriği geneldir; data yalnız kind + kimlik taşır (supabase/functions/push-send).
 * - Web: hiçbir şey yapmaz.
 */

type PushRole = "parent" | "device";

const enabled = Platform.OS === "ios" || Platform.OS === "android";

// Bildirim türü → açılacak ekran (rolüne göre).
const ROUTES: Record<PushRole, Record<string, Href>> = {
  parent: {
    task_awaiting_approval: "/parent",
    exam_finished: "/parent/prova",
    weekly_summary: "/parent",
  },
  device: {
    task_approved: "/child/today",
    task_returned: "/child/today",
    exam_assigned: "/child/prova",
  },
};

let handlerInstalled = false;

function installHandler() {
  if (handlerInstalled || !enabled) return;
  handlerInstalled = true;
  // Uygulama öndeyken de afiş göster.
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensureChannel(channelName: string) {
  if (Platform.OS !== "android") return;
  // Android 13+: izin istemi kanal oluşturulduktan sonra görünür; push-send channel_id "default" kullanır.
  await Notifications.setNotificationChannelAsync("default", {
    name: channelName,
    importance: AndroidImportance.HIGH,
  });
}

/** İzin yoksa ve henüz sorulmadıysa bir kez sorar; reddedildiyse tekrar sormaz. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status !== Notifications.PermissionStatus.UNDETERMINED || !current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

async function saveToken(token: string, locale: string) {
  const { error } = await supabase.rpc("register_push_token", {
    p_token: token,
    p_platform: Platform.OS,
    p_locale: locale,
  });
  if (error) console.warn("push token kaydedilemedi", error.message);
}

/** Bildirim izni şu an verilmiş mi (tercihler ekranı için). */
export async function getPushPermission(): Promise<"granted" | "denied" | "undetermined" | "unsupported"> {
  if (!enabled) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return "granted";
  return p.status === Notifications.PermissionStatus.UNDETERMINED && p.canAskAgain ? "undetermined" : "denied";
}

/** Tercihler ekranından izin ister ve başarılıysa token'ı kaydeder. */
export async function requestPushPermission(locale: string, channelName: string): Promise<boolean> {
  if (!enabled) return false;
  installHandler();
  await ensureChannel(channelName);
  const granted = await ensurePermission();
  if (granted) {
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === "string") await saveToken(data, locale);
  }
  return granted;
}

/**
 * Çıkıştan ÖNCE çağrılır (oturum hâlâ geçerliyken): bu cihazın token'ını siler.
 * Sunucu ayrıca oturumu kapanmış kullanıcıya gönderim yapmaz (push_targets).
 */
export async function unregisterPush(): Promise<void> {
  if (!enabled) return;
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === "string") await supabase.rpc("unregister_push_token", { p_token: data });
  } catch {
    // token alınamıyorsa silinecek bir şey de yoktur
  }
}

/** Rol oturumu açıkken izni sorar, token'ı kaydeder ve token değişince yeniler. */
export function usePushRegistration(role: PushRole) {
  const { claims } = useSession();
  const { t, i18n } = useTranslation();
  const active = enabled && claims?.role === role && !!claims.family_id;
  const locale = i18n.language;
  const channelName = t("push.channelName");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    installHandler();

    // Açılış ekranı yerleşsin diye izin istemi kısa bir gecikmeyle gelir.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await ensureChannel(channelName);
          if (cancelled || !(await ensurePermission()) || cancelled) return;
          const { data } = await Notifications.getDevicePushTokenAsync();
          if (!cancelled && typeof data === "string") await saveToken(data, locale);
        } catch (e) {
          console.warn("push kaydı atlandı", e instanceof Error ? e.message : e);
        }
      })();
    }, 1500);

    const sub = Notifications.addPushTokenListener((next) => {
      if (typeof next.data === "string") void saveToken(next.data, locale);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [active, locale, channelName]);
}

const handledResponses = new Set<string>();

function routeResponse(role: PushRole, response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const id = response.notification.request.identifier;
  if (handledResponses.has(id)) return;
  handledResponses.add(id);
  const kind = (response.notification.request.content.data as { kind?: unknown } | undefined)?.kind;
  const target = typeof kind === "string" ? ROUTES[role][kind] : undefined;
  if (target) router.push(target);
}

/** Bildirime dokunulunca ilgili ekrana gider (uygulama kapalıyken açılış dahil). */
export function useNotificationRouting(role: PushRole) {
  const { claims } = useSession();
  const active = enabled && claims?.role === role;

  useEffect(() => {
    if (!active) return;
    void Notifications.getLastNotificationResponseAsync().then((r) => routeResponse(role, r));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => routeResponse(role, r));
    return () => sub.remove();
  }, [active, role]);
}

/** Layout'larda tek satırla bağlanır. */
export function usePush(role: PushRole) {
  usePushRegistration(role);
  useNotificationRouting(role);
}
