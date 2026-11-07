import { describe, expect, it } from "vitest";
import { planLimitMessageKey } from "./plan-limit";

describe("plan limit feedback", () => {
  it("distinguishes child and device limits from PostgREST business errors", () => {
    expect(planLimitMessageKey({ code: "P0001", message: "plan_limit_devices", details: "limit=1", status: 400 })).toBe("subscription.limitDevices");
    expect(planLimitMessageKey({ code: "P0001", message: "plan_limit_children", details: "limit=2" })).toBe("subscription.limitChildren");
  });
  it("recognizes limits raised while saving starter tasks", () => {
    expect(planLimitMessageKey(new Error("plan_limit_tasks"))).toBe("subscription.limitTasks");
  });
  it.each([null, {}, { message: 42 }, { code: "42501", message: "forbidden" }, { status: 403 }, new Error("Network request failed"), { code: "P0001", message: "invalid_or_expired_code" }, "unknown_plan_limit", "toString"])("does not sell an upgrade for unrelated errors: %j", error => {
    expect(planLimitMessageKey(error)).toBeNull();
  });
});
