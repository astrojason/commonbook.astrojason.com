// One-off script: grants the fixed SUPERADMIN role to the app owner's account.
// Run once, locally, with a Firebase Admin SDK service account for the recall-4899d project:
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<service account JSON>' npx tsx scripts/bootstrap-superadmin.ts
//
// After this, all further role changes (approving PENDING users, promoting/demoting ADMIN)
// happen through the in-app Admin panel (/admin), not this script.

import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const SUPERADMIN_EMAIL = 'jason@astrojason.com'

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY env var is required (service account JSON for recall-4899d)')
  }

  const app = initializeApp({ credential: cert(JSON.parse(raw)) })
  const auth = getAuth(app)
  const db = getFirestore(app)

  const user = await auth.getUserByEmail(SUPERADMIN_EMAIL)
  await auth.setCustomUserClaims(user.uid, { role: 'SUPERADMIN' })
  await db.doc(`users/${user.uid}`).set(
    {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      role: 'SUPERADMIN',
      articlesAppUid: null,
      interestKeywords: [],
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  )

  console.log(`Granted SUPERADMIN to ${SUPERADMIN_EMAIL} (uid: ${user.uid})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
