const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');

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

module.exports = app;