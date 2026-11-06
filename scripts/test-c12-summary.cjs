// C12: test-c12-tour.cjs metrics.json → okunabilir özet (rota × ölçü bulguları). Kullanım: node scripts/test-c12-summary.cjs <metrics.json> [checks.json]
const fs = require('node:fs');
const metrics = JSON.parse(fs.readFileSync(process.argv[2]));
const lines = [];
for (const m of metrics) {
  if (m.error) { lines.push(`${m.id}: HATA ${m.error}`); continue; }
  const issues = [];
  for (const [size, a] of Object.entries(m.sizes)) {
    if (a.overflow > 1) issues.push(`${size} taşma ${a.overflow}px`);
    if (a.keys.length) issues.push(`${size} anahtar ${a.keys.join(',')}`);
    if (a.unnamedCount) issues.push(`${size} isimsiz ${a.unnamedCount}`);
    if (a.clipped.length) issues.push(`${size} kesik [${a.clipped.join(' | ')}]`);
  }
  const ph = m.sizes.phone || Object.values(m.sizes)[0];
  if (ph.dupes.length) issues.push(`tekrar [${ph.dupes.join(' | ')}]`);
  if (ph.smallCount) issues.push(`küçük ${ph.smallCount}/${ph.actionCount} [${ph.small.slice(0, 4).join(' | ')}]`);
  if (ph.imgsNoAlt) issues.push(`altsız görsel ${ph.imgsNoAlt}`);
  if (m.pageErrors?.length) issues.push(`pageerror ${m.pageErrors.length}: ${m.pageErrors[0].slice(0, 80)}`);
  lines.push(`${m.id} (${m.finalPath}) → ${issues.join('; ') || 'temiz'}`);
}
console.log(lines.join('\n'));
if (process.argv[3]) console.log(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[3])), null, 1).slice(0, 6000));
