// Debug helper (not part of the tour): open one page as one role and dump state.
const fs = require('node:fs');
const { chromium } = require(process.env.GINA_QA_PLAYWRIGHT_PATH);
const f = JSON.parse(fs.readFileSync(process.env.C07_WORK + '/fixture.json'));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'tr-TR' });
  const p = await c.newPage();
  p.on('console', m => console.log('console', m.type(), m.text().slice(0, 200)));
  p.on('response', r => { if (r.url().includes('/rpc/') && r.status() >= 400) console.log('rpc', r.status(), r.url().split('/rpc/')[1]); });
  await p.goto(f.app + '/sign-in');
  await p.getByLabel('E-posta', { exact: true }).fill(f.creds[process.argv[2]].email);
  await p.getByLabel('Şifre', { exact: true }).fill(f.creds[process.argv[2]].password);
  await p.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await p.waitForURL(u => !u.pathname.startsWith('/sign-in'));
  await p.goto(f.app + process.argv[3]);
  await p.waitForTimeout(4000);
  console.log(await p.evaluate(process.argv[4] || 'document.querySelector("main").innerText.slice(0,1500)'));
  await p.screenshot({ path: process.env.C07_WORK + '/debug.png', fullPage: true });
  await browser.close();
})();
