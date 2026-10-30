import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicHttps, publicKeyKind, inspectTestflight } from './check-testflight.mjs';
const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
const fixture = () => ({
  app: { expo: { version: '0.1.0', ios: { bundleIdentifier: 'com.enescevik.gina', icon: { light: 'icon.png' } }, extra: { eas: { projectId: 'cf1726e8-e42c-4eac-a46b-cce9bce13aa9' } } } },
  eas: { build: { production: { autoIncrement: true } }, submit: { production: { ios: { ascAppId: '1234567890' } } } },
  env: { EXPO_PUBLIC_SUPABASE_URL: 'https://example-project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') },
  exists: () => true,
});
test('release endpoints reject local addresses, URL credentials and invalid transport', () => {
  for (const x of ['http://project.supabase.co','https://localhost','https://127.1','https://10.0.0.4','https://172.16.0.1','https://192.168.1.5','https://[::1]','https://[::ffff:127.0.0.1]','https://gina.local','https://example.invalid','https://secret@example.com','https://example.com?token=secret','not a URL']) assert.equal(isPublicHttps(x),false,x);
  assert.equal(isPublicHttps('https://project.supabase.co'),true);
});
test('public keys accept anon/publishable and reject server secrets and malformed tokens', () => {
  assert.equal(publicKeyKind(jwt('anon')), 'anon');
  assert.equal(publicKeyKind('sb_publishable_example'), 'publishable');
  assert.equal(publicKeyKind(jwt('service_role')), 'secret');
  assert.equal(publicKeyKind('sb_secret_example'), 'secret');
  assert.equal(publicKeyKind('h.bad.s'), 'invalid');
  assert.equal(publicKeyKind(''), 'missing');
});
test('repo placeholders and local URL block configuration without echoing values', () => {
  const x=fixture();delete x.app.expo.extra;x.eas.submit.production.ios.ascAppId='APP_STORE_CONNECT_APP_ID';x.env.EXPO_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321';x.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='sb_secret_never_print_this';
  const result=inspectTestflight(x);
  assert.equal(result.configurationReady,false);
  assert.deepEqual(result.findings.filter(x=>x.status==='block').map(x=>x.id),['eas-project','asc-app','supabase-url','supabase-public-key']);
  assert.ok(!JSON.stringify(result).includes('never_print_this'));
});
test('valid-looking configuration never claims account or device readiness', () => {
  const r=inspectTestflight(fixture());assert.equal(r.configurationReady,true);assert.equal(r.scope,'ios-testflight-static-configuration-only');assert.ok(r.manualChecks.length>=6);assert.equal(r.findings.filter(x=>x.status==='warn').length,2);
});
test('development, internal and simulator profiles cannot pass the store preflight', () => {
  for(const change of [{developmentClient:true},{distribution:'internal'},{ios:{simulator:true}}]){const x=fixture();x.eas.build.production=change;assert.equal(inspectTestflight(x).findings.find(x=>x.id==='store-profile').status,'block');}
});
test('missing icon is a build blocker',()=>{const x=fixture();x.exists=()=>false;assert.equal(inspectTestflight(x).findings.find(x=>x.id==='ios-icon').status,'block');});
