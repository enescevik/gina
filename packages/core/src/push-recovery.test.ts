import { describe, expect, it } from "vitest";
import {
  pushRecoveryCommandSchema,
  readPushRecoveryReceipt,
} from "./push-recovery";
const command = {
  request: "00000000-0000-4000-8000-000000000001",
  id: 42,
  revision: 0,
  reason: "Provider setup was checked.",
  confirmed: true as const,
};
describe("push recovery contract", () => {
  it("requires explicit confirmation and a reason", () => {
    expect(
      pushRecoveryCommandSchema.safeParse({ ...command, confirmed: false })
        .success,
    ).toBe(false);
    expect(
      pushRecoveryCommandSchema.safeParse({ ...command, reason: "ok" }).success,
    ).toBe(false);
    expect(pushRecoveryCommandSchema.parse(command)).toEqual(command);
  });
  it("rejects unsafe identifiers and exhausted recovery revisions", () => {
    for (
      const c of [{ ...command, id: Number.MAX_SAFE_INTEGER + 1 }, {
        ...command,
        revision: 2,
      }, { ...command, id: -1 }]
    ) expect(pushRecoveryCommandSchema.safeParse(c).success).toBe(false);
  });
  it("checks receipt identity and revision before clearing local pending work", () => {
    const r = {
      request: command.request,
      id: 42,
      revision: 1,
      status: "pending",
    };
    expect(readPushRecoveryReceipt(r, command)).toEqual(r);
    for (
      const wrong of [{ ...r, id: 43 }, { ...r, revision: 2 }, {
        ...r,
        status: "sent",
      }, { ...r, request: "00000000-0000-4000-8000-000000000002" }]
    ) expect(() => readPushRecoveryReceipt(wrong, command)).toThrow();
  });
});
