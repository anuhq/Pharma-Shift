const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { randomBytes } = require('node:crypto');

const {
  findAccountByUsername,
} = require('../models/authModel');
const {
  hashPassword,
  verifyPassword,
} = require('../security/password');
const {
  requireAuth,
  toPublicUser,
} = require('../middleware/authMiddleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

let dummyHashPromise;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(32).toString('hex'));
  }

  return dummyHashPromise;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username =
      typeof req.body?.username === 'string'
        ? req.body.username.trim()
        : '';

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : '';

    if (
      username.length < 1 ||
      username.length > 50 ||
      password.length < 1 ||
      password.length > 256
    ) {
      return res.status(400).json({
        message: 'Username or password is invalid.',
      });
    }

    const account = await findAccountByUsername(username);
    const storedHash = account?.password_hash || await getDummyHash();
    const passwordMatches = await verifyPassword(password, storedHash);

    const accountIsActive =
      account &&
      account.user_status === 'Active' &&
      account.employee_status === 'Active';

    if (!passwordMatches || !accountIsActive) {
      return res.status(401).json({
        message: 'Invalid username or password.',
      });
    }

    await regenerateSession(req);

    req.session.user = toPublicUser(account);
    await saveSession(req);

    return res.status(200).json({
      user: req.session.user,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    user: toPublicUser(req.currentUser),
  });
});

router.post('/logout', (req, res, next) => {
  if (!req.session) {
    return res.status(204).end();
  }

  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie(
      process.env.SESSION_COOKIE_NAME || 'pharmashift.sid'
    );

    res.status(204).end();
  });
});

module.exports = router;