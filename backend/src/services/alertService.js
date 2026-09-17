/**
 * Alert Service
 *
 * Core logic for Phase 3 (referenced early so routes can call it).
 * dispatchAlerts(event) — finds users in zone, deduplicates, sends FCM.
 * sendRetractionNotification(event) — sends a correction push to previous recipients.
 *
 * Turf.js is used for all geospatial containment checks:
 *   - polygon events: booleanPointInPolygon
 *   - radius events: booleanPointInPolygon on a buffered circle feature
 *
 * FCM is sent via firebase-admin in batches of 500 (FCM multicast limit).
 */

const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const buffer = require('@turf/buffer').default;
const circle = require('@turf/circle').default;
const { point, polygon } = require('@turf/helpers');

const User = require('../models/User');
const AlertLog = require('../models/AlertLog');
const DisasterEvent = require('../models/DisasterEvent');
const initFirebase = require('../config/firebase');

// ── Severity → notification priority / channel mapping ────────────────────────
const SEVERITY_CONFIG = {
  Low: { androidPriority: 'normal', sound: 'default', ttl: 86400 },
  Medium: { androidPriority: 'high', sound: 'default', ttl: 43200 },
  High: { androidPriority: 'high', sound: 'emergency_buzzer', ttl: 21600 },
  Critical: { androidPriority: 'high', sound: 'emergency_buzzer', ttl: 10800 },
};

/**
 * Fetch ALL users with a valid FCM token and known location.
 * For large deployments, paginate this — here we fetch all (free-tier safe for <50k users).
 */
const fetchEligibleUsers = () =>
  User.find({
    isActive: true,
    notificationsEnabled: true,
    fcmToken: { $exists: true, $ne: null },
    'lastKnownLocation.coordinates': { $exists: true, $ne: [] },
  }).lean();

/**
 * Build the Turf feature representing the event zone + buffer.
 * Returns a GeoJSON Feature<Polygon|MultiPolygon> or null on error.
 */
const buildZoneFeature = (event) => {
  try {
    if (event.zoneType === 'polygon') {
      const poly = polygon(event.polygon.coordinates);
      return event.bufferRadiusKm > 0
        ? buffer(poly, event.bufferRadiusKm, { units: 'kilometers' })
        : poly;
    }

    if (event.zoneType === 'radius') {
      const [lng, lat] = event.centre.coordinates;
      const circ = circle([lng, lat], event.radiusKm, { units: 'kilometers' });
      return event.bufferRadiusKm > 0
        ? buffer(circ, event.bufferRadiusKm, { units: 'kilometers' })
        : circ;
    }
  } catch (err) {
    console.error('[AlertService] Failed to build zone feature:', err.message);
  }
  return null;
};

/**
 * Returns true if the user's last known location falls inside the zone feature.
 * Filters out users whose alertThreshold is above the event severity.
 */
const SEVERITY_ORDER = ['Low', 'Medium', 'High', 'Critical'];

const userIsInZone = (user, zoneFeature) => {
  const [lng, lat] = user.lastKnownLocation.coordinates;
  if (!lng || !lat) return false;
  const pt = point([lng, lat]);
  return booleanPointInPolygon(pt, zoneFeature);
};

const severityMeetsThreshold = (eventSeverity, userThreshold) => {
  return (
    SEVERITY_ORDER.indexOf(eventSeverity) >= SEVERITY_ORDER.indexOf(userThreshold || 'Low')
  );
};

/**
 * Build the FCM message payload for a given user + event.
 */
const buildFcmPayload = (user, event) => {
  const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.Low;

  return {
    token: user.fcmToken,
    notification: {
      title: `[${event.severity}] ${event.title}`,
      body: event.description || `${event.type} alert in your area. Stay safe.`,
    },
    data: {
      eventId: String(event._id),
      type: event.type,
      severity: event.severity,
      safetyGuideId: event.safetyGuideId ? String(event.safetyGuideId) : '',
      language: user.preferredLanguage || 'en',
      sound: cfg.sound,
      isRetraction: 'false',
    },
    android: {
      priority: cfg.androidPriority,
      ttl: cfg.ttl * 1000, // FCM expects milliseconds
      notification: {
        channelId: `disaster_${event.severity.toLowerCase()}_v2`,
        sound: cfg.sound,
        priority: event.severity === 'Critical' ? 'max' : 'high',
        defaultVibrateTimings: false,
        vibrateTimingsMillis: event.severity === 'Critical'
          ? [0, 500, 200, 500, 200, 500]
          : [0, 300, 100, 300],
      },
    },
    apns: {
      headers: { 'apns-priority': event.severity === 'Critical' ? '10' : '5' },
      payload: {
        aps: {
          sound: cfg.sound + '.caf',
          'content-available': 1,
          'interruption-level':
            event.severity === 'Critical' ? 'critical' : 'time-sensitive',
        },
      },
    },
  };
};

/**
 * Send FCM messages in batches of 500.
 * Returns { sent, failed } counts.
 */
const sendFcmBatch = async (messages) => {
  const admin = initFirebase();
  if (!admin) {
    console.warn('[AlertService] Firebase not initialised — skipping FCM sends');
    return { sent: 0, failed: messages.length };
  }

  const messaging = admin.messaging();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += 500) {
    const batch = messages.slice(i, i + 500);
    try {
      const response = await messaging.sendEach(batch);
      sent += response.successCount;
      failed += response.failureCount;

      // Log failed tokens for housekeeping
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          console.warn(
            `[FCM] Failed for token [${batch[idx].token?.slice(0, 20)}…]: ${r.error?.code}`
          );
        }
      });
    } catch (err) {
      console.error('[FCM] Batch send error:', err.message);
      failed += batch.length;
    }
  }

  return { sent, failed };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export: dispatchAlerts
// ─────────────────────────────────────────────────────────────────────────────
const dispatchAlerts = async (event) => {
  const result = { usersTargeted: 0, alertsSent: 0, duplicatesSkipped: 0, failed: 0 };

  const zoneFeature = buildZoneFeature(event);
  if (!zoneFeature) throw new Error('Could not build zone feature for event');

  const users = await fetchEligibleUsers();

  const targeted = users.filter(
    (u) =>
      userIsInZone(u, zoneFeature) &&
      severityMeetsThreshold(event.severity, u.alertThreshold)
  );

  result.usersTargeted = targeted.length;
  if (targeted.length === 0) return result;

  // ── Deduplication: skip users already alerted for this event ────────────────
  const existingKeys = new Set(
    (
      await AlertLog.find({ eventId: event._id }).select('deduplicationKey').lean()
    ).map((l) => l.deduplicationKey)
  );

  const fresh = targeted.filter(
    (u) => !existingKeys.has(`${event._id}:${u._id}`)
  );

  result.duplicatesSkipped = targeted.length - fresh.length;
  if (fresh.length === 0) return result;

  // ── Build FCM payloads ────────────────────────────────────────────────────
  const messages = fresh.map((u) => buildFcmPayload(u, event));

  // ── Send FCM ──────────────────────────────────────────────────────────────
  const { sent, failed } = await sendFcmBatch(messages);
  result.alertsSent = sent;
  result.failed = failed;

  // ── Persist AlertLog documents ────────────────────────────────────────────
  const logDocs = fresh.map((u, idx) => ({
    eventId: event._id,
    userId: u._id,
    deduplicationKey: `${event._id}:${u._id}`,
    deliveryStatus: 'sent',
    severityAtSend: event.severity,
    userLocationAtSend: u.lastKnownLocation.coordinates,
    payloadSnapshot: messages[idx]?.data,
  }));

  // insertMany with ordered:false skips duplicate key errors gracefully
  await AlertLog.insertMany(logDocs, { ordered: false }).catch((err) => {
    if (err.code !== 11000) throw err; // re-throw non-duplicate errors
  });

  // Update event stats
  await DisasterEvent.findByIdAndUpdate(event._id, {
    $inc: { alertsSentCount: sent },
    $set: { lastAlertSentAt: new Date() },
  });

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// sendRetractionNotification
// ─────────────────────────────────────────────────────────────────────────────
const sendRetractionNotification = async (event) => {
  const admin = initFirebase();
  if (!admin) return;

  // Find all users who were previously alerted for this event
  const logs = await AlertLog.find({ eventId: event._id, isRetraction: false })
    .populate('userId', 'fcmToken preferredLanguage name')
    .lean();

  const messages = logs
    .filter((l) => l.userId?.fcmToken)
    .map((l) => ({
      token: l.userId.fcmToken,
      notification: {
        title: '⚠️ Alert Retracted',
        body: event.correctionMessage || 'A previous disaster alert has been cancelled.',
      },
      data: {
        eventId: String(event._id),
        isRetraction: 'true',
        correctionMessage: event.correctionMessage || '',
      },
      android: {
        priority: 'high',
      },
    }));

  if (messages.length === 0) return;

  const { sent, failed } = await sendFcmBatch(messages);
  console.log(`[AlertService] Retraction push: ${sent} sent, ${failed} failed`);

  // Mark logs as retraction-sent
  await AlertLog.updateMany(
    { eventId: event._id, isRetraction: false },
    { $set: { isRetraction: true, retractionSentAt: new Date() } }
  );
};

module.exports = { dispatchAlerts, sendRetractionNotification };
