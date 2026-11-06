import { CLIENT_SUPPORTED_INTERACTION_TYPES, PHASE2A_INTERACTION_TYPES } from "@gina/core";

/**
 * Faz 2A (QT30–QT33) çocuk desteği için TEK anahtar. Sunucu türleri `enabled=false` ile gelir; türler
 * açılıp bu istemci yayınlanacağı zaman `true` yapılır. QA web derlemesi `EXPO_PUBLIC_QT_PHASE2A=1`
 * ile açabilir (yalnız geçici test yığını; varsayılan kapalı).
 */
export const PHASE2A_CHILD_ENABLED: boolean = false || process.env.EXPO_PUBLIC_QT_PHASE2A === "1";

/** 1A/1B + 2A: `get_attempt_questions_v2` p_supported, 2A açıldığında. */
export const CLIENT_SUPPORTED_WITH_PHASE2A: readonly string[] = [...CLIENT_SUPPORTED_INTERACTION_TYPES, ...PHASE2A_INTERACTION_TYPES];

/** Çocuk ekranının sunucuya bildirdiği tür listesi. */
export const CHILD_SUPPORTED_TYPES: readonly string[] = PHASE2A_CHILD_ENABLED ? CLIENT_SUPPORTED_WITH_PHASE2A : CLIENT_SUPPORTED_INTERACTION_TYPES;

/**
 * Veli hazırlama / AI tür seçimi / PDF için faz anahtarları (varsayılan KAPALI). Kapalıyken yayında yeni hiçbir
 * seçenek görünmez. QA: `EXPO_PUBLIC_QT_PHASE2A=1`, `EXPO_PUBLIC_QT_PHASE2B=1` (yalnız geçici test yığını).
 */
export const PHASE2A_AUTHOR_ENABLED: boolean = false || process.env.EXPO_PUBLIC_QT_PHASE2A === "1";
export const PHASE2B_AUTHOR_ENABLED: boolean = false || process.env.EXPO_PUBLIC_QT_PHASE2B === "1";
