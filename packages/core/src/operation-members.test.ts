import { describe, expect, it } from "vitest";
import {
  activeOperationRoles,
  operationMemberCommandSchema,
  operationMembersSchema,
  operationRoleExpiry,
  operatorAccountSchema,
  setOperationMemberResultSchema,
} from "./operation-members";

const user = "00000000-0000-4000-8000-000000000001";

describe("D7 operation members", () => {
  it("parses the member list and derives active roles", () => {
    const data = operationMembersSchema.parse({
      members: [{
        user_id: user,
        email: "a@example.invalid",
        open_sessions: 1,
        roles: [
          { role: "content", state: "active", expires_at: "2026-12-01T00:00:00Z", revoked_at: null, granted_by: "admin@example.invalid", scope_count: null },
          { role: "release", state: "revoked", expires_at: "2026-12-01T00:00:00Z", revoked_at: "2026-11-06T10:00:00Z", granted_by: null, scope_count: 2 },
        ],
        history: [{ at: "2026-11-06T10:00:00Z", actor: "admin@example.invalid", role: "release", revoked: true, expires_at: null, reason: "Ayrıldı" }],
      }],
      roles: ["support", "content", "finance", "release"],
      max_days: 365,
      rule: "ignored extra",
    });
    expect(activeOperationRoles(data.members[0]!)).toEqual(["content"]);
    expect(operationMembersSchema.safeParse({ members: [{ user_id: user, email: null, open_sessions: 0, roles: [{ role: "owner", state: "active", expires_at: "x", revoked_at: null, granted_by: null }], history: [] }], roles: [], max_days: 365 }).success).toBe(false);
  });

  it("requires an expiry only when granting", () => {
    expect(operationMemberCommandSchema.safeParse({ user_id: user, role: "content", revoke: false, expires_at: "2026-12-01T00:00:00Z", reason: " Ekibe katıldı " }).success).toBe(true);
    expect(operationMemberCommandSchema.safeParse({ user_id: user, role: "content", revoke: true, expires_at: null, reason: "Ayrıldı" }).success).toBe(true);
    expect(operationMemberCommandSchema.safeParse({ user_id: user, role: "content", revoke: true, expires_at: "2026-12-01T00:00:00Z", reason: "Ayrıldı" }).success).toBe(false);
    expect(operationMemberCommandSchema.safeParse({ user_id: user, role: "content", revoke: false, expires_at: null, reason: "Ekibe katıldı" }).success).toBe(false);
    expect(operationMemberCommandSchema.safeParse({ user_id: user, role: "content", revoke: true, expires_at: null, reason: " x " }).success).toBe(false);
  });

  it("computes a stable expiry within the one-year limit", () => {
    const now = new Date("2026-11-06T10:00:00.750Z");
    expect(operationRoleExpiry(30, now)).toBe("2026-12-06T10:00:00.000Z");
    expect(operationRoleExpiry(30, now)).toBe(operationRoleExpiry(30, new Date("2026-11-06T10:00:00.100Z")));
    expect(() => operationRoleExpiry(0, now)).toThrow("invalid_days");
    expect(() => operationRoleExpiry(366, now)).toThrow("invalid_days");
  });

  it("validates lookup and command results", () => {
    expect(operatorAccountSchema.parse({ found: false })).toEqual({ found: false });
    expect(operatorAccountSchema.parse({ found: true, user_id: user, email: "a@example.invalid", eligible: false, reason: "operator_is_admin" }).found).toBe(true);
    expect(setOperationMemberResultSchema.parse({ status: "revoked", user_id: user, role: "content", active: false, expires_at: "2026-12-01T00:00:00Z", revoked_at: "2026-11-06T10:00:00Z", open_sessions: 2, effect: "refused_on_next_request", scope_count: null, replayed: false }).effect)
      .toBe("refused_on_next_request");
    expect(setOperationMemberResultSchema.safeParse({ status: "deleted", user_id: user, role: "content", active: false, expires_at: null, revoked_at: null, open_sessions: 0, effect: null, scope_count: null, replayed: false }).success).toBe(false);
  });
});
