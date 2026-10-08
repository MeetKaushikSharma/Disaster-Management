/**
 * Database connection helper.
 * Uses MONGO_URI from environment. Logs connection status.
 */

const mongoose = require('mongoose');

const connectDB = async (retries = 5, delay = 3000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10_000,
      });
      console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.error(`[DB] Connection attempt ${i}/${retries} failed:`, err.message);
      if (i < retries) {
        console.log(`[DB] Retrying connection in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error('[DB] All connection retries failed. Please check internet connection / DNS.');
        process.exit(1);
      }
    }
  }
};

mongoose.connection.on('disconnected', () =>
  console.warn('[DB] MongoDB disconnected — retrying…')
);

module.exports = connectDB;
