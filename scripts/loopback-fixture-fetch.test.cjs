const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { test } = require('node:test');
const request = require('./loopback-fixture-fetch.cjs');

test('fixture requests reject non-loopback destinations and credentials in URLs', () => {
  for (const url of ['http://127.0.0.1.example.com:4321', 'http://user@127.0.0.1:4321', 'https://127.0.0.1:4321']) {
    assert.throws(() => request(url), /local HTTP/);
  }
});

test('fixture requests never follow a redirect', async () => {
  let redirected = false;
  const server = createServer((req, res) => {
    if (req.url === '/start') res.writeHead(307, { location: '/redirected' });
    if (req.url === '/redirected') redirected = true;
    res.end('fixture');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    assert.equal(await (await request(origin)).text(), 'fixture');
    await assert.rejects(request(origin + '/start', { method: 'POST', body: 'synthetic' }));
    assert.equal(redirected, false);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
