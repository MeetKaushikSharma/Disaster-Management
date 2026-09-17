/**
 * Firebase Admin SDK initialiser.
 * Call once on startup; subsequent calls return the cached app.
 *
 * Expects the FIREBASE_SERVICE_ACCOUNT_PATH env variable to point to
 * the downloaded service-account JSON file from Firebase Console.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialised = false;

const initFirebase = () => {
  if (initialised || admin.apps.length > 0) return admin;

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!saPath) {
    console.warn(
      '[Firebase] FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled'
    );
    return null;
  }

  // Resolve relative to this file's directory, not process.cwd()
  const resolvedPath = path.isAbsolute(saPath)
    ? saPath
    : path.resolve(__dirname, '..', saPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[Firebase] Service account file not found at ${resolvedPath} — push disabled`);
    return null;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialised = true;
  console.log('[Firebase] Admin SDK initialised');
  return admin;
};

module.exports = initFirebase;
