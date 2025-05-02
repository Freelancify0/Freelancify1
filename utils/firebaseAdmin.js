// utils/firebaseAdmin.js
import admin from "firebase-admin";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the directory name using ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Initialize Firebase Admin SDK if not already initialized
  if (!admin.apps.length) {
    // If you're using environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      // If you're using a local file (development)
      const serviceAccountPath = join(__dirname, '../config/firebase-service-account.json');
      
      // Check if file exists before using it
      if (fs.existsSync(serviceAccountPath)) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath)
        });
      } else {
        console.warn("Firebase service account file not found. Some Firebase admin functionality will be unavailable.");
        // Initialize with a dummy config just to prevent errors
        admin.initializeApp({
          projectId: 'dummy-project',
          credential: admin.credential.applicationDefault()
        });
      }
    }
  }
} catch (error) {
  console.error("Firebase admin initialization error:", error);
}

export default admin;