module.exports = function loopbackFixtureFetch(input, init) {
  const url = new URL(input);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password) {
    throw new Error('Fixture requests require a local HTTP endpoint with an explicit port');
  }
  return fetch(url, { ...init, redirect: 'error' });
};
