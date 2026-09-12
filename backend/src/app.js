const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/authRoutes');
const incidentCategoryRoutes = require('./routes/incidentCategoryRoutes');
const incidentRoutes = require('./routes/incidentRoutes');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(sessionMiddleware);

app.get('/', (req, res) => {
  res.status(200).json({ message: 'PharmaShift API is running' });
});

app.use('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/incident-categories', incidentCategoryRoutes);
app.use('/api/incidents', incidentRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(
    'Request failed:',
    req.method,
    req.path,
    error.code || error.name || 'UNKNOWN_ERROR'
  );

  return res.status(500).json({
    message: 'Internal server error.',
  });
});

module.exports = app;