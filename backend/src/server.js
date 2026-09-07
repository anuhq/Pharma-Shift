require('dotenv').config();

const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '127.0.0.1';

async function startServer() {
  try {
    await pool.query('SELECT 1');

    console.log('Database connection successful');

    app.listen(PORT, HOST, () => {
      console.log(
        `PharmaShift backend running at http://${HOST}:${PORT}`
      );
    });
} catch (error) {
  console.error('Unable to connect to the database.');
  console.error('MySQL error code:', error.code);
  process.exit(1);
}
}

startServer();