/**
 * Seed Script: India Pipeline & Environmental Telemetry
 *
 * Populates:
 *   1. System Administrator accounts for Delhi-NCR & SDMA
 *   2. 30 days of environmental time-series (rainfall, river level, temp, humidity, wind)
 *      with full coverage of Delhi-NCR districts (Delhi, Noida, Gautam Buddha Nagar,
 *      Ghaziabad, Faridabad, Gurugram) and UP baseline districts.
 *   3. Active official agency warnings (IMD & CWC) for Delhi-NCR and UP.
 *   4. AI-detected anomaly alerts with natural-language explainability and proper coordinates.
 *   5. Published Disaster Events for Delhi-NCR flood & waterlogging monitoring.
 *   6. Citizen check-in reports ("Safe" and "Need Help") in Delhi-NCR danger zones.
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

// ── Comprehensive District & Hydrological Metadata ─────────────────────────────
// Sourced from CWC gauge marks and IMD climatological normals
const DISTRICTS_METADATA = [
  // ── Delhi-NCR Core Districts ──────────────────────────────────────────────
  {
    district: 'Delhi',
    state: 'Delhi',
    coords: [77.1025, 28.7041],
    river: 'Yamuna',
    riverStationName: 'Yamuna River Gauge (Old Railway Bridge / Delhi)',
    warningLevel: 203.75,
    dangerLevel: 204.83,
    baselineRain: 8.5,
    baselineRiver: 202.40,
    baselineTemp: 33.0,
    baselineHumidity: 58,
    baselineWind: 14.0,
    isNcr: true,
  },
  {
    district: 'Noida',
    state: 'Uttar Pradesh',
    coords: [77.3910, 28.5355],
    river: 'Yamuna / Hindon',
    riverStationName: 'Noida Yamuna Bridge Gauge',
    warningLevel: 200.50,
    dangerLevel: 201.50,
    baselineRain: 8.0,
    baselineRiver: 198.80,
    baselineTemp: 33.5,
    baselineHumidity: 60,
    baselineWind: 13.5,
    isNcr: true,
  },
  {
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    coords: [77.5040, 28.4744],
    river: 'Yamuna / Hindon',
    riverStationName: 'Greater Noida Gauge (Gautam Buddha Nagar)',
    warningLevel: 199.80,
    dangerLevel: 200.80,
    baselineRain: 7.5,
    baselineRiver: 198.10,
    baselineTemp: 33.0,
    baselineHumidity: 62,
    baselineWind: 12.0,
    isNcr: true,
  },
  {
    district: 'Ghaziabad',
    state: 'Uttar Pradesh',
    coords: [77.4538, 28.6692],
    river: 'Hindon',
    riverStationName: 'Hindon Bridge Gauge, Ghaziabad',
    warningLevel: 198.00,
    dangerLevel: 199.00,
    baselineRain: 9.0,
    baselineRiver: 196.50,
    baselineTemp: 33.8,
    baselineHumidity: 59,
    baselineWind: 13.0,
    isNcr: true,
  },
  {
    district: 'Faridabad',
    state: 'Haryana',
    coords: [77.3178, 28.4089],
    river: 'Yamuna / Agra Canal',
    riverStationName: 'Faridabad Yamuna Gauge',
    warningLevel: 201.50,
    dangerLevel: 202.50,
    baselineRain: 7.0,
    baselineRiver: 199.70,
    baselineTemp: 34.2,
    baselineHumidity: 56,
    baselineWind: 15.0,
    isNcr: true,
  },
  {
    district: 'Gurugram',
    state: 'Haryana',
    coords: [77.0266, 28.4595],
    river: 'Najafgarh Drain / Sahibi',
    riverStationName: 'Gurugram Najafgarh Gauge',
    warningLevel: 217.00,
    dangerLevel: 218.00,
    baselineRain: 6.5,
    baselineRiver: 215.20,
    baselineTemp: 34.5,
    baselineHumidity: 54,
    baselineWind: 16.0,
    isNcr: true,
  },

  // ── Uttar Pradesh Baseline Districts ──────────────────────────────────────
  {
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    coords: [82.9739, 25.3176],
    river: 'Ganga',
    riverStationName: 'Ganga River Gauge (Dashashwamedh / Varanasi)',
    warningLevel: 70.26,
    dangerLevel: 71.26,
    baselineRain: 12.5,
    baselineRiver: 68.50,
    baselineTemp: 32.0,
    baselineHumidity: 65,
    baselineWind: 11.0,
    isNcr: false,
  },
  {
    district: 'Gorakhpur',
    state: 'Uttar Pradesh',
    coords: [83.3732, 26.7606],
    river: 'Rapti',
    riverStationName: 'Rapti River Gauge (Birdghat / Gorakhpur)',
    warningLevel: 73.98,
    dangerLevel: 74.98,
    baselineRain: 18.0,
    baselineRiver: 72.80,
    baselineTemp: 31.0,
    baselineHumidity: 70,
    baselineWind: 10.0,
    isNcr: false,
  },
  {
    district: 'Prayagraj',
    state: 'Uttar Pradesh',
    coords: [81.8463, 25.4358],
    river: 'Ganga / Yamuna Sangam',
    riverStationName: 'Sangam River Gauge (Prayagraj)',
    warningLevel: 83.73,
    dangerLevel: 84.73,
    baselineRain: 14.0,
    baselineRiver: 81.20,
    baselineTemp: 33.5,
    baselineHumidity: 62,
    baselineWind: 12.0,
    isNcr: false,
  },
  {
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    coords: [80.9462, 26.8467],
    river: 'Gomti',
    riverStationName: 'Gomti River Gauge (Lucknow)',
    warningLevel: 108.50,
    dangerLevel: 109.50,
    baselineRain: 10.0,
    baselineRiver: 106.20,
    baselineTemp: 34.0,
    baselineHumidity: 64,
    baselineWind: 10.5,
    isNcr: false,
  },
];

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected successfully.');

  // ── 1. Seed or verify Admin User ─────────────────────────────────────────────
  console.log('[Seed] Checking Admin accounts...');
  let admin = await AdminUser.findOne({ email: 'admin@disaster.gov.in' });
  if (!admin) {
    admin = await AdminUser.findOne({ role: 'super_admin' });
  }

  if (!admin) {
    admin = await AdminUser.create({
      name: 'System Admin',
      email: 'admin@disaster.gov.in',
      passwordHash: 'Disaster@12345',
      role: 'super_admin',
      assignedState: 'Delhi NCR',
      assignedDistricts: ['Delhi', 'Noida', 'Gautam Buddha Nagar', 'Ghaziabad', 'Faridabad', 'Gurugram'],
      isVerified: true,
      isActive: true,
    });
    console.log('[Seed] Created default super_admin: admin@disaster.gov.in');
  } else {
    console.log(`[Seed] Found active super_admin: ${admin.email}`);
  }

  // ── 2. Find or create sample Citizen Users ───────────────────────────────────
  console.log('[Seed] Ensuring sample citizen profiles...');
  const sampleCitizens = [
    {
      phone: '+919876543210',
      name: 'Rajesh Sharma',
      preferredLanguage: 'hi',
      coordinates: [77.3910, 28.5355], // Noida Sector 62
      district: 'Noida',
      state: 'Uttar Pradesh',
    },
    {
      phone: '+919876543211',
      name: 'Priya Verma',
      preferredLanguage: 'en',
      coordinates: [77.2350, 28.6650], // Delhi near Yamuna Bazar
      district: 'Delhi',
      state: 'Delhi',
    },
    {
      phone: '+919876543212',
      name: 'Amit Kumar',
      preferredLanguage: 'hi',
      coordinates: [77.4980, 28.4680], // Greater Noida Knowledge Park
      district: 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
    },
    {
      phone: '+919876543213',
      name: 'Sunita Rao',
      preferredLanguage: 'en',
      coordinates: [77.4538, 28.6692], // Ghaziabad
      district: 'Ghaziabad',
      state: 'Uttar Pradesh',
    },
  ];

  const citizenMap = {};
  for (const c of sampleCitizens) {
    let user = await User.findOne({ phone: c.phone });
    if (!user) {
      user = await User.create({
        name: c.name,
        phone: c.phone,
        preferredLanguage: c.preferredLanguage,
        lastKnownLocation: {
          type: 'Point',
          coordinates: c.coordinates,
        },
      });
    }
    citizenMap[c.phone] = user;
  }

  // ── 3. Seed active Disaster Events for Delhi-NCR ─────────────────────────────
  console.log('[Seed] Ensuring baseline Disaster Events for Delhi-NCR...');
  await DisasterEvent.deleteMany({ title: { $regex: /\[Seed\]/i } });

  const activeEvent = await DisasterEvent.create({
    title: '[Seed] Yamuna Basin High Water Advisory — Delhi & Noida Floodplains',
    type: 'Flood',
    severity: 'Warning',
    description: 'Yamuna River discharge from upstream barrages has elevated water marks across Delhi and Noida floodplains. Low-lying riverbeds under close observation.',
    state: 'Delhi',
    district: 'Delhi',
    targetStates: ['Delhi', 'Uttar Pradesh'],
    targetDistricts: ['Delhi', 'Noida', 'Gautam Buddha Nagar'],
    zoneType: 'radius',
    centre: {
      type: 'Point',
      coordinates: [77.2090, 28.6139],
    },
    radiusKm: 16,
    bufferRadiusKm: 5,
    status: 'published',
    createdBy: admin._id,
    translations: {
      hi: {
        title: '[चेतावनी] यमुना बेसिन जलस्तर अलर्ट — दिल्ली एवं नोएडा खादर क्षेत्र',
        description: 'यमुना नदी में ऊपरी बैराजों से पानी छोड़े जाने के कारण जलस्तर चेतावनी बिंदु के करीब। निचले क्षेत्रों में सतर्कता बरतें।',
      },
    },
  });

  const waterlogEvent = await DisasterEvent.create({
    title: '[Seed] Monsoon Waterlogging Advisory — Greater Noida & Ghaziabad',
    type: 'UrbanWaterlogging',
    severity: 'Watch',
    description: 'Heavy localized rainfall has triggered water accumulation in low-lying underpasses and arterial corridors.',
    state: 'Uttar Pradesh',
    district: 'Gautam Buddha Nagar',
    targetStates: ['Uttar Pradesh'],
    targetDistricts: ['Gautam Buddha Nagar', 'Ghaziabad'],
    zoneType: 'radius',
    centre: {
      type: 'Point',
      coordinates: [77.5040, 28.4744],
    },
    radiusKm: 14,
    bufferRadiusKm: 4,
    status: 'published',
    createdBy: admin._id,
  });

  // ── 4. Seed 30 Days of Environmental Telemetry ───────────────────────────────
  console.log('[Seed] Generating 30 days of environmental telemetry for Delhi-NCR & UP...');
  // Clean simulated readings cleanly
  await HazardReading.deleteMany({ source: 'SIMULATED' });

  const readings = [];
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const meta of DISTRICTS_METADATA) {
    const slug = meta.district.toUpperCase().replace(/\s+/g, '_');

    // Generate 31 daily readings (30 days ago to current day 0)
    for (let day = 30; day >= 0; day--) {
      const timestamp = new Date(now - day * DAY_MS);

      // Delhi & Gautam Buddha Nagar have recent elevated anomalies on day <= 1
      const isSpike = day <= 1 && (meta.district === 'Delhi' || meta.district === 'Gautam Buddha Nagar' || meta.district === 'Varanasi');

      // 1. Rainfall (mm)
      const rainVal = isSpike
        ? +(meta.baselineRain * 5.2 + Math.random() * 22).toFixed(1) // Spike: 55 - 85 mm
        : +(Math.max(0, meta.baselineRain + (Math.random() * 6 - 3))).toFixed(1);

      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${slug}_AWS_01`,
        stationName: `${meta.district} Automatic Weather Station`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'rainfall_mm',
        value: rainVal,
        unit: 'mm',
        source: 'SIMULATED',
        isAnomaly: isSpike,
        anomalyScore: isSpike ? 0.88 : 0.05,
      });

      // 2. River Level (m)
      const riverVal = isSpike
        ? +(meta.baselineRiver + (meta.dangerLevel - meta.baselineRiver) * 0.96 + Math.random() * 0.3).toFixed(2)
        : +(meta.baselineRiver + (Math.random() * 0.5 - 0.25)).toFixed(2);

      const isRiverHigh = riverVal >= meta.warningLevel;

      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${slug}_GAUGE_01`,
        stationName: meta.riverStationName || `${meta.river} River Gauge (${meta.district})`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'river_level_m',
        value: riverVal,
        unit: 'm',
        warningLevel: meta.warningLevel,
        dangerLevel: meta.dangerLevel,
        source: 'SIMULATED',
        isAnomaly: isSpike && isRiverHigh,
        anomalyScore: isSpike ? (riverVal >= meta.dangerLevel ? 0.95 : 0.86) : 0.07,
      });

      // 3. Temperature (°C)
      const tempVal = +(meta.baselineTemp + (Math.random() * 3.6 - 1.8)).toFixed(1);
      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${slug}_OBS_01`,
        stationName: `${meta.district} Meteorological Observatory`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'temperature_c',
        value: tempVal,
        unit: '°C',
        source: 'SIMULATED',
        isAnomaly: tempVal >= 40.0,
        anomalyScore: tempVal >= 40.0 ? 0.75 : 0.10,
      });

      // 4. Humidity (%)
      const humVal = Math.round(Math.min(98, Math.max(30, meta.baselineHumidity + (isSpike ? 24 : Math.random() * 12 - 6))));
      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${slug}_HUM_01`,
        stationName: `${meta.district} Humidity Sensor`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'humidity_pct',
        value: humVal,
        unit: '%',
        source: 'SIMULATED',
        isAnomaly: false,
        anomalyScore: 0.05,
      });

      // 5. Wind Speed (km/h)
      const windVal = +(meta.baselineWind + (isSpike ? 28 : Math.random() * 8 - 4)).toFixed(1);
      readings.push({
        timestamp,
        state: meta.state,
        district: meta.district,
        stationId: `${slug}_ANEMO_01`,
        stationName: `${meta.district} Anemometer Station`,
        location: { type: 'Point', coordinates: meta.coords },
        indicator: 'wind_speed_kmh',
        value: Math.max(0, windVal),
        unit: 'km/h',
        source: 'SIMULATED',
        isAnomaly: windVal >= 55,
        anomalyScore: windVal >= 55 ? 0.70 : 0.05,
      });
    }
  }

  await HazardReading.insertMany(readings, { ordered: false });
  console.log(`[Seed] Ingested ${readings.length} time-series readings across ${DISTRICTS_METADATA.length} districts.`);

  // ── 5. Seed Official Agency Warnings (IMD / CWC) ─────────────────────────────
  console.log('[Seed] Seeding Official Agency Warnings (IMD & CWC for Delhi-NCR & UP)...');
  await OfficialWarning.deleteMany({
    $or: [
      { 'rawData.seedGenerated': true },
      { headline: { $regex: /\[Test\]/i } },
      { source: { $in: ['IMD', 'CWC'] } },
    ],
  });

  const warningsToSeed = [
    {
      source: 'CWC',
      hazardType: 'Flood',
      state: 'Delhi',
      district: 'Delhi',
      severity: 'Warning',
      headline: 'CWC Hydrological Alert: Yamuna River Approaching Warning Mark at Old Railway Bridge',
      description: 'Yamuna water level at Delhi Old Railway Bridge is rising steadily due to discharges from Hathnikund Barrage and localized monsoon catchment flows.',
      recommendedAction: 'Alert boatmen, vacate low-lying riverbank settlements along Yamuna Bazar and Monastery Market.',
      issuedAt: new Date(now - 2 * 3600 * 1000),
      validTo: new Date(now + 36 * 3600 * 1000),
      isActive: true,
      rawData: { seedGenerated: true },
    },
    {
      source: 'IMD',
      hazardType: 'HeavyRainfall',
      state: 'Uttar Pradesh',
      district: 'Gautam Buddha Nagar',
      severity: 'Warning',
      headline: 'IMD Orange Bulletin: Heavy Rainfall & Waterlogging Alert for Gautam Buddha Nagar & Noida',
      description: 'Intense rain bands likely to produce localized water accumulation across Greater Noida expressways and low-lying residential sectors over the next 24 hours.',
      recommendedAction: 'Avoid traversing flooded underpasses; municipal pumping stations on standby.',
      issuedAt: new Date(now - 3 * 3600 * 1000),
      validTo: new Date(now + 24 * 3600 * 1000),
      isActive: true,
      rawData: { seedGenerated: true },
    },
    {
      source: 'CWC',
      hazardType: 'Flood',
      state: 'Uttar Pradesh',
      district: 'Ghaziabad',
      severity: 'Watch',
      headline: 'CWC Hydrological Advisory: Hindon River Surge at Karhera Gauge',
      description: 'Upstream inflows from Saharanpur catchments causing noticeable rise in Hindon River water levels in Ghaziabad.',
      recommendedAction: 'Inspect flood bundhs and ensure drainage sluice gates remain operational.',
      issuedAt: new Date(now - 4 * 3600 * 1000),
      validTo: new Date(now + 30 * 3600 * 1000),
      isActive: true,
      rawData: { seedGenerated: true },
    },
    {
      source: 'IMD',
      hazardType: 'HeavyRainfall',
      state: 'Haryana',
      district: 'Gurugram',
      severity: 'Watch',
      headline: 'IMD Weather Watch: Moderate to Heavy Thunderstorms in Gurugram & Faridabad',
      description: 'Convective cloud cluster moving across southern NCR with potential for temporary urban drainage backflow.',
      recommendedAction: 'Commuters advised to check real-time traffic updates before travelling.',
      issuedAt: new Date(now - 5 * 3600 * 1000),
      validTo: new Date(now + 18 * 3600 * 1000),
      isActive: true,
      rawData: { seedGenerated: true },
    },
    {
      source: 'IMD',
      hazardType: 'HeavyRainfall',
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      severity: 'Warning',
      headline: 'IMD Orange Bulletin: Heavy Rainfall Forecast for Eastern UP & Varanasi',
      description: 'Active monsoon trough causing steady rainfall across eastern Uttar Pradesh river catchments.',
      recommendedAction: 'Avoid low-lying river ghats and ensure storm drainage is clear.',
      issuedAt: new Date(now - 6 * 3600 * 1000),
      validTo: new Date(now + 48 * 3600 * 1000),
      isActive: true,
      rawData: { seedGenerated: true },
    },
  ];

  await OfficialWarning.create(warningsToSeed);
  console.log(`[Seed] Seeded ${warningsToSeed.length} official agency warnings.`);

  // ── 6. Seed AI Anomaly Alerts (Aligned with Delhi-NCR) ────────────────────────
  console.log('[Seed] Seeding AI Anomaly Alerts (Delhi-NCR & UP)...');
  await AiAlert.deleteMany({ status: 'pending_review' });

  const aiAlertsToSeed = [
    {
      state: 'Delhi',
      district: 'Delhi',
      hazardType: 'Flood',
      score: 0.88,
      threshold: 0.55,
      recommendedSeverity: 'Warning',
      suggestedCentre: [77.2090, 28.6139],
      suggestedRadiusKm: 15,
      status: 'pending_review',
      anomalyFeatures: [
        {
          indicator: 'river_level_m',
          currentValue: 204.05,
          baselineMean: 202.40,
          baselineStd: 0.45,
          deviationScore: 3.67,
          unit: 'm',
        },
        {
          indicator: 'rainfall_mm',
          currentValue: 64.5,
          baselineMean: 8.5,
          baselineStd: 11.2,
          deviationScore: 5.00,
          unit: 'mm',
        },
      ],
      explanation: 'Multivariate anomaly score 0.88: Yamuna river level at Delhi gauge (204.05 m) has crossed Warning Mark (203.75 m) and is approaching Danger Mark (204.83 m). 24h rainfall (64.5 mm) is 5.00σ above seasonal normal.',
      suggestedActions: [
        'Issue evacuation alert for low-lying floodplains along Yamuna (Yamuna Bazar, Monastery Market)',
        'Mobilize civil defence and NDRF boat teams at Old Delhi railway bridge',
        'Close lower roadway on Old Yamuna Bridge if water reaches 204.50 m',
        'Activate round-the-clock flood control room',
      ],
    },
    {
      state: 'Uttar Pradesh',
      district: 'Gautam Buddha Nagar',
      hazardType: 'FlashFlood',
      score: 0.79,
      threshold: 0.55,
      recommendedSeverity: 'Watch',
      suggestedCentre: [77.5040, 28.4744],
      suggestedRadiusKm: 12,
      status: 'pending_review',
      anomalyFeatures: [
        {
          indicator: 'rainfall_mm',
          currentValue: 58.2,
          baselineMean: 7.5,
          baselineStd: 9.8,
          deviationScore: 5.17,
          unit: 'mm',
        },
        {
          indicator: 'river_level_m',
          currentValue: 199.92,
          baselineMean: 198.10,
          baselineStd: 0.60,
          deviationScore: 3.03,
          unit: 'm',
        },
      ],
      explanation: 'Multivariate anomaly score 0.79: Greater Noida & Noida telemetry indicates intense rainfall burst (58.2 mm). Hindon River gauge (199.92 m) has crossed Warning Mark (199.80 m).',
      suggestedActions: [
        'Inspect Hindon embankment bundhs and drainage sluice gates in Greater Noida',
        'Deploy municipal dewatering pumps to Greater Noida expressway underpasses and low sectors',
        'Issue traffic caution advisory for Noida-Greater Noida link roads',
      ],
    },
    {
      state: 'Uttar Pradesh',
      district: 'Ghaziabad',
      hazardType: 'FlashFlood',
      score: 0.72,
      threshold: 0.55,
      recommendedSeverity: 'Watch',
      suggestedCentre: [77.4538, 28.6692],
      suggestedRadiusKm: 10,
      status: 'pending_review',
      anomalyFeatures: [
        {
          indicator: 'river_level_m',
          currentValue: 198.15,
          baselineMean: 196.50,
          baselineStd: 0.55,
          deviationScore: 3.00,
          unit: 'm',
        },
      ],
      explanation: 'Multivariate anomaly score 0.72: Hindon river gauge at Karhera (198.15 m) is 0.15m above warning mark (198.00 m) due to steady catchment discharges.',
      suggestedActions: [
        'Alert settlements in Hindon low-lying floodplains in Ghaziabad',
        'Activate municipal emergency pumping stations along GT Road drainage channels',
      ],
    },
  ];

  await AiAlert.create(aiAlertsToSeed);
  console.log(`[Seed] Seeded ${aiAlertsToSeed.length} AI anomaly alert proposals.`);

  // ── 7. Seed Citizen Check-ins (Delhi-NCR & UP) ───────────────────────────────
  console.log('[Seed] Seeding Citizen Check-in Reports for Delhi-NCR...');
  await CitizenCheckIn.deleteMany({});

  const checkInsToSeed = [
    {
      userId: citizenMap['+919876543210']._id,
      phone: '+919876543210',
      citizenName: 'Rajesh Sharma',
      status: 'safe',
      location: { type: 'Point', coordinates: [77.3910, 28.5355] },
      district: 'Noida',
      state: 'Uttar Pradesh',
      eventId: activeEvent._id,
      message: 'Water drained off Sector 62 main road, electricity restored. Family is safe inside.',
      peopleCount: 4,
    },
    {
      userId: citizenMap['+919876543211']._id,
      phone: '+919876543211',
      citizenName: 'Priya Verma',
      status: 'need_help',
      location: { type: 'Point', coordinates: [77.2350, 28.6650] },
      district: 'Delhi',
      state: 'Delhi',
      eventId: activeEvent._id,
      message: 'Yamuna flood water reached ground floor near Kashmere Gate. Elderly parents need rescue boat evacuation.',
      peopleCount: 3,
      isAcknowledgedByResponders: false,
    },
    {
      userId: citizenMap['+919876543212']._id,
      phone: '+919876543212',
      citizenName: 'Amit Kumar',
      status: 'safe',
      location: { type: 'Point', coordinates: [77.4980, 28.4680] },
      district: 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
      eventId: waterlogEvent._id,
      message: 'Severe waterlogging outside Knowledge Park III round-about. Safely sheltered in student hostel.',
      peopleCount: 2,
    },
    {
      userId: citizenMap['+919876543213']._id,
      phone: '+919876543213',
      citizenName: 'Sunita Rao',
      status: 'need_help',
      location: { type: 'Point', coordinates: [77.4538, 28.6692] },
      district: 'Ghaziabad',
      state: 'Uttar Pradesh',
      message: 'Hindon backflow in Karhera colony. Need clean drinking water and baby food.',
      peopleCount: 4,
      isAcknowledgedByResponders: false,
    },
  ];

  await CitizenCheckIn.create(checkInsToSeed);
  console.log(`[Seed] Seeded ${checkInsToSeed.length} citizen check-in reports.`);

  console.log('\n======================================================');
  console.log(' [Seed] India Pipeline & Delhi-NCR Seeding Complete!');
  console.log('======================================================');
  console.log(` • Districts Covered   : ${DISTRICTS_METADATA.length} (Delhi-NCR + UP)`);
  console.log(` • Total Readings      : ${readings.length} time-series entries`);
  console.log(` • Official Warnings   : ${warningsToSeed.length} active warnings`);
  console.log(` • AI Alert Proposals  : ${aiAlertsToSeed.length} pending review`);
  console.log(` • Citizen Check-ins   : ${checkInsToSeed.length} reports`);
  console.log(` • Admin Login         : admin@disaster.gov.in / Disaster@12345`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error during execution:', err);
  process.exit(1);
});
