import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function migrateThemesTier() {
  console.log("Starting migration: Adding tier: 'core' to existing themes...");

  try {
    const themesSnapshot = await db.collection("themes").get();
    
    const batch = db.batch();
    let count = 0;

    themesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.tier) {
        batch.update(doc.ref, { tier: "core" });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully updated ${count} themes with tier: 'core'.`);
    } else {
      console.log("No themes needed updating.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateThemesTier();
