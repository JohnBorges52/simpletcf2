/* ============================================================================
   Firestore Storage Helper Module
   Handles saving and retrieving user quiz answers from Firestore Database
   with fallback to localStorage for unauthenticated users
============================================================================ */

// Storage keys for localStorage fallback
const STORAGE_KEYS = Object.freeze({
  TRACKING: "answer_tracking",
  EVENTS: "answer_events_v1",
  TCF_LISTENING: "TCF Listening",
  MIGRATION_FLAG: "firestore_migration_done",
  TRACKING_OWNER: "tracking_data_owner_uid", // Stores userId who owns the localStorage data
});

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Get the current authenticated user ID
 * @returns {string|null} User ID or null if not authenticated
 */
export function getCurrentUserId() {
  try {
    const user = window.AuthService.getCurrentUser();
    return user?.uid || null;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated and has verified email
 * @returns {boolean}
 */
export function isUserAuthenticated() {
  try {
    const user = window.AuthService.getCurrentUser();
    // Only consider users with verified emails as authenticated
    return user !== null && user.emailVerified === true;
  } catch (error) {
    console.error("Error checking user authentication:", error);
    return false;
  }
}

// ============================================================================
// Answer Tracking Functions
// ============================================================================

/**
 * Get answer tracking data (localStorage or Firestore)
 * @returns {Promise<Object>} Tracking data object
 */
export async function getTracking() {
  const userId = getCurrentUserId();
  
  // Fallback to localStorage if not authenticated
  if (!userId) {
    return getTrackingFromLocalStorage();
  }
  
  // ✅ Clear localStorage if it belongs to a different user
  const dataOwner = localStorage.getItem(STORAGE_KEYS.TRACKING_OWNER);
  if (dataOwner && dataOwner !== userId) {
    localStorage.removeItem(STORAGE_KEYS.TRACKING);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.TCF_LISTENING);
    localStorage.removeItem(STORAGE_KEYS.TRACKING_OWNER);
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return getTrackingFromLocalStorage();
    }
    
    const { doc, getDoc } = window.firestoreExports;
    
    const trackingRef = doc(db, "users", userId, "data", "tracking");
    const snapshot = await getDoc(trackingRef);
    
    if (snapshot.exists()) {
      return snapshot.data().answers || {};
    }
    
    // No Firestore data yet, check if we need to migrate
    return await migrateTrackingIfNeeded(userId);
  } catch (error) {
    console.error("Error getting tracking from Firestore:", error);
    return getTrackingFromLocalStorage();
  }
}

/**
 * Save answer tracking data (localStorage or Firestore)
 * @param {Object} tracking - Tracking data object
 */
export async function setTracking(tracking) {
  const userId = getCurrentUserId();
  
  // Always save to localStorage as a backup
  setTrackingToLocalStorage(tracking);
  
  // Also save to Firestore if authenticated
  if (!userId) {
    return;
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return;
    }
    
    const { doc, setDoc } = window.firestoreExports;
    
    const trackingRef = doc(db, "users", userId, "data", "tracking");
    await setDoc(trackingRef, {
      answers: tracking || {},
      lastUpdated: new Date(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving tracking to Firestore:", error);
  }
}

// ============================================================================
// Answer Events Functions
// ============================================================================

/**
 * Get answer events (localStorage or Firestore)
 * @returns {Promise<Array>} Events array
 */
export async function getEvents() {
  const userId = getCurrentUserId();
  
  // Fallback to localStorage if not authenticated
  if (!userId) {
    return getEventsFromLocalStorage();
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return getEventsFromLocalStorage();
    }
    
    const { doc, getDoc } = window.firestoreExports;
    
    const eventsRef = doc(db, "users", userId, "data", "events");
    const snapshot = await getDoc(eventsRef);
    
    if (snapshot.exists()) {
      return snapshot.data().items || [];
    }
    
    // No Firestore data yet, check if we need to migrate
    return await migrateEventsIfNeeded(userId);
  } catch (error) {
    console.error("Error getting events from Firestore:", error);
    return getEventsFromLocalStorage();
  }
}

/**
 * Save answer events (localStorage or Firestore)
 * @param {Array} events - Events array
 */
export async function setEvents(events) {
  const userId = getCurrentUserId();
  
  // Always save to localStorage as a backup
  setEventsToLocalStorage(events);
  
  // Also save to Firestore if authenticated
  if (!userId) {
    return;
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return;
    }
    
    const { doc, setDoc } = window.firestoreExports;
    
    const eventsRef = doc(db, "users", userId, "data", "events");
    await setDoc(eventsRef, {
      items: events || [],
      lastUpdated: new Date(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving events to Firestore:", error);
  }
}

// ============================================================================
// TCF Listening Data Functions
// ============================================================================

/**
 * Get TCF Listening data (localStorage or Firestore)
 * @returns {Promise<Object>} Listening data object
 */
export async function getTCFListening() {
  const userId = getCurrentUserId();
  
  // Fallback to localStorage if not authenticated
  if (!userId) {
    return getTCFListeningFromLocalStorage();
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return getTCFListeningFromLocalStorage();
    }
    
    const { doc, getDoc } = window.firestoreExports;
    
    const listeningRef = doc(db, "users", userId, "data", "listening");
    const snapshot = await getDoc(listeningRef);
    
    if (snapshot.exists()) {
      return snapshot.data();
    }
    
    // No Firestore data yet, check if we need to migrate
    return await migrateTCFListeningIfNeeded(userId);
  } catch (error) {
    console.error("Error getting TCF Listening from Firestore:", error);
    return getTCFListeningFromLocalStorage();
  }
}

/**
 * Save TCF Listening data (localStorage or Firestore)
 * @param {Object} data - Listening data object
 */
export async function setTCFListening(data) {
  const userId = getCurrentUserId();
  
  // Always save to localStorage as a backup
  setTCFListeningToLocalStorage(data);
  
  // Also save to Firestore if authenticated
  if (!userId) {
    return;
  }
  
  try {
    // Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      return;
    }
    
    const { doc, setDoc } = window.firestoreExports;
    
    const listeningRef = doc(db, "users", userId, "data", "listening");
    await setDoc(listeningRef, {
      ...data,
      lastUpdated: new Date(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving TCF Listening to Firestore:", error);
  }
}

// ============================================================================
// LocalStorage Helper Functions
// ============================================================================

function getTrackingFromLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKING) || "{}");
  } catch {
    return {};
  }
}

function setTrackingToLocalStorage(tracking) {
  try {
    localStorage.setItem(STORAGE_KEYS.TRACKING, JSON.stringify(tracking || {}));
    // Store the userId who owns this data
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.setItem(STORAGE_KEYS.TRACKING_OWNER, userId);
    }
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function getEventsFromLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || "[]");
  } catch {
    return [];
  }
}

function setEventsToLocalStorage(events) {
  try {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events || []));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function getTCFListeningFromLocalStorage() {
  const defaultData = { answers: {}, tests: { count: 0, items: [] } };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TCF_LISTENING);
    if (!raw) return defaultData;
    const obj = JSON.parse(raw);
    if (!obj.answers) obj.answers = {};
    if (!obj.tests) obj.tests = { count: 0, items: [] };
    if (typeof obj.tests.count !== "number") {
      obj.tests.count = Number(obj.tests.count || 0);
    }
    if (!Array.isArray(obj.tests.items)) obj.tests.items = [];
    return obj;
  } catch {
    return defaultData;
  }
}

function setTCFListeningToLocalStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.TCF_LISTENING, JSON.stringify(data || {}));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Check if migration has been done for this user
 */
function hasMigrated(userId) {
  try {
    const migrated = localStorage.getItem(`${STORAGE_KEYS.MIGRATION_FLAG}_${userId}`);
    return migrated === "true";
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete for this user
 */
function markMigrationComplete(userId) {
  try {
    localStorage.setItem(`${STORAGE_KEYS.MIGRATION_FLAG}_${userId}`, "true");
  } catch (error) {
    console.error("Error marking migration complete:", error);
  }
}

/**
 * Migrate tracking data from localStorage to Firestore if needed
 */
async function migrateTrackingIfNeeded(userId) {
  if (hasMigrated(userId)) {
    return {};
  }
  
  const localData = getTrackingFromLocalStorage();
  
  // ✅ Check if localStorage data belongs to current user
  const dataOwner = localStorage.getItem(STORAGE_KEYS.TRACKING_OWNER);
  
  // Only migrate if:
  // 1. No owner stored (legacy data from before this fix) AND user has no Firestore data yet
  // 2. Owner matches current user
  const shouldMigrate = !dataOwner || dataOwner === userId;
  
  if (!shouldMigrate) {
    return {};
  }
  
  // If there's local data, migrate it
  if (Object.keys(localData).length > 0) {
    await setTracking(localData);
    markMigrationComplete(userId);
  }
  
  return localData;
}

/**
 * Migrate events from localStorage to Firestore if needed
 */
async function migrateEventsIfNeeded(userId) {
  if (hasMigrated(userId)) {
    return [];
  }
  
  const localData = getEventsFromLocalStorage();
  
  // If there's local data, migrate it
  if (localData.length > 0) {
    await setEvents(localData);
  }
  
  return localData;
}

/**
 * Migrate TCF Listening data from localStorage to Firestore if needed
 */
async function migrateTCFListeningIfNeeded(userId) {
  if (hasMigrated(userId)) {
    return { answers: {}, tests: { count: 0, items: [] } };
  }
  
  const localData = getTCFListeningFromLocalStorage();
  
  // If there's local data, migrate it
  if (Object.keys(localData.answers || {}).length > 0 || (localData.tests?.items?.length || 0) > 0) {
    await setTCFListening(localData);
  }
  
  markMigrationComplete(userId);
  return localData;
}

/**
 * Manually trigger migration of all localStorage data to Firestore
 * @returns {Promise<boolean>} Success status
 */
export async function migrateAllDataToFirestore() {
  const userId = getCurrentUserId();
  
  if (!userId) {
    return false;
  }
  
  if (hasMigrated(userId)) {
    return true;
  }
  
  try {
    
    // Migrate all data types
    await migrateTrackingIfNeeded(userId);
    await migrateEventsIfNeeded(userId);
    await migrateTCFListeningIfNeeded(userId);
    
    return true;
  } catch (error) {
    console.error("Error during migration:", error);
    return false;
  }
}
