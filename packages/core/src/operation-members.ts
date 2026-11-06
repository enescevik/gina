import { z } from "zod";

/**
 * D7 operatör rol yönetimi sözleşmeleri: `admin_operation_members`, `admin_find_operator_account`,
 * `admin_set_operation_member`. Yetki sunucuda canlıdır (yalnız tam yönetici; kaldırılan rol açık oturumda
 * bir sonraki istekte reddedilir). Bu katman yanıtları doğrular ve ekranın hesaplarını yapar.
 */
export const OPERATION_ROLES = ["support", "content", "finance", "release"] as const;
export type OperationRole = (typeof OPERATION_ROLES)[number];
export const OPERATION_ROLE_LABELS: Record<OperationRole, string> = {
  support: "Destek",
  content: "İçerik",
  finance: "Finans",
  release: "Yayın",
};
/** Sunucu sınırı: verilen rol en çok 1 yıl sürer. */
export const OPERATION_ROLE_MAX_DAYS = 365;
export const OPERATION_ROLE_DAY_CHOICES = [7, 30, 90, 180, 365] as const;

const uuid = z.uuid();
const count = z.number().int().min(0);
const role = z.enum(OPERATION_ROLES);

export const operationMemberRoleSchema = z.object({
  role,
  state: z.enum(["active", "expired", "revoked"]),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  granted_by: z.string().nullable(),
  scope_count: count.nullable().optional(),
});
export type OperationMemberRole = z.infer<typeof operationMemberRoleSchema>;
export const operationMemberHistorySchema = z.object({
  at: z.string(),
  actor: z.string().nullable(),
  role: role.nullable(),
  revoked: z.boolean().nullable(),
  expires_at: z.string().nullable(),
  reason: z.string().nullable(),
});
export const operationMemberSchema = z.object({
  user_id: uuid,
  email: z.string().nullable(),
  open_sessions: count,
  roles: z.array(operationMemberRoleSchema),
  history: z.array(operationMemberHistorySchema),
});
export type OperationMember = z.infer<typeof operationMemberSchema>;
export const operationMembersSchema = z.object({
  members: z.array(operationMemberSchema),
  roles: z.array(role),
  max_days: z.number().int().positive(),
});
export type OperationMembers = z.infer<typeof operationMembersSchema>;

export const operatorAccountSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    user_id: uuid,
    email: z.string().nullable(),
    eligible: z.boolean(),
    reason: z.enum(["operator_account_required", "operator_is_admin"]).nullable(),
  }),
]);
export type OperatorAccount = z.infer<typeof operatorAccountSchema>;

export const setOperationMemberResultSchema = z.object({
  status: z.enum(["granted", "updated", "revoked", "unchanged"]),
  user_id: uuid,
  role,
  active: z.boolean(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  open_sessions: count,
  effect: z.literal("refused_on_next_request").nullable(),
  scope_count: count.nullable(),
  replayed: z.boolean(),
});
export type SetOperationMemberResult = z.infer<typeof setOperationMemberResultSchema>;

/** Ekranın gönderdiği komut. Kaldırmada süre yok; vermede süre 1..365 gün ve gelecekte. */
export const operationMemberCommandSchema = z.object({
  user_id: uuid,
  role,
  revoke: z.boolean(),
  expires_at: z.string().nullable(),
  reason: z.string().trim().min(3).max(500),
}).refine((c) => c.revoke === (c.expires_at === null), { message: "expiry_mismatch" });
export type OperationMemberCommand = z.infer<typeof operationMemberCommandSchema>;

/**
 * Seçilen gün sayısından bitiş anı: saniyeye yuvarlanır (aynı komut aynı yük üretir, yeniden deneme
 * ikinci kayıt yazmaz). Sınır dışı gün sayısı reddedilir.
 */
export function operationRoleExpiry(days: number, now: Date = new Date()): string {
  if (!Number.isInteger(days) || days < 1 || days > OPERATION_ROLE_MAX_DAYS) throw new Error("invalid_days");
  const t = Math.floor(now.getTime() / 1000) * 1000 + days * 86_400_000;
  return new Date(t).toISOString();
}

/** Kişinin şu an etkin rolleri (sunucu durumuna göre). */
export function activeOperationRoles(member: OperationMember): OperationRole[] {
  return member.roles.filter((r) => r.state === "active").map((r) => r.role);
}
