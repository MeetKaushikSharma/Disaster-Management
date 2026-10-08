/**
 * seed-guides.js — Seeds disaster safety guides for India (English & Hindi)
 * Usage: node seed-guides.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SafetyGuide = require('./src/models/SafetyGuide');
const AdminUser = require('./src/models/AdminUser');

const GUIDES_DATA = [
  // ── FLOOD (English) ────────────────────────────────────────────────────────
  {
    disasterType: 'Flood',
    language: 'en',
    title: 'Flood Survival & Evacuation Protocol',
    summary: 'Essential life-saving instructions for rising waters, flash floods, and dam overflows in India.',
    steps: [
      { order: 1, instruction: 'Disconnect all electrical main switches and turn off gas cylinders immediately.', iconSlug: 'zap-off' },
      { order: 2, instruction: 'Move to higher ground or the highest floor with emergency supplies (dry food, drinking water, medications, torch).', iconSlug: 'arrow-up' },
      { order: 3, instruction: 'DO NOT walk, swim, or drive through moving water. Even 6 inches of rushing water can knock you down.', iconSlug: 'alert-triangle' },
      { order: 4, instruction: 'Boil drinking water or use water purification tablets before consumption to avoid waterborne cholera/diarrhea.', iconSlug: 'droplets' },
      { order: 5, instruction: 'Dial 112 (National Helpline) or 1070 (State Disaster Helpline) if trapped and signal for help with a brightly colored cloth.', iconSlug: 'phone-call' }
    ]
  },
  // ── FLOOD (Hindi) ──────────────────────────────────────────────────────────
  {
    disasterType: 'Flood',
    language: 'hi',
    title: 'बाढ़ से बचाव और निकासी प्रोटोकॉल',
    summary: 'बाढ़, मूसलाधार बारिश और बांध से पानी छोड़े जाने के दौरान जीवन रक्षा निर्देश।',
    steps: [
      { order: 1, instruction: 'घर का मुख्य बिजली स्विच बंद करें और गैस सिलेंडर को तुरंत सील करें।', iconSlug: 'zap-off' },
      { order: 2, instruction: 'ऊंचे स्थानों या घर की ऊपरी मंजिल पर जाएं। सूखा भोजन, पीने का पानी, टॉर्च और दवाइयां साथ रखें।', iconSlug: 'arrow-up' },
      { order: 3, instruction: 'बहते पानी में चलने, तैरने या गाड़ी चलाने की कोशिश बिल्कुल न करें। 6 इंच बहता पानी भी बहा सकता है।', iconSlug: 'alert-triangle' },
      { order: 4, instruction: 'पीने का पानी उबालकर पिएं या क्लोरीन की गोलियों का उपयोग करें ताकि बीमारियां न फैलें।', iconSlug: 'droplets' },
      { order: 5, instruction: 'फंसे होने पर तुरंत 112 या 1070 पर संपर्क करें और छत से चमकदार कपड़े या टॉर्च से संकेत दें।', iconSlug: 'phone-call' }
    ]
  },

  // ── CYCLONE (English) ──────────────────────────────────────────────────────
  {
    disasterType: 'Cyclone',
    language: 'en',
    title: 'Cyclone & Storm Surge Survival Protocol',
    summary: 'Guidelines for coastal communities facing high-velocity cyclonic gales and storm surges.',
    steps: [
      { order: 1, instruction: 'Board up or tape glass windows with X-patterns. Move loose objects from balconies/lawns indoors.', iconSlug: 'shield' },
      { order: 2, instruction: 'Evacuate immediately to designated pucca cyclone shelters if advised by IMD or district authorities.', iconSlug: 'home' },
      { order: 3, instruction: 'Keep mobile phones, power banks, and battery transistors fully charged; monitor All India Radio bulletins.', iconSlug: 'radio' },
      { order: 4, instruction: 'Stay indoors even if the wind suddenly goes calm — this may be the cyclone eye, followed by violent reverse winds.', iconSlug: 'alert-circle' },
      { order: 5, instruction: 'Stay away from fallen electricity poles, dangling wires, and weak trees after the storm passes.', iconSlug: 'zap' }
    ]
  },
  // ── CYCLONE (Hindi) ────────────────────────────────────────────────────────
  {
    disasterType: 'Cyclone',
    language: 'hi',
    title: 'चक्रवात (तूफान) से सुरक्षा निर्देश',
    summary: 'तटीय क्षेत्रों में भयंकर चक्रवाती हवाओं और भारी बारिश से सुरक्षित रहने के नियम।',
    steps: [
      { order: 1, instruction: 'खिड़कियों के शीशों को टेप से सुरक्षित करें। बाहर रखे ढीले सामान को अंदर रखें।', iconSlug: 'shield' },
      { order: 2, instruction: 'यदि प्रशासन निर्देश दे, तो बिना देरी किए पक्के चक्रवात राहत शिविर में चले जाएं।', iconSlug: 'home' },
      { order: 3, instruction: 'मोबाइल और पावर बैंक चार्ज रखें; मौसम विभाग और ऑल इंडिया रेडियो की चेतावनियों को सुनें।', iconSlug: 'radio' },
      { order: 4, instruction: 'हवा अचानक रुक जाने पर भी बाहर न निकलें — यह चक्रवात की आंख हो सकती है, जिसके बाद तेज विपरीत हवाएं चलती हैं।', iconSlug: 'alert-circle' },
      { order: 5, instruction: 'तूफान के बाद टूटे हुए बिजली के खंभों, तारों और कमजोर पेड़ों से दूर रहें।', iconSlug: 'zap' }
    ]
  },

  // ── EARTHQUAKE (English) ───────────────────────────────────────────────────
  {
    disasterType: 'Earthquake',
    language: 'en',
    title: 'Earthquake Drop, Cover & Hold Protocol',
    summary: 'Immediate reflexive actions during seismic ground tremors and building shakes in India.',
    steps: [
      { order: 1, instruction: 'DROP to your hands and knees. COVER your head and neck under a sturdy table or desk. HOLD ON until shaking stops.', iconSlug: 'shield' },
      { order: 2, instruction: 'Stay AWAY from glass windows, unanchored heavy furniture, brick walls, and lighting fixtures.', iconSlug: 'alert-triangle' },
      { order: 3, instruction: 'DO NOT use elevators/lifts. Always take stairs if safe after shaking subsides.', iconSlug: 'arrow-down' },
      { order: 4, instruction: 'If outdoors, move to an open area away from tall buildings, power lines, bridges, and flyovers.', iconSlug: 'compass' },
      { order: 5, instruction: 'Be prepared for aftershocks. Check for gas leaks and fire hazards before lighting any flame.', iconSlug: 'flame' }
    ]
  },
  // ── EARTHQUAKE (Hindi) ─────────────────────────────────────────────────────
  {
    disasterType: 'Earthquake',
    language: 'hi',
    title: 'भूकंप आपातकालीन सुरक्षा निर्देश (झुकें, ढकें, पकड़ें)',
    summary: 'भूकंप के झटके महसूस होने पर तत्काल जीवन रक्षक उपाय।',
    steps: [
      { order: 1, instruction: 'झुकें (Drop), किसी मजबूत मेज के नीचे सिर और गर्दन को ढकें (Cover) और मेज को मजबूती से पकड़ें (Hold)।', iconSlug: 'shield' },
      { order: 2, instruction: 'खिड़कियों, कांच, भारी अलमारियों, पंखों और कमजोर दीवारों से दूर रहें।', iconSlug: 'alert-triangle' },
      { order: 3, instruction: 'लिफ्ट का उपयोग बिल्कुल न करें। झटके रुकने के बाद सीढ़ियों से शांतिपूर्वक नीचे उतरें।', iconSlug: 'arrow-down' },
      { order: 4, instruction: 'यदि बाहर हैं, तो ऊंची इमारतों, बिजली के तारों, फ्लाईओवर और होर्डिंग्स से दूर खुले मैदान में जाएं।', iconSlug: 'compass' },
      { order: 5, instruction: 'आफ्टरशॉक (बाद के झटकों) के लिए तैयार रहें। माचिस या मोमबत्ती जलाने से पहले गैस रिसाव की जांच करें।', iconSlug: 'flame' }
    ]
  },

  // ── HEATWAVE (English) ─────────────────────────────────────────────────────
  {
    disasterType: 'Heatwave',
    language: 'en',
    title: 'Severe Heatwave & Sunstroke Protocol',
    summary: 'Protection against extreme temperature spikes (>42°C to 48°C) in central & northern India.',
    steps: [
      { order: 1, instruction: 'Avoid direct sunlight exposure between 11:00 AM and 4:00 PM, especially children and elderly.', iconSlug: 'sun' },
      { order: 2, instruction: 'Drink ORS (Oral Rehydration Salts), homemade lassi, lemon water, or coconut water frequently even if not thirsty.', iconSlug: 'droplets' },
      { order: 3, instruction: 'Wear lightweight, loose-fitting, light-colored cotton clothing and cover head with a wet cloth, towel, or umbrella.', iconSlug: 'user' },
      { order: 4, instruction: 'If experiencing dizziness, nausea, or high body temperature without sweating, apply wet cold cloth and call 108.', iconSlug: 'thermometer' }
    ]
  },
  // ── HEATWAVE (Hindi) ───────────────────────────────────────────────────────
  {
    disasterType: 'Heatwave',
    language: 'hi',
    title: 'भीषण लू (हीटवेव) से बचाव के उपाय',
    summary: 'गर्मियों में 40°C से ऊपर तापमान और जानलेवा लू से शरीर को सुरक्षित रखने के नियम।',
    steps: [
      { order: 1, instruction: 'दोपहर 11 बजे से शाम 4 बजे के बीच सीधी धूप में निकलने से बचें, विशेष रूप से बच्चे और बुजुर्ग।', iconSlug: 'sun' },
      { order: 2, instruction: 'प्यास न लगने पर भी नियमित पानी पिएं। ओआरएस (ORS), नींबू पानी, छाछ या आम पन्ना का सेवन करें।', iconSlug: 'droplets' },
      { order: 3, instruction: 'हल्के रंग के ढीले सूती कपड़े पहनें। बाहर जाते समय सिर को तौलिए, गमछे या टोपी से ढकें।', iconSlug: 'user' },
      { order: 4, instruction: 'चक्कर आना, उल्टी या अत्यधिक कमजोरी महसूस होने पर ठंडी जगह पर लेटें और तुरंत 108 एम्बुलेंस बुलाएं।', iconSlug: 'thermometer' }
    ]
  },

  // ── LANDSLIDE (English) ────────────────────────────────────────────────────
  {
    disasterType: 'Landslide',
    language: 'en',
    title: 'Hilly Region Landslide Warning Protocol',
    summary: 'Safety protocol for mountainous terrain (Himalayas, Western Ghats, Northeast) during heavy monsoon.',
    steps: [
      { order: 1, instruction: 'Listen for unusual sounds like trees cracking, boulders knocking, or sudden muddy water flow in local streams.', iconSlug: 'volume-2' },
      { order: 2, instruction: 'Evacuate immediately away from natural drainage hollows, hill slopes, and unstable road cuts.', iconSlug: 'arrow-right' },
      { order: 3, instruction: 'DO NOT seek shelter under retaining walls or on steep embankment edges.', iconSlug: 'alert-octagon' },
      { order: 4, instruction: 'Stay alert when driving in ghats; watch out for collapsed road shoulders and falling rocks.', iconSlug: 'truck' }
    ]
  },
  // ── LANDSLIDE (Hindi) ──────────────────────────────────────────────────────
  {
    disasterType: 'Landslide',
    language: 'hi',
    title: 'भूस्खलन (लैंडस्लाइड) चेतावनी और सुरक्षा',
    summary: 'पहाड़ी क्षेत्रों में भारी बारिश के दौरान मिट्टी और चट्टानों के खिसकने से सुरक्षा।',
    steps: [
      { order: 1, instruction: 'पेड़ों के टूटने, पत्थरों के टकराने या नालों में अचानक मटमैले पानी के तेज बहाव जैसी आवाजों पर ध्यान दें।', iconSlug: 'volume-2' },
      { order: 2, instruction: 'पहाड़ी ढलानों और कमजोर रास्तों से तुरंत दूर सुरक्षित समतल स्थान पर जाएं।', iconSlug: 'arrow-right' },
      { order: 3, instruction: 'सुरक्षा दीवारों के नीचे या तीखे मोड़ वाली चट्टानों के नीचे शरण न लें।', iconSlug: 'alert-octagon' },
      { order: 4, instruction: 'घाटों में वाहन चलाते समय विशेष सावधानी बरतें और ऊपर से गिरते पत्थरों पर नजर रखें।', iconSlug: 'truck' }
    ]
  }
];

async function seed() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  // Find an admin user to associate
  let admin = await AdminUser.findOne();
  if (!admin) {
    admin = await AdminUser.create({
      name: 'System Admin',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@disaster.gov.in',
      passwordHash: process.env.SEED_ADMIN_PASSWORD || 'Disaster@12345',
      role: 'super_admin',
      isVerified: true,
      isActive: true,
    });
    console.log('Created default admin:', admin.email);
  }

  console.log(`Seeding ${GUIDES_DATA.length} safety guides…`);
  let createdCount = 0;
  let updatedCount = 0;

  for (const guide of GUIDES_DATA) {
    const existing = await SafetyGuide.findOne({
      disasterType: guide.disasterType,
      language: guide.language,
    });

    if (existing) {
      existing.title = guide.title;
      existing.summary = guide.summary;
      existing.steps = guide.steps;
      existing.isPublished = true;
      await existing.save();
      updatedCount++;
    } else {
      await SafetyGuide.create({
        ...guide,
        createdBy: admin._id,
      });
      createdCount++;
    }
  }

  console.log(`✓ Seeding complete! Created: ${createdCount}, Updated: ${updatedCount}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
