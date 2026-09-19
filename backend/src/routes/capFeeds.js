/**
 * CAP Feeds Routes — /api/feeds
 *
 * Exposes active disaster events conforming to the OASIS Common Alerting Protocol (CAP v1.2)
 * adopted by the National Disaster Management Authority (NDMA) and SACHET national alert portal.
 *
 * Provides:
 *   - GET /api/feeds/cap.xml  (Standard OASIS CAP 1.2 XML feed)
 *   - GET /api/feeds/cap.json (JSON feed for web apps and browser alert subscribers)
 */

const express = require('express');
const DisasterEvent = require('../models/DisasterEvent');

const router = express.Router();

/**
 * Maps system disaster types to official CAP event codes / categories
 */
const getCapCategory = (type) => {
  switch (type) {
    case 'Flood':
    case 'FlashFlood':
    case 'HeavyRainfall':
    case 'UrbanWaterlogging':
    case 'Cyclone':
    case 'Heatwave':
    case 'Coldwave':
    case 'Drought':
      return 'Met';
    case 'Earthquake':
    case 'Landslide':
    case 'Tsunami':
      return 'Geo';
    case 'Fire':
    case 'ChemicalSpill':
      return 'Safety';
    default:
      return 'Other';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feeds/cap.json — Active alerts in JSON format
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cap.json', async (req, res, next) => {
  try {
    const events = await DisasterEvent.find({
      status: { $in: ['active', 'published'] },
    })
      .populate('safetyGuideId', 'title steps')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const capFeed = {
      identifier: `IN-DISASTER-FEED-${Date.now()}`,
      sender: 'disaster-management@gov.in',
      sent: new Date().toISOString(),
      status: 'Actual',
      msgType: 'Alert',
      scope: 'Public',
      totalAlerts: events.length,
      alerts: events.map((ev) => ({
        identifier: ev.capIdentifier || `IN-DM-${ev._id}`,
        sender: 'SDMA Operations Command',
        sent: ev.createdAt.toISOString(),
        status: 'Actual',
        msgType: 'Alert',
        scope: 'Public',
        info: [
          {
            language: 'en-IN',
            category: getCapCategory(ev.type),
            event: ev.type,
            urgency: ev.urgency || 'Expected',
            severity: ev.severity,
            certainty: ev.certainty || 'Likely',
            eventCode: [{ valueName: 'SAME', value: ev.type.toUpperCase() }],
            expires: ev.expiresAt ? ev.expiresAt.toISOString() : undefined,
            headline: ev.title,
            description: ev.description,
            instruction: ev.safetyGuideId?.title
              ? `Follow Safety Directive: ${ev.safetyGuideId.title}`
              : 'Follow local authority directives and move to safe higher ground if ordered.',
            area: [
              {
                areaDesc: `${ev.district || 'District'}, ${ev.state || 'State'}`,
                ...(ev.zoneType === 'radius' && ev.centre
                  ? { circle: `${ev.centre.coordinates[1]},${ev.centre.coordinates[0]} ${ev.radiusKm || 10}` }
                  : {}),
                ...(ev.zoneType === 'polygon' && ev.polygon
                  ? { polygon: ev.polygon.coordinates[0].map((pt) => `${pt[1]},${pt[0]}`).join(' ') }
                  : {}),
              },
            ],
          },
          ...(ev.translations?.hi?.title
            ? [
                {
                  language: 'hi-IN',
                  category: getCapCategory(ev.type),
                  event: ev.type,
                  urgency: ev.urgency || 'Expected',
                  severity: ev.severity,
                  certainty: ev.certainty || 'Likely',
                  headline: ev.translations.hi.title,
                  description: ev.translations.hi.description,
                  area: [{ areaDesc: `${ev.district || 'जिला'}, ${ev.state || 'राज्य'}` }],
                },
              ]
            : []),
        ],
      })),
    };

    res.json(capFeed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feeds/cap.xml — OASIS CAP 1.2 XML Feed
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cap.xml', async (req, res, next) => {
  try {
    const events = await DisasterEvent.find({
      status: { $in: ['active', 'published'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const timestamp = new Date().toISOString();

    const alertsXml = events
      .map((ev) => {
        const id = ev.capIdentifier || `IN-DM-${ev._id}`;
        const sent = ev.createdAt.toISOString();
        const expires = ev.expiresAt ? `<expires>${ev.expiresAt.toISOString()}</expires>` : '';

        let areaXml = `<areaDesc>${ev.district || 'All'}, ${ev.state || 'India'}</areaDesc>`;
        if (ev.zoneType === 'radius' && ev.centre) {
          areaXml += `<circle>${ev.centre.coordinates[1]},${ev.centre.coordinates[0]} ${ev.radiusKm || 10}</circle>`;
        } else if (ev.zoneType === 'polygon' && ev.polygon) {
          const polyStr = ev.polygon.coordinates[0].map((pt) => `${pt[1]},${pt[0]}`).join(' ');
          areaXml += `<polygon>${polyStr}</polygon>`;
        }

        return `
  <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>${id}</identifier>
    <sender>ndma-sachet@disaster.gov.in</sender>
    <sent>${sent}</sent>
    <status>Actual</status>
    <msgType>Alert</msgType>
    <scope>Public</scope>
    <info>
      <language>en-IN</language>
      <category>${getCapCategory(ev.type)}</category>
      <event>${ev.type}</event>
      <urgency>${ev.urgency || 'Expected'}</urgency>
      <severity>${ev.severity}</severity>
      <certainty>${ev.certainty || 'Likely'}</certainty>
      <headline><![CDATA[${ev.title}]]></headline>
      <description><![CDATA[${ev.description || ''}]]></description>
      ${expires}
      <area>
        ${areaXml}
      </area>
    </info>
  </alert>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>India National Disaster Management Authority — Integrated CAP Alert Feed</title>
  <updated>${timestamp}</updated>
  <author><name>NDMA / SDMA Alert Gateway</name></author>
  <id>urn:uuid:in-ndma-cap-feed-${Date.now()}</id>
  ${alertsXml}
</feed>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
