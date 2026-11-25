import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

export const SONGBOOK_COLLECTION = 'pnw-lyrics';
export const ET_OAUTH_CENTRAL_URL = 'https://et-central.softr.app';
export const ET_OAUTH_USER_STORAGE_KEY = 'et_links_user';
export const ET_OAUTH_REDIRECT_STORAGE_KEY = 'et_auth_redirect';

export const ALLOWED_SONGBOOK_EMAILS = [
  'edric.tkf@gmail.com',
  'edricteo@et.com',
] as const;

export function isAllowedSongbookEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (ALLOWED_SONGBOOK_EMAILS as readonly string[]).includes(normalized);
}

const SONGBOOK_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_API_KEY ||
    'AIzaSyDl8vRwx-bRttBipdZpjfT5onlfzOu6w9M',
  authDomain:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_AUTH_DOMAIN ||
    'et-core-f7d05.firebaseapp.com',
  databaseURL:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_DATABASE_URL ||
    'https://et-core-f7d05-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_PROJECT_ID ||
    'et-core-f7d05',
  storageBucket:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_STORAGE_BUCKET ||
    'et-core-f7d05.firebasestorage.app',
  messagingSenderId:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_MESSAGING_SENDER_ID ||
    '960940896695',
  appId:
    import.meta.env?.VITE_SONGBOOK_FIREBASE_APP_ID ||
    '1:960940896695:web:466bc2703421ce48afb832',
};

const OAUTH_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_API_KEY ||
    'AIzaSyAmjbiA-08jNwWHCG50K0MrOHq9mjyPyQE',
  authDomain:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_AUTH_DOMAIN ||
    'et-oauth.firebaseapp.com',
  projectId:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_PROJECT_ID ||
    'et-oauth',
  storageBucket:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_STORAGE_BUCKET ||
    'et-oauth.firebasestorage.app',
  messagingSenderId:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_MESSAGING_SENDER_ID ||
    '83337122809',
  appId:
    import.meta.env?.VITE_ET_OAUTH_FIREBASE_APP_ID ||
    '1:83337122809:web:db96ec5e6622167b336328',
};

function getOrInitializeApp(name: string, config: FirebaseOptions): FirebaseApp {
  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;
  return initializeApp(config, name);
}

function getOrInitializeFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
}

let cachedSongbookDb: Firestore | null = null;
let cachedOAuthDb: Firestore | null = null;

export function getSongbookDb(): Firestore {
  if (!cachedSongbookDb) {
    const app = getOrInitializeApp('songbook', SONGBOOK_FIREBASE_CONFIG);
    cachedSongbookDb = getOrInitializeFirestore(app);
  }
  return cachedSongbookDb;
}

export function getOAuthDb(): Firestore {
  if (!cachedOAuthDb) {
    const app = getOrInitializeApp('oauth', OAUTH_FIREBASE_CONFIG);
    cachedOAuthDb = getOrInitializeFirestore(app);
  }
  return cachedOAuthDb;
}
