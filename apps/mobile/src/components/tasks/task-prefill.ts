import { randomUUID } from "expo-crypto";

/**
 * C03: haftalık öneriden görev formuna ön doldurma. Öneri metni (çocuk adı geçebilir) adres/rota
 * parametresine yazılmaz; yalnız bu oturumun belleğinde, rastgele bir anahtarla taşınır. Uygulama
 * yeniden başlarsa anahtar boşa düşer ve form boş açılır (sessiz yanlış ön doldurma yok).
 */
export type TaskPrefill = {
  childId: string | null;
  title: string;
  suggestion: string;
  /** "Haftalık özetten: Ece · 26 Ekim haftası" gibi, kaynak bağını anlatan satır. */
  source: string;
};

const store = new Map<string, TaskPrefill>();

export function putTaskPrefill(prefill: TaskPrefill): string {
  const token = randomUUID();
  store.set(token, prefill);
  return token;
}

export function readTaskPrefill(token: string | null | undefined): TaskPrefill | null {
  return token ? store.get(token) ?? null : null;
}

export function dropTaskPrefill(token: string | null | undefined) {
  if (token) store.delete(token);
}
