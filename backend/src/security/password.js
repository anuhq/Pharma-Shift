const { promisify } = require('node:util');
const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require('node:crypto');

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const COST = 131072;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 256 * 1024 * 1024;
const SALT_LENGTH = 16;

function validatePassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 256
  ) {
    throw new TypeError('Password must be between 1 and 256 characters.');
  }
}

async function hashPassword(password) {
  validatePassword(password);

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });

  return [
    'scrypt',
    `N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION}`,
    salt.toString('base64url'),
    Buffer.from(derivedKey).toString('base64url'),
  ].join('$');
}

function parseHash(encodedHash) {
  const parts = encodedHash.split('$');

  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return null;
  }

  const parameters = {};
  for (const item of parts[1].split(',')) {
    const [name, value] = item.split('=');
    if (!name || !value) {
      return null;
    }
    parameters[name] = Number(value);
  }

  const { N, r, p } = parameters;
  const validCost =
    Number.isInteger(N) &&
    N >= 16384 &&
    N <= 262144 &&
    (N & (N - 1)) === 0;

  if (
    !validCost ||
    !Number.isInteger(r) ||
    r < 1 ||
    r > 32 ||
    !Number.isInteger(p) ||
    p < 1 ||
    p > 4
  ) {
    return null;
  }

  const salt = Buffer.from(parts[2], 'base64url');
  const expectedKey = Buffer.from(parts[3], 'base64url');

  if (salt.length < SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
    return null;
  }

  return { N, r, p, salt, expectedKey };
}

async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') {
    return false;
  }

  const parsed = parseHash(encodedHash);
  if (!parsed) {
    return false;
  }

  try {
    const derivedKey = Buffer.from(
      await scrypt(password, parsed.salt, parsed.expectedKey.length, {
        N: parsed.N,
        r: parsed.r,
        p: parsed.p,
        maxmem: MAX_MEMORY,
      })
    );

    return (
      derivedKey.length === parsed.expectedKey.length &&
      timingSafeEqual(derivedKey, parsed.expectedKey)
    );
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};