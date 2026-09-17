/**
 * Express Application Factory
 *
 * Separated from server.js so the app can be imported in tests
 * without binding to a port.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const userRoutes = require('./routes/users');
const guideRoutes = require('./routes/guides');
const logRoutes = require('./routes/logs');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — allow admin web (Vercel) and Flutter app origins ───────────────────
const allowedOrigins = [
  'http://localhost:3000',    // React dev server
  'http://localhost:5173',    // Vite dev server
  process.env.ADMIN_ORIGIN,  // Production Vercel URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, Postman)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP request logging (dev only) ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Global rate limiter (500 req / 15 min per IP — covers admin web + mobile) ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — slow down' },
});
app.use('/api', globalLimiter);

// ── Public Flutter endpoints: more lenient limiter (2000 req / 15 min) ─────────
// These handle: user registration, GPS heartbeat, FCM token updates, guide fetching
const mobileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/users/register', mobileLimiter);
app.use('/api/guides', mobileLimiter);

// ── Health check (public) ─────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/logs', logRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Central error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
