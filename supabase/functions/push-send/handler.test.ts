import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  type DeliveryStatus,
  drainPush,
  type PushDependencies,
  type PushRow,
  type PushTarget,
} from "./handler.ts";
const row: PushRow = {
  id: 1,
  lease_id: "lease",
  kind: "cohort_results",
  payload: { group_id: "00000000-0000-4000-8000-000000000001" },
};
const tokens: PushTarget[] = [{
  token_id: "one",
  token: "token1",
  token_hash: "a".repeat(64),
  token_type: "apns",
  locale: "tr",
}, {
  token_id: "two",
  token: "token2",
  token_hash: "b".repeat(64),
  token_type: "fcm",
  locale: "en",
}];
function fixture() {
  const receipts = new Map<string, DeliveryStatus>(), calls: string[] = [];
  let claimed = false, finished = 0;
  const d: PushDependencies = {
    claim: () => Promise.resolve(claimed ? [] : (claimed = true, [row])),
    targets: () =>
      Promise.resolve(
        tokens.filter((t) =>
          !["sent", "gone", "failed", "unconfigured"].includes(
            receipts.get(t.token_id) ?? "",
          )
        ),
      ),
    configured: () => true,
    send: (t) => {
      calls.push(t.token_id);
      return Promise.resolve({ ok: true });
    },
    record: (_r, t, s) => {
      receipts.set(t.token_id, s);
      return Promise.resolve();
    },
    finish: () => {
      finished++;
      return Promise.resolve("sent");
    },
  };
  return {
    d,
    receipts,
    calls,
    finishCount: () => finished,
    reopen: () => {
      claimed = false;
    },
  };
}
Deno.test("partial success retains accepted device and retries only remaining device", async () => {
  const f = fixture();
  f.d.send = (t) => {
    f.calls.push(t.token_id);
    return Promise.resolve(
      t.token_id === "one"
        ? { ok: true }
        : { ok: false, gone: false, retry: true, error: "fcm:UNAVAILABLE" },
    );
  };
  await drainPush(f.d);
  assertEquals(f.receipts.get("one"), "sent");
  assertEquals(f.receipts.get("two"), "retry");
  f.reopen();
  f.d.send = (t) => {
    f.calls.push(t.token_id);
    return Promise.resolve({ ok: true });
  };
  await drainPush(f.d);
  assertEquals(f.calls, ["one", "two", "two"]);
});
Deno.test("lost receipt acknowledgement stops processing before other devices", async () => {
  const f = fixture();
  f.d.record = (_r, t, s) => {
    f.receipts.set(t.token_id, s);
    throw Error("response lost");
  };
  await assertRejects(() => drainPush(f.d));
  assertEquals(f.calls, ["one"]);
  assertEquals(f.finishCount(), 0);
  f.reopen();
  f.d.record = (_r, t, s) => {
    f.receipts.set(t.token_id, s);
    return Promise.resolve();
  };
  await drainPush(f.d);
  assertEquals(f.calls, ["one", "two"]);
});
Deno.test("stale lease stops before any provider request", async () => {
  const f = fixture();
  f.d.targets = () => Promise.reject(Error("push_lease_changed"));
  await assertRejects(() => drainPush(f.d));
  assertEquals(f.calls, []);
});
Deno.test("preference or membership change is checked before the next device", async () => {
  const f = fixture();
  let reads = 0;
  f.d.targets = () => Promise.resolve(++reads === 1 ? tokens : []);
  await drainPush(f.d);
  assertEquals(f.calls, ["one"]);
});
Deno.test("missing provider is recorded per device without blocking configured platform", async () => {
  const f = fixture();
  f.d.configured = (t) => t.token_type === "apns";
  await drainPush(f.d);
  assertEquals(f.calls, ["one"]);
  assertEquals(f.receipts.get("two"), "unconfigured");
});
Deno.test("unexpected provider error records a retry without leaking thrown details", async () => {
  const f = fixture();
  f.d.send = () => {
    throw Error("secret-url-token");
  };
  let errors: (string | null)[] = [];
  f.d.record = (_r, t, s, e) => {
    f.receipts.set(t.token_id, s);
    errors.push(e);
    return Promise.resolve();
  };
  await drainPush(f.d);
  assertEquals(errors, ["provider_network_error", "provider_network_error"]);
});
Deno.test("runtime budget yields the remaining targets through finalization", async () => {
  const f = fixture();
  let time = 0;
  f.d.now = () => time;
  f.d.send = (t) => {
    f.calls.push(t.token_id);
    time = 46000;
    return Promise.resolve({ ok: true });
  };
  await drainPush(f.d);
  assertEquals(f.calls, ["one"]);
  assertEquals(f.finishCount(), 1);
});

Deno.test("provider retry delay is passed to durable storage", async () => {
  const f = fixture();
  const delays: (number | undefined)[] = [];
  f.d.send = () =>
    Promise.resolve({
      ok: false,
      gone: false,
      retry: true,
      error: "fcm:QUOTA_EXCEEDED",
      retryAfterSeconds: 3600,
    });
  f.d.record = (_r, t, s, _e, delay) => {
    f.receipts.set(t.token_id, s);
    delays.push(delay);
    return Promise.resolve();
  };
  await drainPush(f.d);
  assertEquals(delays, [3600, 3600]);
});
