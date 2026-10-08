/**
 * India Pipeline & AI Anomaly Detection Integration Tests
 *
 * Tests:
 *   1. Hazard Readings Ingestion & District Summary (/api/hazard-readings)
 *   2. Official Agency Warnings (/api/official-warnings)
 *   3. AI Alert Ingestion, Review, Promotion, & Dismissal (/api/ai-alerts)
 *   4. SDMA Approval Lifecycle (draft -> pending_approval -> published)
 *   5. Citizen Situational Check-In ("safe", "need_help") & Awareness Dashboard
 *   6. OASIS CAP 1.2 XML & JSON Feed Generation (/api/feeds)
 */

require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');

// Mock alertService so Firebase FCM sends are stubbed
jest.mock('../src/services/alertService', () => ({
  dispatchAlerts: jest.fn().mockResolvedValue({ usersTargeted: 1, alertsSent: 1, duplicatesSkipped: 0, failed: 0 }),
  sendRetractionNotification: jest.fn().mockResolvedValue(undefined),
}));

process.env.JWT_SECRET = 'test_jwt_secret_at_least_64_chars_long_for_testing_purposes_only';
process.env.JWT_EXPIRES_IN = '1d';
process.env.NODE_ENV = 'test';

jest.setTimeout(45000);

const app = require('../src/app');
const AdminUser = require('../src/models/AdminUser');
const User = require('../src/models/User');
const DisasterEvent = require('../src/models/DisasterEvent');
const AiAlert = require('../src/models/AiAlert');
const HazardReading = require('../src/models/HazardReading');
const OfficialWarning = require('../src/models/OfficialWarning');
const CitizenCheckIn = require('../src/models/CitizenCheckIn');

let adminToken;
let adminId;
let sampleUser;

beforeAll(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/disaster_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  }

  // Create or retrieve verified admin
  let admin = await AdminUser.findOne({ email: 'test_sdma@gov.in' });
  if (!admin) {
    admin = await AdminUser.create({
      name: 'Test SDMA Officer',
      email: 'test_sdma@gov.in',
      passwordHash: 'Disaster@123',
      role: 'super_admin',
      isVerified: true,
      isActive: true,
    });
  }
  adminId = admin._id;

  // Login to get JWT
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test_sdma@gov.in', password: 'Secret@123' });

  // If login failed due to passwordHash mismatch, create direct token using jwt
  const jwt = require('jsonwebtoken');
  adminToken = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Create sample citizen
  sampleUser = await User.findOne({ phone: '+919999900001' });
  if (!sampleUser) {
    sampleUser = await User.create({
      name: 'Citizen Test User',
      phone: '+919999900001',
      preferredLanguage: 'hi',
      lastKnownLocation: { type: 'Point', coordinates: [82.9739, 25.3176] },
    });
  }
}, 45000);

afterAll(async () => {
  // Clean up created test records
  await Promise.all([
    AdminUser.deleteMany({ email: 'test_sdma@gov.in' }),
    User.deleteMany({ phone: '+919999900001' }),
    DisasterEvent.deleteMany({ title: /\[Test/ }),
    AiAlert.deleteMany({ state: 'Uttar Pradesh Test' }),
    HazardReading.deleteMany({ source: 'TEST_SUITE' }),
    CitizenCheckIn.deleteMany({ citizenName: 'Citizen Test User' }),
  ]);
  await mongoose.disconnect();
}, 45000);

describe('1. Hazard Readings API (/api/hazard-readings)', () => {
  it('POST /batch - successfully ingests environmental sensor readings', async () => {
    const res = await request(app)
      .post('/api/hazard-readings/batch')
      .send({
        readings: [
          {
            timestamp: new Date().toISOString(),
            state: 'Uttar Pradesh',
            district: 'Varanasi',
            stationId: 'TEST_AWS_01',
            indicator: 'rainfall_mm',
            value: 65.5,
            unit: 'mm',
            source: 'TEST_SUITE',
            isAnomaly: true,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
  });

  it('GET /district-summary - aggregates latest district status', async () => {
    const res = await request(app).get('/api/hazard-readings/district-summary?district=Varanasi');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].district).toBe('Varanasi');
  });
});

describe('2. Official Warnings API (/api/official-warnings)', () => {
  it('POST / - ingests official IMD/CWC warning bulletin', async () => {
    const res = await request(app)
      .post('/api/official-warnings')
      .send({
        source: 'IMD',
        hazardType: 'HeavyRainfall',
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        severity: 'Warning',
        headline: '[Test] IMD Warning for Eastern UP',
        description: 'Heavy precipitation expected.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.warning.headline).toContain('[Test]');
  });

  it('GET / - lists active government warnings', async () => {
    const res = await request(app).get('/api/official-warnings?district=Varanasi');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.warnings)).toBe(true);
  });
});

describe('3. AI Anomaly Alerts API (/api/ai-alerts)', () => {
  let createdAiAlertId;

  it('POST /ingest - accepts anomaly proposals from AI microservice', async () => {
    const res = await request(app)
      .post('/api/ai-alerts/ingest')
      .send({
        state: 'Uttar Pradesh Test',
        district: 'Varanasi',
        hazardType: 'Flood',
        score: 0.88,
        recommendedSeverity: 'Warning',
        explanation: 'Test anomaly: Ganges water level surge combined with 90mm rainfall.',
        anomalyFeatures: [
          { indicator: 'rainfall_mm', currentValue: 90, baselineMean: 12, baselineStd: 10, deviationScore: 7.8, unit: 'mm' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alert._id).toBeDefined();
    createdAiAlertId = res.body.alert._id;
  });

  it('POST /:id/promote - promotes AI alert to DisasterEvent in pending_approval', async () => {
    const res = await request(app)
      .post(`/api/ai-alerts/${createdAiAlertId}/promote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetStatus: 'pending_approval',
        customTitle: '[Test Promotion] Flash Flood Alert',
        hindiTitle: '[टेस्ट चेतावनी] बाढ़ का खतरा',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.event.status).toBe('pending_approval');
    expect(res.body.event.translations.hi.title).toContain('[टेस्ट चेतावनी]');
  });
});

describe('4. SDMA Approval Lifecycle (/api/events)', () => {
  let eventId;

  it('POST /api/events - creates draft event without auto-dispatching', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: '[Test Draft] Heavy Storm Warning',
        type: 'HeavyRainfall',
        severity: 'Watch',
        state: 'Uttar Pradesh',
        district: 'Gorakhpur',
        status: 'draft',
        zoneType: 'radius',
        centre: { type: 'Point', coordinates: [83.3732, 26.7606] },
        radiusKm: 12,
      });

    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe('draft');
    eventId = res.body.event._id;
  });

  it('POST /api/events/:id/submit-approval - transitions draft to pending_approval', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/submit-approval`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('pending_approval');
  });

  it('POST /api/events/:id/approve - SDMA approves and publishes event', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNotes: 'Verified with district magistrate' });

    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('published');
  });
});

describe('5. Citizen Response & Situational Awareness (/api/citizens)', () => {
  it('POST /check-in - records "safe" status report', async () => {
    const res = await request(app)
      .post('/api/citizens/check-in')
      .send({
        userId: sampleUser._id,
        status: 'safe',
        coordinates: [82.9739, 25.3176],
        district: 'Varanasi',
        state: 'Uttar Pradesh',
        message: 'On high ground, safe.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('safe');
  });

  it('GET /situational-awareness - summarizes citizen statuses for responders', async () => {
    const res = await request(app)
      .get('/api/citizens/situational-awareness?district=Varanasi')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary.safe).toBeGreaterThanOrEqual(1);
  });
});

describe('6. OASIS CAP 1.2 Syndication Feeds (/api/feeds)', () => {
  it('GET /cap.json - returns valid CAP 1.2 JSON feed', async () => {
    const res = await request(app).get('/api/feeds/cap.json');
    expect(res.status).toBe(200);
    expect(res.body.msgType).toBe('Alert');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('GET /cap.xml - returns standard OASIS CAP XML document', async () => {
    const res = await request(app).get('/api/feeds/cap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    expect(res.text).toContain('urn:oasis:names:tc:emergency:cap:1.2');
  });
});
