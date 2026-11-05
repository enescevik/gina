// Q03 — repo ve rapor sızıntı taraması. Eşleşen DEĞERİ asla yazmaz; yalnız desen adı, dosya ve satır.
// Kullanım: node scripts/security/leak-scan.mjs [--json çıktı.json]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', '.expo', '.next', '.turbo', 'graphify-out', '.claude', 'ios', 'android', 'reports']);
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.ttf', '.otf', '.woff', '.woff2', '.mp3', '.mp4', '.wav', '.zip', '.ipa', '.p8', '.p12', '.mobileprovision', '.glb', '.ktx2', '.lockb']);
// Sır dosyalarının içeriği hiç açılmaz; yalnız varlığı not edilir.
const SECRET_FILE = /(^|\/)(\.env(\..+)?|.*\.pem|.*\.key|.*\.p8|.*\.p12|.*service-account.*\.json|.*google-services\.json|GoogleService-Info\.plist)$/;

const PATTERNS = [
  { name: 'jwt', severity: 'high', re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'supabase_secret_key', severity: 'high', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'supabase_access_token', severity: 'high', re: /\bsbp_[a-f0-9]{30,}/ },
  { name: 'anthropic_key', severity: 'high', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'generic_sk_key', severity: 'high', re: /\bsk-[A-Za-z0-9]{32,}/ },
  { name: 'aws_access_key', severity: 'high', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private_key_block', severity: 'high', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'google_api_key', severity: 'high', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'assigned_secret_literal', severity: 'medium',
    re: /(?:secret|password|passwd|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|cron[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_\-/+=]{20,}["']?/i,
    exclude: /(<[^>]+>|env\(|\$\{|\{\{|process\.env|Deno\.env|example|placeholder|your[-_]|xxx|REDACTED|\.\.\.)/i },
  { name: 'ios_udid', severity: 'medium', re: /\b[0-9A-F]{8}-[0-9A-F]{16}\b/ },
  { name: 'tr_phone', severity: 'medium', re: /(\+90|0090)[\s-]?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b|\b05\d{2}[\s-]\d{3}[\s-]\d{2}[\s-]\d{2}\b/ },
  { name: 'email_non_placeholder', severity: 'low', re: /[A-Za-z0-9._%+-]+@(?![0-9]+x\.)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
    exclude: /(@[0-9]+x\.(png|jpg|webp|svg)|@[0-9.]+\.patch\b|example\.(com|org|net|invalid)|\.invalid\b|\.test\b|@test\.local\b|@email\.com\b|project\.supabase\.co|noreply@anthropic\.com|users\.noreply\.github\.com|@gina\.(app|local)|@localhost|@sentry|@types|@expo|@supabase|@react|@babel|@testing|@eslint|@typescript|@pdf-lib|@resvg|@std|@tanstack|@radix|@shopify|@anthropic|@google|@noble|@jest|@sinclair|@hookform|@formatjs|@dnd-kit)/i },
  { name: 'hex64_possible_device_token', severity: 'low', re: /\b[a-f0-9]{64}\b/, exclude: /(sha256|sha-256|hash|integrity|digest|checksum|fingerprint|png|version=)/i, onlyDocs: true },
  { name: 'supabase_project_host', severity: 'info', re: /\b[a-z]{20}\.supabase\.co\b/ },
];

const findings = [];
const secretFiles = [];
let scanned = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(root, full);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { if (!SKIP_DIRS.has(entry)) walk(full); continue; }
    if (SECRET_FILE.test(rel)) { secretFiles.push(rel); continue; }
    if (BINARY.has(extname(entry).toLowerCase()) || st.size > 6 * 1024 * 1024) continue;
    if (rel === 'pnpm-lock.yaml' || rel.startsWith('patches/')) continue; // hash yoğun; ayrı pnpm audit kapsar
    let text;
    try { text = readFileSync(full, 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    scanned++;
    const isDocs = rel.startsWith('docs/') || rel.startsWith('research_notes/') || rel.endsWith('.md') || rel.endsWith('.json');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of PATTERNS) {
        if (p.onlyDocs && !isDocs) continue;
        if (!p.re.test(line)) continue;
        if (p.exclude && p.exclude.test(line)) continue;
        if (rel === 'scripts/security/leak-scan.mjs') continue;
        findings.push({ pattern: p.name, severity: p.severity, file: rel, line: i + 1 });
      }
    }
  }
}
walk(root);

const bySeverity = {};
for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
const byPattern = {};
for (const f of findings) byPattern[f.pattern] = (byPattern[f.pattern] ?? 0) + 1;
const report = { scanned_files: scanned, secret_files_present_not_opened: secretFiles, by_severity: bySeverity, by_pattern: byPattern, findings };
const jsonAt = process.argv.indexOf('--json');
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify({ scanned_files: scanned, secret_files_present_not_opened: secretFiles.length, by_severity: bySeverity, by_pattern: byPattern }));
for (const f of findings.filter(f => f.severity === 'high' || f.severity === 'medium')) console.log(`${f.severity} ${f.pattern} ${f.file}:${f.line}`);
process.exitCode = findings.some(f => f.severity === 'high') ? 1 : 0;
