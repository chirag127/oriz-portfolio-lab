/**
 * Firebase — Firestore only. Auth is owned by Clerk (see AccountIsland).
 * Config comes from PUBLIC_FIREBASE_* env; never hardcoded. Returns null when
 * unconfigured so the app degrades to public-only (save/sync disabled) rather
 * than throwing.
 */
import { type FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { type Firestore, getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let dbInstance: Firestore | null = null

export function isFirebaseConfigured(): boolean {
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId)
}

export function db(): Firestore | null {
  if (!isFirebaseConfigured()) return null
  if (!dbInstance) {
    app = getApps()[0] ?? initializeApp(cfg)
    dbInstance = getFirestore(app)
  }
  return dbInstance
}
