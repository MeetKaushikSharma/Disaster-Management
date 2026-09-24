/**
 * Phase 1 Integration Tests
 *
 * Uses mongodb-memory-server so no real Atlas connection is needed.
 * Tests every route group for correct status codes and schema validation.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock alertService so Firebase/FCM calls are never made during tests
jest.mock('../src/services/alertService', () => ({
  dispatchAlerts: jest.fn().mockResolvedValue({ usersTargeted: 0, alertsSent: 0, duplicatesSkipped: 0, failed: 0 }),
  sendRetractionNotification: jest.fn().mockResolvedValue(undefined),
}));

// Set required env vars BEFORE app is required (dotenv won't find .env in test)
process.env.JWT_SECRET = 'test_jwt_secret_at_least_64_chars_long_for_testing_purposes_only';
process.env.JWT_EXPIRES_IN = '1d';
process.env.NODE_ENV = 'test';
process.env.DEFAULT_BUFFER_RADIUS_KM = '5';

const app = require('../src/app');
const AdminUser = require('../src/models/AdminUser');
const DisasterEvent = require('../src/models/DisasterEvent');
const SafetyGuide = require('../src/models/SafetyGuide');
const User = require('../src/models/User');
const AlertLog = require('../src/models/AlertLog');

let mongod;
let adminToken;
let adminId;

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create a verified super-admin
  const admin = await AdminUser.create({
    name: 'Test Admin',
    email: 'test@admin.com',
    passwordHash: 'Secret@123',
    role: 'super_admin',
    isVerified: true,
    isActive: true,
  });
  adminId = admin._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clean up data between tests — DO NOT delete AdminUser (created once in beforeAll)
  await DisasterEvent.deleteMany({});
  await SafetyGuide.deleteMany({});
  await User.deleteMany({});
  await AlertLog.deleteMany({});
});

// Capture a shared admin token after DB is ready
beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@admin.com', password: 'Secret@123' });
  adminToken = res.body.token;
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@admin.com', password: 'WrongPass' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns JWT for correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@admin.com', password: 'Secret@123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    adminToken = res.body.token; // used in subsequent tests
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'Secret@123' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@admin.com', password: 'Secret@123' });
    adminToken = res.body.token;
  });

  it('returns admin profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.admin.email).toBe('test@admin.com');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Disaster Events
// ─────────────────────────────────────────────────────────────────────────────
describe('Disaster Event routes', () => {

  const polygonPayload = {
    title: 'Flood Zone Delhi',
    type: 'Flood',
    severity: 'High',
    zoneType: 'polygon',
    polygon: {
      type: 'Polygon',
      coordinates: [[[77.1, 28.6], [77.2, 28.6], [77.2, 28.7], [77.1, 28.7], [77.1, 28.6]]],
    },
    description: 'Flooding in Yamuna floodplains',
  };

  const radiusPayload = {
    title: 'Earthquake Epicentre',
    type: 'Earthquake',
    severity: 'Critical',
    zoneType: 'radius',
    centre: { type: 'Point', coordinates: [73.85, 18.52] },
    radiusKm: 25,
  };

  it('POST /api/events — creates polygon event', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(polygonPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.event.type).toBe('Flood');
    expect(res.body.event.status).toBe('active');
  });

  it('POST /api/events — creates radius event', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(radiusPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.event.severity).toBe('Critical');
  });

  it('POST /api/events — rejects invalid severity', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...polygonPayload, severity: 'Extreme' });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/events — creates multi-state and multi-district event', async () => {
    const multiPayload = {
      title: 'Regional Cyclone Warning',
      type: 'Cyclone',
      severity: 'Critical',
      targetStates: ['Odisha', 'Andhra Pradesh', 'West Bengal'],
      targetDistricts: ['Puri', 'Ganjam', 'Srikakulam', 'Visakhapatnam', 'South 24 Parganas'],
      zoneType: 'radius',
      centre: { type: 'Point', coordinates: [85.83, 19.81] },
      radiusKm: 150,
      description: 'Severe cyclonic storm approaching eastern coastline.',
    };

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(multiPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.event.targetStates).toEqual(['Odisha', 'Andhra Pradesh', 'West Bengal']);
    expect(res.body.event.targetDistricts).toEqual(['Puri', 'Ganjam', 'Srikakulam', 'Visakhapatnam', 'South 24 Parganas']);
    expect(res.body.event.state).toBe('Odisha'); // backward compatibility
    expect(res.body.event.district).toBe('Puri'); // backward compatibility
  });

  it('POST /api/events — maintains backward compatibility for legacy single state and district payload', async () => {
    const legacyPayload = {
      title: 'Legacy Single District Alert',
      type: 'Flood',
      severity: 'Medium',
      state: 'Bihar',
      district: 'Patna',
      zoneType: 'radius',
      centre: { type: 'Point', coordinates: [85.13, 25.6] },
      radiusKm: 20,
    };

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(legacyPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.event.state).toBe('Bihar');
    expect(res.body.event.district).toBe('Patna');
    expect(res.body.event.targetStates).toEqual(['Bihar']);
    expect(res.body.event.targetDistricts).toEqual(['Patna']);
  });

  it('GET /api/events — lists active events', async () => {
    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(polygonPayload);
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
  });

  it('PATCH /api/events/:id/retract — retracts an event', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(polygonPayload);
    const eventId = create.body.event._id;

    const res = await request(app)
      .patch(`/api/events/${eventId}/retract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ correctionMessage: 'False alarm, waters receding', action: 'retract' });

    expect(res.statusCode).toBe(200);
    expect(res.body.event.status).toBe('retracted');
    expect(res.body.event.correctionMessage).toBe('False alarm, waters receding');
  });

  it('PATCH /api/events/:id/retract — cannot retract already retracted event', async () => {
    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(polygonPayload);
    const eventId = create.body.event._id;

    await request(app)
      .patch(`/api/events/${eventId}/retract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/events/${eventId}/retract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────
describe('User routes', () => {
  it('POST /api/users/register — registers a new user', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ name: 'Raju Kumar', phone: '+919876543210', preferredLanguage: 'hi' });
    expect(res.statusCode).toBe(201);
    expect(res.body.user.phone).toBe('+919876543210');
  });

  it('POST /api/users/register — upserts on duplicate phone', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ name: 'Raju Kumar', phone: '+919876543210' });
    const res = await request(app)
      .post('/api/users/register')
      .send({ name: 'Raju Kumar Updated', phone: '+919876543210' });
    expect(res.statusCode).toBe(201); // upsert, not 409
  });

  it('PUT /api/users/:id/location — updates location', async () => {
    const reg = await request(app)
      .post('/api/users/register')
      .send({ name: 'Priya', phone: '+919000000001' });
    const userId = reg.body.userId;

    const res = await request(app)
      .put(`/api/users/${userId}/location`)
      .send({ longitude: 77.2090, latitude: 28.6139 });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Safety Guides
// ─────────────────────────────────────────────────────────────────────────────
describe('Safety Guide routes', () => {

  const guidePayload = {
    disasterType: 'Flood',
    language: 'en',
    title: 'Flood Safety Guide',
    summary: 'What to do during a flood',
    steps: [
      { order: 1, instruction: 'Move to higher ground immediately' },
      { order: 2, instruction: 'Do not walk through moving water' },
      { order: 3, instruction: 'Avoid contact with floodwater' },
    ],
  };

  it('POST /api/guides — creates a guide', async () => {
    const res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(guidePayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.guide.steps).toHaveLength(3);
  });

  it('POST /api/guides — enforces unique (disasterType × language)', async () => {
    await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(guidePayload);

    const res = await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(guidePayload);
    expect(res.statusCode).toBe(409); // duplicate key
  });

  it('GET /api/guides — lists guides without auth', async () => {
    await request(app)
      .post('/api/guides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(guidePayload);
    const res = await request(app).get('/api/guides?disasterType=Flood&language=en');
    expect(res.statusCode).toBe(200);
    expect(res.body.guides.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Alert Deduplication
// ─────────────────────────────────────────────────────────────────────────────
describe('AlertLog deduplication', () => {
  it('insertMany with ordered:false skips duplicate deduplicationKey', async () => {
    const key = 'event123:user456';
    await AlertLog.create({
      eventId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      deduplicationKey: key,
      severityAtSend: 'High',
    });

    // Second insert with same key should not throw
    const docs = [
      {
        eventId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        deduplicationKey: key, // duplicate
        severityAtSend: 'High',
      },
    ];

    await expect(
      AlertLog.insertMany(docs, { ordered: false })
    ).rejects.toMatchObject({ code: 11000 }); // caught by service, not rethrown
  });
});
