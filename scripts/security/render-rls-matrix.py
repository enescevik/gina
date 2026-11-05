"""rls-matrix(-fresh).json → okunabilir Markdown matrisi (tablo ve fonksiyon başına).
Kullanım: python3 scripts/security/render-rls-matrix.py docs/release/q03-2026-11-06/rls-matrix-fresh.json docs/release/q03-2026-11-06/rls-matrix.md
"""
import json, sys
src, dst = sys.argv[1], sys.argv[2]
r = json.load(open(src))
Y, N = '✓', '—'
def flag(v): return Y if v else N
lines = [f"# RLS / RPC matrisi — {r['environment']}", '',
         f"Migration sayısı: {r['migrations_applied']}. Tablolar: {len(r['tables'])}. Fonksiyonlar: {len(r['functions'])} "
         f"(security definer: {sum(1 for f in r['functions'] if f['security_definer'])}). Kaynak: `{src.split('/')[-1]}`.", '',
         '## Tablolar', '',
         '`anon` için hiçbir tabloda SELECT/INSERT/UPDATE/DELETE yetkisi yoktur (matris sütunlarında yalnız `authenticated` gösterilir; `anon` sütunu tüm satırlarda boş çıktığı için atlandı).', '',
         '| Tablo | RLS | Zorla | auth S | auth I | auth U | auth D | Politika (komut:adet) |', '|---|---|---|---|---|---|---|---|']
for t in r['tables']:
    g = t['grants']['authenticated']
    pol = ', '.join(f"{k}:{v}" for k, v in sorted(t['policies'].items())) or '—'
    lines.append(f"| `{t['schema']}.{t['table']}` | {flag(t['rls_enabled'])} | {flag(t['rls_forced'])} | {flag(g['select'])} | {flag(g['insert'])} | {flag(g['update'])} | {flag(g['delete'])} | {pol} |")
lines += ['', '## Görünümler', '', '| Görünüm | security_invoker | anon SELECT | authenticated SELECT |', '|---|---|---|---|']
for v in r['views']:
    lines.append(f"| `{v['schema']}.{v['view']}` | {flag(v['security_invoker'])} | {flag(v['anon_select'])} | {flag(v['authenticated_select'])} |")
lines += ['', '## Fonksiyonlar (tetikleyici fonksiyonları hariç)', '',
          'Sütunlar: SD = security definer, SP = `search_path` sabit, anon/auth = EXECUTE yetkisi, is_device = gövde `gina.is_device()` kullanır (cihaz iptali `devices.revoked_at` burada denetlenir), çağıran = gövdede çağıran kimliği/rol denetimi deseni bulundu (heuristik).', '',
          '| Fonksiyon | SD | SP | anon | auth | is_device | çağıran |', '|---|---|---|---|---|---|---|']
for f in r['functions']:
    if f['is_trigger']: continue
    lines.append(f"| `{f['schema']}.{f['name']}({f['args']})` | {flag(f['security_definer'])} | {flag(f['search_path_set'])} | {flag(f['anon_execute'])} | {flag(f['authenticated_execute'])} | {flag(f['uses_is_device'])} | {flag(f['has_caller_check'])} |")
trig = [f for f in r['functions'] if f['is_trigger']]
lines += ['', f"Tetikleyici fonksiyonları: {len(trig)} (doğrudan çağrılamaz; {sum(1 for f in trig if f['security_definer'])} tanesi security definer, hepsinde search_path sabit: {flag(all(f['search_path_set'] for f in trig if f['security_definer']))}).", '',
          '## Storage', '', '```json', json.dumps(r['storage'], indent=1, ensure_ascii=False), '```', '',
          '## Sentetik aile ile çalıştırmalı kontroller', '', '| Kontrol | Sonuç | Ayrıntı |', '|---|---|---|']
for c in r['synthetic']:
    d = json.dumps(c['detail'], ensure_ascii=False)
    if len(d) > 400: d = d[:400] + '…'
    lines.append(f"| `{c['check']}` | {'geçti' if c['passed'] else 'BULGU'} | `{d}` |")
open(dst, 'w').write('\n'.join(lines) + '\n')
print(dst, len(lines), 'lines')
