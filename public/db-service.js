// ===============================
// Firestore Database Service
// ===============================
// This module provides helper functions for interacting with Firestore.
// It handles user data and question response logging.

// Debug mode - set to true to enable verbose logging
const DEBUG_MODE = false;

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
  const { doc, getDoc, setDoc, serverTimestamp } = window.firestoreExports;
  
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const existingData = userSnap.exists() ? userSnap.data() : null;

  const hasExistingSubscriptionStartDate = existingData
    ? Object.prototype.hasOwnProperty.call(existingData, "subscriptionStartDate")
    : false;
  const hasExistingSubscriptionEndDate = existingData
    ? Object.prototype.hasOwnProperty.call(existingData, "subscriptionEndDate")
    : false;
  
  const userDoc = {
    email: userData.email,
    displayName: userData.displayName || "User",
    createdAt: userData.createdAt || existingData?.createdAt || serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    tier: userData.tier || existingData?.tier || "free",
    plan: userData.plan || existingData?.plan || "free",
    renewalDate: userData.renewalDate || existingData?.renewalDate || null,
    subscriptionStartDate: userData.subscriptionStartDate
      || (hasExistingSubscriptionStartDate ? existingData.subscriptionStartDate : null),
    subscriptionEndDate: userData.subscriptionEndDate
      || (hasExistingSubscriptionEndDate ? existingData.subscriptionEndDate : null),
  };
  
  try {
    await setDoc(userRef, userDoc, { merge: true });
    // ...removed log...
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
  
  // Get current user from AuthService
  if (!window.AuthService) {
    return null;
  }
  
  const user = window.AuthService.getCurrentUser();
  if (!user) {
    return null;
  }
  
  const userId = user.uid;
  
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
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.error("\n🔥 FIRESTORE INDEX REQUIRED:\nYou need to create a composite index for 'questionResponses' collection:\n- Field: userId (Ascending)\n- Field: answeredAt (Descending)\n\nClick the link in the error above or go to Firebase Console > Firestore > Indexes\n");
    }
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

/**
 * Get daily accuracy statistics for a user
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} options - Query options (questionType, days)
 * @returns {Promise<Array>} Array of daily statistics [{date, accuracy, total, correct}]
 */
async function getDailyStats(userId, options = {}) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs, Timestamp } = window.firestoreExports;
  
  const days = options.days || 28;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  
  const responsesRef = collection(db, "questionResponses");
  
  // Build query with optional questionType filter
  const queryConstraints = [
    where("userId", "==", userId),
    where("answeredAt", ">=", Timestamp.fromDate(startDate)),
  ];
  
  if (options.questionType) {
    queryConstraints.push(where("questionType", "==", options.questionType));
  }
  
  queryConstraints.push(orderBy("answeredAt", "asc"));
  
  const q = query(responsesRef, ...queryConstraints);
  
  try {
    const querySnapshot = await getDocs(q);
    
    const dailyMap = new Map();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.answeredAt?.toDate();
      if (!date) return;
      
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, total: 0, correct: 0 });
      }
      
      const dayStats = dailyMap.get(dateKey);
      dayStats.total++;
      if (data.isCorrect) dayStats.correct++;
    });
    
    // Convert to array and calculate accuracy
    const dailyStats = Array.from(dailyMap.values()).map(stat => ({
      date: stat.date,
      total: stat.total,
      correct: stat.correct,
      accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
    }));
    
    // Fill in missing days with 0 (last 28 days ending with today)
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      
      const existing = dailyStats.find(s => s.date === dateKey);
      result.push(existing || { date: dateKey, total: 0, correct: 0, accuracy: 0 });
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error getting daily stats:", error);
    throw error;
  }
}

/**
 * Get weekly accuracy statistics for a user
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} options - Query options (questionType, weeks)
 * @returns {Promise<Array>} Array of weekly statistics [{week, accuracy, total, correct}]
 */
async function getWeeklyStats(userId, options = {}) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs, Timestamp } = window.firestoreExports;
  
  const weeks = options.weeks || 12;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  // Start from beginning of the week (weeks - 1) weeks ago, so current week is included
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - ((weeks - 1) * 7));
  
  // Set to start of week (Sunday)
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);
  startDate.setHours(0, 0, 0, 0);
  
  const responsesRef = collection(db, "questionResponses");
  
  // Build query with optional questionType filter
  const queryConstraints = [
    where("userId", "==", userId),
    where("answeredAt", ">=", Timestamp.fromDate(startDate)),
  ];
  
  if (options.questionType) {
    queryConstraints.push(where("questionType", "==", options.questionType));
  }
  
  queryConstraints.push(orderBy("answeredAt", "asc"));
  
  const q = query(responsesRef, ...queryConstraints);
  
  try {
    const querySnapshot = await getDocs(q);
    
    const weeklyMap = new Map();
    
    // Helper to get week number (0 = oldest week, weeks-1 = current week)
    const getWeekKey = (date) => {
      const diff = Math.floor((date - startDate) / (7 * 24 * 60 * 60 * 1000));
      return Math.max(0, Math.min(diff, weeks - 1));
    };
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.answeredAt?.toDate();
      if (!date) return;
      
      const weekKey = getWeekKey(date);
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { week: weekKey, total: 0, correct: 0 });
      }
      
      const weekStats = weeklyMap.get(weekKey);
      weekStats.total++;
      if (data.isCorrect) weekStats.correct++;
    });
    
    // Convert to array and calculate accuracy
    const weeklyStats = Array.from(weeklyMap.values()).map(stat => ({
      week: stat.week,
      total: stat.total,
      correct: stat.correct,
      accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
    }));
    
    // Fill in missing weeks with 0
    const result = [];
    for (let i = 0; i < weeks; i++) {
      const existing = weeklyStats.find(s => s.week === i);
      result.push(existing || { week: i, total: 0, correct: 0, accuracy: 0 });
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error getting weekly stats:", error);
    throw error;
  }
}

/**
 * Calculate study streak (consecutive days with activity)
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} options - Query options (questionType)
 * @returns {Promise<number>} Number of consecutive days
 */
async function getStudyStreak(userId, options = {}) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs } = window.firestoreExports;
  
  const responsesRef = collection(db, "questionResponses");
  let q;
  
  // Filter by question type if specified
  if (options.questionType) {
    q = query(
      responsesRef,
      where("userId", "==", userId),
      where("questionType", "==", options.questionType),
      orderBy("answeredAt", "desc")
    );
  } else {
    q = query(
      responsesRef,
      where("userId", "==", userId),
      orderBy("answeredAt", "desc")
    );
  }
  
  try {
    const querySnapshot = await getDocs(q);
    
    const activeDates = new Set();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.answeredAt?.toDate();
      if (date) {
        const dateKey = date.toISOString().split('T')[0];
        activeDates.add(dateKey);
      }
    });
    
    // Convert to sorted array
    const sortedDates = Array.from(activeDates).sort().reverse();
    
    if (sortedDates.length === 0) return 0;
    
    // Check if today or yesterday has activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayKey = today.toISOString().split('T')[0];
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    // Streak must include today or yesterday
    if (sortedDates[0] !== todayKey && sortedDates[0] !== yesterdayKey) {
      return 0;
    }
    
    // Count consecutive days
    let streak = 1;
    let currentDate = new Date(sortedDates[0]);
    
    for (let i = 1; i < sortedDates.length; i++) {
      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      const expectedKey = expectedDate.toISOString().split('T')[0];
      
      if (sortedDates[i] === expectedKey) {
        streak++;
        currentDate = expectedDate;
      } else {
        break;
      }
    }
    
    return streak;
  } catch (error) {
    console.error("❌ Error calculating study streak:", error);
    return 0;
  }
}

// ===============================
// Real Test Results
// ===============================

/**
 * Save a real test result to Firestore
 * @param {Object} testData - Test result data
 * @returns {Promise<string>} Document ID of the created test result
 */
async function saveTestResult(testData) {
  const db = await getFirestore();
  const { collection, addDoc, serverTimestamp } = window.firestoreExports;
  
  // Get current user
  const user = window.AuthService.getCurrentUser();
  if (!user) {
    return null;
  }
  
  const userId = user.uid;
  
  const testDoc = {
    userId: userId,
    testType: testData.testType, // "listening" | "reading"
    testId: testData.testId,
    correctAnswers: testData.correctAnswers || 0,
    totalQuestions: testData.totalQuestions || 0,
    clbScore: testData.clbScore || 0,
    detailedResults: testData.detailedResults || [],
    completedAt: serverTimestamp(),
    timeSpent: testData.timeSpent || null,
  };
  
  try {
    const testsRef = collection(db, "testResults");
    const docRef = await addDoc(testsRef, testDoc);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error saving test result:", error);
    throw error;
  }
}

/**
 * Get test results for a user
 * @param {string} userId - Firebase Auth user ID
 * @param {Object} options - Query options (testType, limit)
 * @returns {Promise<Object>} Test results statistics
 */
async function getTestResults(userId, options = {}) {
  const db = await getFirestore();
  const { collection, query, where, orderBy, limit: limitFn, getDocs } = window.firestoreExports;
  
  const testsRef = collection(db, "testResults");
  let q = query(testsRef, where("userId", "==", userId));
  
  // Filter by test type if specified
  if (options.testType) {
    q = query(q, where("testType", "==", options.testType));
  }
  
  // Order by most recent
  q = query(q, orderBy("completedAt", "desc"));
  
  // Limit results if specified
  if (options.limit) {
    q = query(q, limitFn(options.limit));
  }
  
  try {
    const querySnapshot = await getDocs(q);
    
    const results = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      results.push({ 
        id: doc.id, 
        ...data,
        // Convert Firestore timestamp to JS Date
        completedAt: data.completedAt?.toDate?.() || null
      });
    });
    
    // Calculate statistics
    const stats = {
      totalTests: results.length,
      bestScore: 0,
      averageScore: 0,
      lastTest: null,
      results: results,
    };
    
    if (results.length > 0) {
      // Calculate percentage scores for fair comparison
      const percentageScores = results.map(r => {
        const total = r.totalQuestions;
        // Return 0 for invalid data to prevent division by zero and misleading percentages
        if (!total || total === 0) return 0;
        return Math.round((r.correctAnswers || 0) / total * 100);
      });
      stats.bestScore = Math.max(...percentageScores);
      stats.averageScore = Math.round(percentageScores.reduce((a, b) => a + b, 0) / percentageScores.length);
      stats.lastTest = results[0].completedAt;
    }
    
    return stats;
  } catch (error) {
    console.error("❌ Error getting test results:", error);
    throw error;
  }
}

/**
 * Listen to real-time updates for answer history
 * @param {string} userId - Firebase Auth user ID
 * @param {Function} callback - Called with array of answers when data changes
 * @param {number} limitCount - Number of responses to retrieve
 * @returns {Function} Unsubscribe function
 */
function listenToAnswerHistory(userId, callback, limitCount = 50) {
  getFirestore().then(db => {
    const { collection, query, where, orderBy, limit: limitFn, onSnapshot } = window.firestoreExports;
    
    const responsesRef = collection(db, "questionResponses");
    const q = query(
      responsesRef,
      where("userId", "==", userId),
      orderBy("answeredAt", "desc"),
      limitFn(limitCount)
    );
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const answers = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          answers.push({
            id: doc.id,
            category: data.questionType || "—",
            weight: data.weight || "—",
            isCorrect: data.isCorrect || false,
            timestamp: data.answeredAt,
            timeTaken: data.timeSpent || null
          });
        });
        callback(answers);
      },
      (error) => {
        console.error("❌ Error listening to answer history:", error);
        if (error.code === 'failed-precondition' || error.message?.includes('index')) {
          console.error("\n🔥 FIRESTORE INDEX REQUIRED:\nYou need to create a composite index for 'questionResponses' collection:\n- Field: userId (Ascending)\n- Field: answeredAt (Descending)\n\nClick the link in the error above or go to Firebase Console > Firestore > Indexes\n");
        }
        callback([]);
      }
    );
    
    return unsubscribe;
  }).catch(error => {
    console.error("Failed to set up answer history listener:", error);
    callback([]);
  });
}

// ===============================
// Export functions
// ===============================
window.dbService = {
  getFirestore,
  saveUser,
  getUser,
  logQuestionResponse,
  getUserStatistics,
  getRecentResponses,
  getDailyStats,
  getWeeklyStats,
  getStudyStreak,
  saveTestResult,
  getTestResults,
  listenToAnswerHistory,
};
// ...removed log...
