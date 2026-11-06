// H02 parity probe (local QA only, not deployed): runs the Deno extractor (supabase/functions/_shared/meb-extract.ts)
// on the given cases and prints one canonical JSON line per case. scripts/test-meb-extract-parity.py compares these
// lines byte-for-byte with the Python extractor (`extraction_result`), excluding the `extractor` label.
// Usage: deno run --allow-read=<dir> scripts/meb-extract-parity.ts <cases.json>
import { canonicalJson, extractionResult } from "../supabase/functions/_shared/meb-extract.ts";

interface Case {
  name: string;
  path: string;
  item: { sha256: string; label: string; resolved_url: string; school_year: string; term: number };
}
const cases: Case[] = JSON.parse(await Deno.readTextFile(Deno.args[0]));
for (const c of cases) {
  const body = await Deno.readFile(c.path);
  const started = performance.now();
  const result = await extractionResult(c.item, body) as unknown as Record<string, unknown>;
  const ms = performance.now() - started;
  delete result.extractor;
  console.log(JSON.stringify({ name: c.name, ms: Math.round(ms * 10) / 10, canonical: canonicalJson(result) }));
}
