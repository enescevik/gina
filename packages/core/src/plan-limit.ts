const planLimitKeys = {
  plan_limit_children: "subscription.limitChildren",
  plan_limit_devices: "subscription.limitDevices",
  plan_limit_tasks: "subscription.limitTasks",
  plan_limit_notes: "subscription.limitNotes",
} as const;

/** Recognize the server business error, not a generic HTTP/SQL permission error. */
export function planLimitMessageKey(error: unknown): typeof planLimitKeys[keyof typeof planLimitKeys] | null {
  const message = typeof error === "string" ? error :
    error && typeof error === "object" && "message" in error ? error.message : null;
  if (typeof message !== "string") return null;
  const key = message.trim();
  return Object.prototype.hasOwnProperty.call(planLimitKeys, key)
    ? planLimitKeys[key as keyof typeof planLimitKeys] : null;
}
