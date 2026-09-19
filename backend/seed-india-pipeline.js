/**
 * Seed Script: India Pipeline & Environmental Telemetry
 *
 * Populates:
 *   1. 30 days of environmental time-series (rainfall, river level, temp) for UP districts
 *   2. Active official agency warnings (IMD & CWC)
 *   3. AI-detected anomaly alerts with natural-language explainability
 *   4. Citizen check-in reports ("Safe" and "Need Help")
 *
 * Usage:
 *   node seed-india-pipeline.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const HazardReading = require('./src/models/HazardReading');
const OfficialWarning = require('./src/models/OfficialWarning');
const AiAlert = require('./src/models/AiAlert');
const CitizenCheckIn = require('./src/models/CitizenCheckIn');
const User = require('./src/models/User');
const AdminUser = require('./src/models/AdminUser');
const DisasterEvent = require('./src/models/DisasterEvent');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/disaster_db';

const DISTRICTS_METADATA = [
  {
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    coords: [82.9739, 25.3176],
    river: 'Ganga',
    warningLevel: 70.26,
    dangerLevel: 71.26,
    baselineRain: 12.5,
    baselineRiver: 68.5,
    baselineTemp: 32.0,
  },
  {
    district: 'Gorakhpur',
    state: 'Uttar Pradesh',
    coords: [83.3732, 26.7606],
    river: 'Rapti',
    warningLevel: 73.98,
    dangerLevel: 74.98,
    baselineRain: 18.0,
    baselineRiver: 72.8,
    baselineTemp: 31.0,
  },
  {
    district: 'Prayagraj',
    state: 'Uttar Pradesh',
    coords: [81.8463, 25.4358],
    river: 'Ganga / Yamuna Sangam',
    warningLevel: 83.73,
    dangerLevel: 84.73,
    baselineRain: 14.0,
    baselineRiver: 81.2,
    baselineTemp: 33.5,
  },
  {
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    coords: [80.9462, 26.8467],
    river: 'Gomti',
    warningLevel: 108.5,
    dangerLevel: 109.5,
    baselineRain: 10.0,
    baselineRiver: 106.2,
    baselineTemp: 34.0,
  },
];

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected successfully.');

  // Find or create super_admin
  let admin = await AdminUser.findOne({ role: 'super_admin' });
  if (!admin) {
    admin = await AdminUser.create({
      name: 'SDMA Chief Officer',
      email: 'chief@sdma.up.gov.in',
      passwordHash: 'Disaster@12345',
      role: 'super_admin',
      assignedState: 'Uttar Pradesh',
      isVerified: true,
      isActive: true,
    });
  }

  // Find or create sample citizen users
  let testUser = await User.findOne({ phone: '+919876543210' });
  if (!testUser) {
    testUser = await User.create({
      name: 'Rajesh Sharma',
      phone: '+919876543210',
      preferredLanguage: 'hi',
      lastKnownLocation: {
        type: 'Point',
        coordinates: [82.9739, 25.3176],
      },
    });
  }

  let testUser2 = await User.findOne({ phone: '+919876543211' });
  if (!testUser2) {
    testUser2 = await User.create({
      name: 'Priya Verma',
      phone: '+919876543211',
      preferredLanguage: 'en',
      lastKnownLocation: {
        type: 'Point',
        coordinates: [82.9850, 25.3250],
      },
    });
  }

  console.log('[Seed] Generating 30 days of environmental telemetry...');
  await HazardReading.deleteMany({ source: 'SIMULATED' });

  const readings = [];
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const meta of DISTRICTS_METADATA) {
    // Generate 30 daily data points
    for (let day = 30; day >= 0; day--) {
      const timestamp = new Date(now - day * DAY_MS);
      const isSpike = day <= 2 && (meta.district === 'Varanasi' || meta.district === 'Gorakhpur');

      // 1. Rainfall
      const rainVal = isSpike
        ? +(meta.baselineRain * 4.5 + Math.random() * 20).toFixed(1) // Spike: 70 - 110mm
        : +(meta.baselineRain + (Math.random() * 8 - 4)).toFixed(1);

      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${meta.district.toUpperCase()}_AWS_01`,
        stationName: `${meta.district} Automatic Weather Station`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'rainfall_mm',
        value: Math.max(0, rainVal),
        unit: 'mm',
        source: 'SIMULATED',
        isAnomaly: isSpike,
        anomalyScore: isSpike ? 0.88 : 0.05,
      });

      // 2. River Level
      const riverVal = isSpike
        ? +(meta.baselineRiver + (meta.dangerLevel - meta.baselineRiver) * 0.95 + Math.random() * 0.4).toFixed(2)
        : +(meta.baselineRiver + (Math.random() * 0.6 - 0.3)).toFixed(2);

      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${meta.district.toUpperCase()}_GAUGE_01`,
        stationName: `${meta.river} River Gauge (${meta.district})`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'river_level_m',
        value: riverVal,
        unit: 'm',
        warningLevel: meta.warningLevel,
        dangerLevel: meta.dangerLevel,
        source: 'SIMULATED',
        isAnomaly: isSpike && riverVal >= meta.warningLevel,
        anomalyScore: isSpike ? 0.92 : 0.08,
      });

      // 3. Temperature
      const tempVal = +(meta.baselineTemp + (Math.random() * 4 - 2)).toFixed(1);
      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${meta.district.toUpperCase()}_TEMP_01`,
        stationName: `${meta.district} Observatory`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'temperature_c',
        value: tempVal,
        unit: '°C',
        source: 'SIMULATED',
        isAnomaly: false,
        anomalyScore: 0.1,
      });
    }
  }

  await HazardReading.insertMany(readings);
  console.log(`[Seed] Ingested ${readings.length} time-series readings.`);

  // Seed Official Warnings
  console.log('[Seed] Seeding Official Agency Warnings (IMD / CWC)...');
  await OfficialWarning.deleteMany({ source: { $in: ['IMD', 'CWC'] } });

  await OfficialWarning.create([
    {
      source: 'IMD',
      hazardType: 'HeavyRainfall',
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      severity: 'Warning',
      headline: 'IMD Orange Bulletin: Heavy to Very Heavy Rainfall in Varanasi & Eastern UP',
      description: 'Active monsoon trough and low pressure depression likely to cause localized waterlogging and rapid river level surges over the next 48 hours.',
      recommendedAction: 'Avoid low-lying river ghats and ensure storm drainage is clear.',
      issuedAt: new Date(now - 3 * 3600 * 1000),
      validTo: new Date(now + 48 * 3600 * 1000),
      isActive: true,
    },
    {
      source: 'CWC',
      hazardType: 'Flood',
      state: 'Uttar Pradesh',
      district: 'Gorakhpur',
      severity: 'Warning',
      headline: 'CWC Hydrological Warning: Rapti River Approaching Danger Mark at Gorakhpur',
      description: 'Water level at Birdghat station is rising at 4 cm/hr due to upstream catchment rainfall in Nepal foothills.',
      recommendedAction: 'Alert embankment patrollers and prepare flood relief shelters.',
      issuedAt: new Date(now - 2 * 3600 * 1000),
      validTo: new Date(now + 24 * 3600 * 1000),
      isActive: true,
    },
  ]);

  // Seed AI Alerts
  console.log('[Seed] Seeding AI Anomaly Alerts...');
  await AiAlert.deleteMany({});

  await AiAlert.create([
    {
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      hazardType: 'Flood',
      score: 0.89,
      threshold: 0.65,
      recommendedSeverity: 'Warning',
      suggestedCentre: [82.9739, 25.3176],
      suggestedRadiusKm: 18,
      status: 'pending_review',
      anomalyFeatures: [
        {
          indicator: 'rainfall_mm',
          currentValue: 98.4,
          baselineMean: 12.5,
          baselineStd: 14.2,
          deviationScore: 6.05,
          unit: 'mm',
        },
        {
          indicator: 'river_level_m',
          currentValue: 71.12,
          baselineMean: 68.5,
          baselineStd: 0.8,
          deviationScore: 3.27,
          unit: 'm',
        },
      ],
      explanation: 'Multivariate anomaly score 0.89: 24h rainfall (98.4 mm) is 6.05σ above seasonal baseline. Ganga water level (71.12 m) is 0.86m above warning mark (70.26 m) and approaching danger mark (71.26 m).',
      suggestedActions: [
        'Issue immediate evacuation advisory for riverbank settlements and low-lying ghats',
        'Mobilize SDRF rescue boats at Dashashwamedh and Assi Ghats',
        'Alert district hospitals and set up water purification camps',
      ],
    },
    {
      state: 'Uttar Pradesh',
      district: 'Gorakhpur',
      hazardType: 'FlashFlood',
      score: 0.78,
      threshold: 0.65,
      recommendedSeverity: 'Watch',
      suggestedCentre: [83.3732, 26.7606],
      suggestedRadiusKm: 15,
      status: 'pending_review',
      anomalyFeatures: [
        {
          indicator: 'rainfall_mm',
          currentValue: 74.2,
          baselineMean: 18.0,
          baselineStd: 12.0,
          deviationScore: 4.68,
          unit: 'mm',
        },
        {
          indicator: 'river_level_m',
          currentValue: 74.35,
          baselineMean: 72.8,
          baselineStd: 0.5,
          deviationScore: 3.10,
          unit: 'm',
        },
      ],
      explanation: 'Multivariate anomaly score 0.78: Rapti river catchment telemetry indicates sudden discharge influx. Influx velocity is rising at 4 cm/hr, crossing warning threshold.',
      suggestedActions: [
        'Inspect Rapti bundhs and river sluice gates',
        'Prepare community shelters in high-elevation schools',
      ],
    },
  ]);

  // Seed Citizen Check-ins
  console.log('[Seed] Seeding Citizen Check-in Reports...');
  await CitizenCheckIn.deleteMany({});

  await CitizenCheckIn.create([
    {
      userId: testUser._id,
      phone: testUser.phone,
      citizenName: 'Rajesh Sharma',
      status: 'safe',
      location: { type: 'Point', coordinates: [82.9739, 25.3176] },
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      message: 'Family is on 2nd floor, water rising in lane but we are currently safe.',
      peopleCount: 4,
    },
    {
      userId: testUser2._id,
      phone: testUser2.phone,
      citizenName: 'Priya Verma',
      status: 'need_help',
      location: { type: 'Point', coordinates: [82.9850, 25.3250] },
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      message: 'Elderly grandparents stranded on ground floor near Manikarnika Ghat. Need rescue boat.',
      peopleCount: 3,
      isAcknowledgedByResponders: false,
    },
  ]);

  console.log('[Seed] Seed script completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
