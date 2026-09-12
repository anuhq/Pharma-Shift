const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
  })
);

app.use(
  express.json({
    limit: '100kb',
  })
);

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'PharmaShift API is running',
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/tasks', taskRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
  if (error.status === 400) return res.status(400).json({ message: error.message });
  console.error('API request failed:', error.code || error.name);
  res.status(500).json({ message: 'Unable to complete the request. Please try again.' });
});

module.exports = app;
