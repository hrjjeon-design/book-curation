import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

const db = getFirestore()

async function check() {
  const themeId = "meaning_of_life"
  const themeDoc = await db.collection("themes").doc(themeId).get()
  const curatorDoc = await db.collection("curator_config").doc("default_curator").get()
  
  console.log("Theme exists:", themeDoc.exists)
  if (themeDoc.exists) console.log("Theme data:", themeDoc.data())
  
  console.log("Curator exists:", curatorDoc.exists)
  if (curatorDoc.exists) console.log("Curator data:", curatorDoc.data())
}

check().catch(console.error)
