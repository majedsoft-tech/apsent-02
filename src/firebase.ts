import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel,
  Firestore
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Suppress internal Firestore network and quota exhaustion backoff logs in console
try {
  setLogLevel("silent");
} catch (_) {}

// Explicit Firebase Project Configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyBhFDgXwf3FQ61nHXPNJNz2E_3ljl5E7Fg",
  authDomain: "apsent-02.firebaseapp.com",
  projectId: "apsent-02",
  storageBucket: "apsent-02.firebasestorage.app",
  messagingSenderId: "786949363902",
  appId: "1:786949363902:web:147991bb74461c24eaa6ef",
  measurementId: "G-J8KHJXM2KC"
};

// Initialize Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Get active Firestore Database ID from localStorage or default to "(default)"
 */
export function getActiveFirestoreDatabaseId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("firestore_custom_database_id");
    // Project ID is not the database ID. In Firestore the default database is always "(default)".
    if (saved && saved.trim() && saved.trim() !== "apsent-02" && saved.trim() !== "apsents1" && saved.trim() !== "(default)") {
      return saved.trim();
    }
    if (saved === "apsents1" || saved === "apsent-02") {
      try {
        localStorage.removeItem("firestore_custom_database_id");
      } catch (_) {}
    }
  }
  return "(default)";
}

/**
 * Set active Firestore Database ID in localStorage
 */
export function setActiveFirestoreDatabaseId(id: string): void {
  if (typeof window !== "undefined") {
    const clean = id?.trim();
    if (!clean || clean === "(default)") {
      localStorage.removeItem("firestore_custom_database_id");
    } else {
      localStorage.setItem("firestore_custom_database_id", clean);
    }
  }
}

/**
 * Get a Firestore instance for a specific database ID
 */
export function getDbForDatabaseId(databaseId?: string): Firestore {
  const dbId = databaseId && databaseId !== "(default)" ? databaseId.trim() : undefined;
  try {
    if (dbId) {
      return getFirestore(app, dbId);
    }
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      ignoreUndefinedProperties: true,
    });
  } catch (_) {
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}

const activeDbId = getActiveFirestoreDatabaseId();
export let db: Firestore = getDbForDatabaseId(activeDbId);

/**
 * Switch active Firestore database reference dynamically and persist preference
 */
export function updateActiveDb(newId: string): Firestore {
  setActiveFirestoreDatabaseId(newId);
  db = getDbForDatabaseId(newId);
  return db;
}

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});


