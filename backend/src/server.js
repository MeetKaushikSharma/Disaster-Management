/**
 * Server Entry Point
 *
 * Connects to MongoDB, initialises Firebase, then starts the HTTP server.
 */

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const initFirebase = require('./config/firebase');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  initFirebase();

  app.listen(PORT, () => {
    console.log(`[Server] Disaster Management API running on port ${PORT} (${process.env.NODE_ENV})`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
  });
})();
