/**
 * C13-AUTH-1: child-device pairing code = 8 characters from a 22-symbol alphabet without look-alikes
 * (no 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B). Must match `gina.pairing_code_alphabet()` on the server.
 * Shown and typed as two groups of four ("ACDE FH34"); case, spaces and dashes are ignored.
 */
export const PAIRING_ALPHABET = "ACDEFHJKMNPRTUVWXY3479";
export const PAIRING_CODE_LENGTH = 8;
const CODE = new RegExp(`^[${PAIRING_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`);
const OUTSIDE = new RegExp(`[^${PAIRING_ALPHABET}]`, "g");

export const isPairingCode = (value: unknown): value is string => typeof value === "string" && CODE.test(value);

/** Upper-cases and keeps only alphabet symbols (max 8): what the parent typed → the raw code. */
export const normalizePairingCode = (value: string | null | undefined) =>
  (value ?? "").toUpperCase().replace(OUTSIDE, "").slice(0, PAIRING_CODE_LENGTH);

/** "ACDEFH34" → "ACDE FH34" (partial input is grouped too). */
export const formatPairingCode = (value: string) => {
  const raw = normalizePairingCode(value);
  return raw.length > 4 ? `${raw.slice(0, 4)} ${raw.slice(4)}` : raw;
};

/** Screen readers spell the code one symbol at a time. */
export const spellPairingCode = (value: string) => normalizePairingCode(value).split("").join(" ");

export const formatSeconds = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
