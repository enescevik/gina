const { closeSync, constants, fstatSync, openSync, readFileSync, realpathSync } = require('node:fs');
const { isAbsolute, relative, resolve, sep } = require('node:path');

module.exports = function readPreviewFile(root, candidate) {
  const base = realpathSync(root);
  const file = realpathSync(resolve(base, '.' + sep + candidate.replace(/^[/\\]+/, '')));
  const inside = relative(base, file);
  if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) return null;

  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    return fstatSync(fd).isFile() ? readFileSync(fd) : null;
  } finally {
    closeSync(fd);
  }
};
