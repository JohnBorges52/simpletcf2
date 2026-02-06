// ===============================
// Firestore Database Service
// ===============================
// This module provides helper functions for interacting with Firestore.
// It handles user data and question response logging.

/**
 * Database Collections Structure:
 * 
 * /users/{userId}
 *   - email: string
 *   - displayName: string
 *   - createdAt: timestamp
 *   - lastLoginAt: timestamp
 *   - plan: string (optional)
 *   - renewalDate: string (optional)
 * 
 * /questionResponses/{responseId}
 *   - userId: string
 *   - questionId: string
 *   - questionType: string ("reading" | "listening")
 *   - testId: string (optional)
 *   - questionNumber: string
 *   - weight: number
 *   - selectedOption: string (e.g., "A", "B", "C", "D")
 *   - isCorrect: boolean
 *   - answeredAt: timestamp
 *   - timeSpent: number (optional, in seconds)
 */

// ===============================
// Wait for Firestore to be ready
// ===============================
async function getFirestore() {
  const db = await window.__firestoreReady;
  if (!db) throw new Error("Firestore is not initialized");
  return db;
}

// ===============================
// User Management
// ===============================

/**
 * Create or update a user document in Firestore
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} userData - User data object
 * @returns {Promise<void>}
 */
async function saveUser(userId, userData) {
  const db = await getFirestore();
  const { doc, setDoc, serverTimestamp } = window.firestoreExports;
  
  const userRef = doc(db, "users", userId);
  
  const userDoc = {
    email: userData.email,
    displayName: userData.displayName || "User",
    createdAt: userData.createdAt || serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    plan: userData.plan || "free",
    renewalDate: userData.renewalDate || null,
  };
  
  try {
    await setDoc(userRef, userDoc, { merge: true });
    console.log("✅ User saved to Firestore:", userId);
  } catch (error) {
    console.error("❌ Error saving user to Firestore:", error);
    throw error;
  }
}

/**
 * Get user data from Firestore
 * @param {string} userId - Firebase Auth user ID
 * @returns {Promise<Object|null>} User data or null if not found
 */
async function getUser(userId) {
  const db = await getFirestore();
  const { doc, getDoc } = window.firestoreExports;
  
  const userRef = doc(db, "users", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    } else {
      console.log("No user document found for:", userId);
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting user from Firestore:", error);
    throw error;
  }
}

// ===============================
// Question Response Logging
// ===============================

/**
 * Log a question response to Firestore
 * @param {Object} responseData - Response data object
 * @returns {Promise<string>} Document ID of the created response
 */
async function logQuestionResponse(responseData) {
  const db = await getFirestore();
  const { collection, addDoc, serverTimestamp } = window.firestoreExports;
  
  // Get current user
  const auth = await window.__authReady;
  if (!auth || !auth.currentUser) {
    console.warn("⚠️ User not authenticated, cannot log response");
    return null;
  }
  
  const userId = auth.currentUser.uid;
  
  const responseDoc = {
    userId: userId,
    questionId: responseData.questionId,
    questionType: responseData.questionType, // "reading" | "listening"
    testId: responseData.testId || null,
    questionNumber: responseData.questionNumber,
    weight: responseData.weight || 0,
    selectedOption: responseData.selectedOption,
    isCorrect: responseData.isCorrect,
    answeredAt: serverTimestamp(),
    timeSpent: responseData.timeSpent || null,
  };
  
  try {
    const responsesRef = collection(db, "questionResponses");
    const docRef = await addDoc(responsesRef, responseDoc);
    console.log("✅ Question response logged:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error logging question response:", error);
    throw error;
  }
}

/**
 * Get user's question response statistics
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} options - Query options (questionType, limit, etc.)
 * @returns {Promise<Object>} Statistics object
 */
async function getUserStatistics(userId, options = {}) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, limit: limitFn, getDocs } = window.firestoreExports;
  
  const responsesRef = collection(db, "questionResponses");
  let q = query(responsesRef, where("userId", "==", userId));
  
  // Filter by question type if specified
  if (options.questionType) {
    q = query(q, where("questionType", "==", options.questionType));
  }
  
  // Order by most recent
  q = query(q, orderBy("answeredAt", "desc"));
  
  // Limit results if specified
  if (options.limit) {
    q = query(q, limitFn(options.limit));
  }
  
  try {
    const querySnapshot = await getDocs(q);
    
    const responses = [];
    querySnapshot.forEach((doc) => {
      responses.push({ id: doc.id, ...doc.data() });
    });
    
    // Calculate statistics
    const stats = {
      totalResponses: responses.length,
      correctResponses: responses.filter(r => r.isCorrect).length,
      incorrectResponses: responses.filter(r => !r.isCorrect).length,
      accuracy: 0,
      byQuestionType: {},
      byWeight: {},
      responses: responses,
    };
    
    if (stats.totalResponses > 0) {
      stats.accuracy = (stats.correctResponses / stats.totalResponses * 100).toFixed(2);
    }
    
    // Group by question type
    responses.forEach(r => {
      const type = r.questionType || "unknown";
      if (!stats.byQuestionType[type]) {
        stats.byQuestionType[type] = { total: 0, correct: 0 };
      }
      stats.byQuestionType[type].total++;
      if (r.isCorrect) stats.byQuestionType[type].correct++;
    });
    
    // Group by weight
    responses.forEach(r => {
      const weight = r.weight || 0;
      if (!stats.byWeight[weight]) {
        stats.byWeight[weight] = { total: 0, correct: 0 };
      }
      stats.byWeight[weight].total++;
      if (r.isCorrect) stats.byWeight[weight].correct++;
    });
    
    return stats;
  } catch (error) {
    console.error("❌ Error getting user statistics:", error);
    throw error;
  }
}

/**
 * Get recent question responses for a user
 * @param {string} userId - Firebase Auth user ID
 * @param {number} limitCount - Number of responses to retrieve
 * @returns {Promise<Array>} Array of response objects
 */
async function getRecentResponses(userId, limitCount = 10) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, limit: limitFn, getDocs } = window.firestoreExports;
  
  const responsesRef = collection(db, "questionResponses");
  const q = query(
    responsesRef,
    where("userId", "==", userId),
    orderBy("answeredAt", "desc"),
    limitFn(limitCount)
  );
  
  try {
    const querySnapshot = await getDocs(q);
    
    const responses = [];
    querySnapshot.forEach((doc) => {
      responses.push({ id: doc.id, ...doc.data() });
    });
    
    return responses;
  } catch (error) {
    console.error("❌ Error getting recent responses:", error);
    throw error;
  }
}

// ===============================
// Export functions
// ===============================
window.dbService = {
  saveUser,
  getUser,
  logQuestionResponse,
  getUserStatistics,
  getRecentResponses,
};

console.log("✅ Database service loaded");
