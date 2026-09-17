/**
 * Database connection helper.
 * Uses MONGO_URI from environment. Logs connection status.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are no longer needed in Mongoose 7+ but kept for clarity
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () =>
  console.warn('[DB] MongoDB disconnected — retrying…')
);

module.exports = connectDB;
