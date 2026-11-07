import { closeSync, constants, fstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export function readPilotState(file) {
  let fd;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error('pilot_state_requires_private_regular_file');
    return JSON.parse(readFileSync(fd, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function savePilotState(file, state) {
  const directory = new URL('./', file);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = new URL('.pilot-state-' + randomUUID(), directory);
  const fd = openSync(temporary, 'wx', 0o600);
  try {
    try {
      writeFileSync(fd, JSON.stringify(state, null, 1));
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, file);
  } catch (error) {
    unlinkSync(temporary);
    throw error;
  }
}
