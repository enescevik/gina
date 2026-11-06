#!/usr/bin/env node
// H04: deterministic check of the Supabase Auth e-mail templates (confirm/reset) and subjects.
// Renders both locale branches the way Supabase's Go templates do for `.Data.locale` (= user_metadata.locale)
// and checks: TR/EN branch selection, exactly one confirmation link per branch, no other template variables,
// html lang, https-only links/images, image files present, subject per locale. Sends nothing.
// Usage: node scripts/check-auth-email-templates.mjs
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase/templates");
const IF = '{{ if eq .Data.locale "en" }}', ELSE = "{{ else }}", END = "{{ end }}";
const TURKISH = /[çğışöüÇĞİŞÖÜ]/;
const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); };

/** Mimics the Go template for one locale value. */
function render(source, locale) {
  const i = source.indexOf(IF), e = source.indexOf(ELSE), n = source.lastIndexOf(END);
  if (i < 0 || e < i || n < e) throw new Error("template is not a single if/else/end on .Data.locale");
  return (locale === "en" ? source.slice(i + IF.length, e) : source.slice(e + ELSE.length, n)).trim();
}

const expected = {
  confirm: { en: ["Confirm your GINA account", "Confirm my email"], tr: ["GINA hesabını doğrula", "E-postamı doğrula"] },
  reset: { en: ["Reset your GINA password", "Reset my password"], tr: ["GINA şifreni yenile", "Şifremi yenile"] },
};
const subjects = JSON.parse(readFileSync(join(dir, "subjects.json"), "utf8"));
const results = [];
for (const [name, copy] of Object.entries(expected)) {
  const html = readFileSync(join(dir, `${name}.html`), "utf8");
  check(html.trim().startsWith(IF) && html.trim().endsWith(END), `${name}.html: whole file is one locale conditional`);
  for (const locale of ["en", "tr", "", "de"]) {
    const lang = locale === "en" ? "en" : "tr"; // anything other than "en" (missing, tr, unknown) is Turkish
    const body = render(html, locale), subject = render(subjects[name], locale);
    const [subjectText, button] = copy[lang];
    const tag = `${name}[locale=${JSON.stringify(locale)}]`;
    check(subject === subjectText, `${tag}: subject ${JSON.stringify(subject)}`);
    check(body.includes(`<html lang="${lang}">`), `${tag}: html lang=${lang}`);
    check(body.includes(`>${button}</a>`), `${tag}: button text`);
    check((body.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length === 1, `${tag}: exactly one ConfirmationURL link`);
    check((body.match(/\{\{/g) ?? []).length === 1, `${tag}: no template variable other than ConfirmationURL`);
    check(!/(href|src)="http:/.test(body), `${tag}: https only`);
    for (const [, img] of body.matchAll(/src="https:\/\/ginafamily\.com\/email\/(v\d+\/[a-z0-9_-]+\.png)"/g)) {
      check(existsSync(join(root, "deploy/web/email", img)), `${tag}: image deploy/web/email/${img} exists`);
    }
    check(!/src="(?!https:\/\/ginafamily\.com\/email\/v\d+\/)/.test(body), `${tag}: images only from ginafamily.com/email/vN`);
    check(lang === "tr" ? TURKISH.test(body) : !TURKISH.test(body + subject), `${tag}: language of copy`);
    check(!/mailto:|destek@|support@/.test(body), `${tag}: no support mailbox promised`);
    results.push({ template: name, locale, lang, subject });
  }
}
// The app writes the locale the templates read: sign-up metadata and the signed-in sync.
const signIn = readFileSync(join(root, "apps/mobile/src/app/(auth)/sign-in.tsx"), "utf8");
const session = readFileSync(join(root, "apps/mobile/src/lib/session.tsx"), "utf8");
check(/signUp\(\{[^;]*data: \{ locale: resolveLocale\(/.test(signIn), "sign-up writes user_metadata.locale");
check(/updateUser\(\{ data: \{ locale \} \}\)/.test(session), "signed-in session syncs user_metadata.locale");
check(/emailRedirectTo: Linking\.createURL\("\/auth-callback"\)/.test(signIn), "sign-up confirmation returns to /auth-callback");
check(/redirectTo: Linking\.createURL\("\/reset-password"\)/.test(signIn), "reset returns to /reset-password");

console.log(JSON.stringify({ ok: failures.length === 0, checked: results.length, results, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
