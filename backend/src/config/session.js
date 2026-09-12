const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./db');

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || Buffer.byteLength(sessionSecret, 'utf8') < 32) {
  throw new Error('SESSION_SECRET must be at least 32 bytes.');
}

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 30 * 60 * 1000,
    createDatabaseTable: false,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool
);

const isProduction = process.env.NODE_ENV === 'production';

const sessionMiddleware = session({
  name: process.env.SESSION_COOKIE_NAME || 'pharmashift.sid',
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 30 * 60 * 1000,
  },
});

module.exports = {
  sessionMiddleware,
  sessionStore,
};