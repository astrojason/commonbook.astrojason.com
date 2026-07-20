import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

type Role = 'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'

/** SUPERADMIN is fixed/seeded once via scripts/bootstrap-superadmin.ts — never grantable through this endpoint. */
const ASSIGNABLE_ROLES: Role[] = ['PENDING', 'USER', 'ADMIN']

interface SetRoleRequest {
  targetUid?: string
  role?: string
}

interface Req {
  method: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

interface Res {
  status(code: number): Res
  json(data: unknown): void
}

function getAdminApp(): App {
  const apps = getApps()
  if (apps.length) return apps[0]
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? '{}')
  return initializeApp({ credential: cert(serviceAccount) })
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const app = getAdminApp()
  const auth = getAuth(app)

  let callerClaims: { role?: Role }
  try {
    callerClaims = await auth.verifyIdToken(token)
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  if (callerClaims.role !== 'ADMIN' && callerClaims.role !== 'SUPERADMIN') {
    res.status(403).json({ error: 'Admin role required' })
    return
  }

  const { targetUid, role } = (req.body ?? {}) as SetRoleRequest
  if (!targetUid || !role) {
    res.status(400).json({ error: 'Missing targetUid or role' })
    return
  }

  if (!ASSIGNABLE_ROLES.includes(role as Role)) {
    res.status(400).json({ error: `role must be one of ${ASSIGNABLE_ROLES.join(', ')}` })
    return
  }

  const targetUser = await auth.getUser(targetUid)
  if (targetUser.customClaims?.role === 'SUPERADMIN') {
    res.status(403).json({ error: 'Cannot modify the SUPERADMIN account' })
    return
  }

  await auth.setCustomUserClaims(targetUid, { role })

  const db = getFirestore(app)
  await db.doc(`users/${targetUid}`).set({ role }, { merge: true })

  res.status(200).json({ ok: true })
}
