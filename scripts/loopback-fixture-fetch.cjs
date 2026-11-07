function loopbackUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password) {
    throw new Error('Fixture requests require a local HTTP endpoint with an explicit port');
  }
  return url;
}

function loopbackFixtureFetch(input, init) {
  return fetch(loopbackUrl(input), { ...init, redirect: 'error' });
}

async function loopbackFixtureRouteFetch(route) {
  loopbackUrl(route.request().url());
  const response = await route.fetch({ maxRedirects: 0 });
  if ([301, 302, 303, 307, 308].includes(response.status())) {
    throw new Error('Fixture requests cannot redirect');
  }
  return response;
}

module.exports = loopbackFixtureFetch;
module.exports.loopbackFixtureRouteFetch = loopbackFixtureRouteFetch;
