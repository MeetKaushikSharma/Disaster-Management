/**
 * seed-admin.js — Run once to create the first super-admin.
 * Usage:  node seed-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('./src/models/AdminUser');

async function seed() {
  const email    = process.env.SEED_ADMIN_EMAIL    || 'admin@disaster.gov.in';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Disaster@12345';
  const name     = process.env.SEED_ADMIN_NAME     || 'System Admin';

  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const existing = await AdminUser.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    await mongoose.disconnect();
    return;
  }

  const admin = await AdminUser.create({
    name,
    email,
    passwordHash: password,   // model's pre-save hook will bcrypt this
    role: 'super_admin',
    isVerified: true,
    isActive: true,
  });

  console.log('✓ Admin created:');
  console.log(`  Email   : ${admin.email}`);
  console.log(`  Password: ${password}   ← use this to log in`);
  console.log(`  Role    : ${admin.role}`);
  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => { console.error(err); process.exit(1); });
