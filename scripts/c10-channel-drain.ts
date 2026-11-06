// C10 isolated acceptance only: one drain tick of the email outbox through the UNCHANGED worker pieces
// (push-send/channels.ts drainChannels + _shared/channels render + SMTP adapter over STARTTLS) into a
// loopback fake SMTP server with a throwaway CA. Claim/receipt go through the real service-role RPCs of a
// disposable `gina_http_*_audit` database via local psql. Prints the captured mails as JSON on stdout.
// Usage: deno run --config supabase/functions/deno.json --allow-net=127.0.0.1 --allow-run=docker,openssl \
//          --allow-read --allow-write --allow-env scripts/c10-channel-drain.ts <db> <confirmUrl> <oneClickUrl> <pageUrl>
import { drainChannels } from "../supabase/functions/push-send/channels.ts";
import type { ChannelRow } from "../supabase/functions/_shared/channels/render.ts";
import { smtpAdapter } from "../supabase/functions/_shared/channels/email.ts";
import { decodeBody, makeTestPki, startFakeSmtp } from "../supabase/functions/_shared/channels/fake-smtp.ts";

const [db, confirmUrl, unsubscribeUrl, unsubscribePageUrl] = Deno.args;
if (!/^gina_http_[0-9a-f]+_audit$/.test(db ?? "")) throw new Error("disposable_db_required");
for (const u of [confirmUrl, unsubscribeUrl, unsubscribePageUrl]) if (new URL(u).hostname !== "127.0.0.1") throw new Error("loopback_only");

async function psql(sql: string): Promise<string> {
  const p = new Deno.Command("docker", { args: ["exec", "-i", "supabase_db_gina", "psql", "-X", "-qAt", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"], stdin: "piped", stdout: "piped", stderr: "piped" }).spawn();
  const w = p.stdin.getWriter();
  await w.write(new TextEncoder().encode(`set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);\n${sql}\n`));
  await w.close();
  const out = await p.output();
  if (!out.success) throw new Error("psql_failed");
  return new TextDecoder().decode(out.stdout).trim().split("\n").pop() ?? "";
}
const q = (v: string | null | undefined) => v == null ? "null" : `'${v.replace(/'/g, "''")}'`;

const pki = await makeTestPki();
const smtp = await startFakeSmtp({ mode: "starttls", pki });
try {
  // Worker heartbeat the real push-send tick would send (env names only).
  await psql(`select public.channel_report_provider_status('email','smtp',true,'{}');`);
  const adapter = smtpAdapter({ host: "127.0.0.1", port: smtp.port, username: "c10", password: "local-fake", security: "starttls", caCerts: [pki.caPem], timeoutMs: 8000 });
  const counts = await drainChannels({
    claim: async (limit) => JSON.parse(await psql(`select public.channel_claim(${limit});`)) as ChannelRow[],
    emailFor: () => ({ adapter, missing: [] }),
    smsFor: () => ({ adapter: null, missing: ["provider_not_selected"] }),
    record: async (row, status, provider, messageId, error, retryAfter) => {
      const ok = await psql(`select public.channel_record_result(${row.id},${q(row.lease_id)}::uuid,${q(status)},${q(provider)},${q(messageId)},${q(error)},${retryAfter ?? "null"});`);
      if (ok !== "t") throw new Error("receipt_not_acknowledged");
    },
    render: { unsubscribeUrl, unsubscribePageUrl, confirmUrl },
    budgetMs: 20000,
  });
  const mails = smtp.mails.map((m) => ({ to: m.to, ...decodeBody(m.data) }));
  const clearText = smtp.transcript.filter((t) => !t.tls).map((t) => t.line);
  console.log(JSON.stringify({ counts, mails, clearText }));
} finally {
  await smtp.close();
  await pki.cleanup();
}
