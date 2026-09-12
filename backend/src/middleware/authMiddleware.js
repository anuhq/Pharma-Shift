const { findAccountById } = require('../models/authModel');

function toPublicUser(account) {
  return {
    userId: account.user_id,
    employeeId: account.employee_id,
    username: account.username,
    fullName: account.full_name,
    roleName: account.role_name,
  };
}

function rejectSession(req, res) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'pharmashift.sid';

  if (!req.session) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  return req.session.destroy(() => {
    res.clearCookie(cookieName);
    return res.status(401).json({ message: 'Authentication required.' });
  });
}

async function requireAuth(req, res, next) {
  const userId = req.session?.user?.userId;

  if (!Number.isInteger(userId)) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const account = await findAccountById(userId);

  const accountIsActive =
    account &&
    String(account.user_status || '').toLowerCase() === 'active' &&
    String(account.employee_status || '').toLowerCase() === 'active';

  if (!accountIsActive) {
    return rejectSession(req, res);
}

    req.currentUser = account;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...allowedRoles) {
  const roleSet = new Set(allowedRoles);

  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roleSet.has(req.currentUser.role_name)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  toPublicUser,
};