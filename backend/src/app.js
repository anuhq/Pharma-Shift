const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const roleRoutes = require('./routes/roleRoutes');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
  }),
);

// Read JSON request bodies
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'PharmaShift API is running',
  });
});

// Check the database connection
app.use('/api/health', healthRoutes);

// Employee records and available roles
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);

module.exports = app;