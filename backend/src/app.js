const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const roleRoutes = require('./routes/roleRoutes');
const shiftTypeRoutes = require('./routes/shiftTypeRoutes');
const rosterRoutes = require('./routes/rosterRoutes');

const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/authRoutes');
const incidentCategoryRoutes = require('./routes/incidentCategoryRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const investigationRoutes = require('./routes/investigationRoutes');
const correctiveActionRoutes = require('./routes/correctiveActionRoutes');

const app = express();

const {
  requireAuth,
  requireRole,
} = require('./middleware/authMiddleware');

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(sessionMiddleware);

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'PharmaShift API is running',
  });
});

app.use('/api/health', healthRoutes);

app.use(
  '/api/employees',
  requireAuth,
  requireRole('Owner/Manager'),
  employeeRoutes,
);

app.use(
  '/api/roles',
  requireAuth,
  requireRole('Owner/Manager'),
  roleRoutes,
);

app.use(
  '/api/shift-types',
  requireAuth,
  requireRole('Owner/Manager'),
  shiftTypeRoutes,
);

app.use('/api/roster', rosterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/incident-categories', incidentCategoryRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/corrective-actions', correctiveActionRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(
    'Request failed:',
    req.method,
    req.path,
    error.code || error.name || 'UNKNOWN_ERROR',
  );

  return res.status(500).json({
    message: 'Internal server error.',
  });
});

module.exports = app;