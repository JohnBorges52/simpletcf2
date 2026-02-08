/**
 * subscription-service.js
 * Manages user subscription tiers and access control
 */

const TIERS = {
  FREE: 'free',
  QUICK_STUDY: 'quick-study',
  INTENSIVE_30: '30-day',
  FULL_PREP: 'full-prep'
};

const TIER_LIMITS = {
  [TIERS.FREE]: {
    listeningQuestions: 15,
    readingQuestions: 15,
    writingPrompts: 3,
    hasRealTests: false,
    hasDeservesAttention: false,
    hasWriting: true, // limited to 3 prompts
    durationDays: null
  },
  [TIERS.QUICK_STUDY]: {
    listeningQuestions: Infinity,
    readingQuestions: Infinity,
    writingPrompts: 0,
    hasRealTests: false,
    hasDeservesAttention: false,
    hasWriting: false,
    durationDays: 10
  },
  [TIERS.INTENSIVE_30]: {
    listeningQuestions: Infinity,
    readingQuestions: Infinity,
    writingPrompts: Infinity,
    hasRealTests: true,
    hasDeservesAttention: true,
    hasWriting: true,
    durationDays: 30
  },
  [TIERS.FULL_PREP]: {
    listeningQuestions: Infinity,
    readingQuestions: Infinity,
    writingPrompts: Infinity,
    hasRealTests: true,
    hasDeservesAttention: true,
    hasWriting: true,
    durationDays: 60
  }
};

class SubscriptionService {
  constructor() {
    this.currentUserData = null;
  }

  /**
   * Initialize subscription service for current user
   */
  async init() {
    const user = window.AuthService?.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return null;
    }

    try {
      const userData = await this.getUserSubscriptionData(user.uid);
      this.currentUserData = userData;
      
      // Check if subscription has expired
      await this.checkAndUpdateExpiredSubscription(user.uid, userData);
      
      return userData;
    } catch (error) {
      console.error('Error initializing subscription service:', error);
      return null;
    }
  }

  /**
   * Get user subscription data from Firestore
   */
  async getUserSubscriptionData(userId) {
    // ✅ Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      throw new Error('Firestore not available');
    }

    const { doc, getDoc } = window.firestoreExports;
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      
      // ✅ Ensure usage object exists with default values
      if (!data.usage) {
        data.usage = {
          listeningQuestionsAnswered: 0,
          readingQuestionsAnswered: 0,
          writingPromptsUsed: 0
        };
      }
      
      // ✅ Ensure tier exists
      if (!data.tier) {
        data.tier = TIERS.FREE;
      }
      
      return data;
    } else {
      // Create default free tier user
      const defaultData = {
        tier: TIERS.FREE,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        usage: {
          listeningQuestionsAnswered: 0,
          readingQuestionsAnswered: 0,
          writingPromptsUsed: 0
        }
      };
      
      await this.updateUserSubscriptionData(userId, defaultData);
      return defaultData;
    }
  }

  /**
   * Update user subscription data in Firestore
   */
  async updateUserSubscriptionData(userId, data) {
    // ✅ Wait for Firestore to be ready
    const db = await window.__firestoreReady;
    if (!db || !window.firestoreExports) {
      throw new Error('Firestore not available');
    }

    const { doc, setDoc, serverTimestamp } = window.firestoreExports;
    const userRef = doc(db, 'users', userId);
    
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });

    this.currentUserData = { ...this.currentUserData, ...data };
  }

  /**
   * Check if subscription has expired and downgrade to free tier
   */
  async checkAndUpdateExpiredSubscription(userId, userData) {
    if (!userData.subscriptionEndDate) return;

    const now = new Date();
    const endDate = userData.subscriptionEndDate.toDate ? userData.subscriptionEndDate.toDate() : new Date(userData.subscriptionEndDate);

    if (now > endDate) {
      console.log('Subscription expired, downgrading to free tier');
      await this.updateUserSubscriptionData(userId, {
        tier: TIERS.FREE,
        subscriptionStartDate: null,
        subscriptionEndDate: null
      });
    }
  }

  /**
   * Set user subscription tier (called after purchase)
   */
  async setUserTier(userId, tier, duration) {
    const now = new Date();
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    await this.updateUserSubscriptionData(userId, {
      tier: tier,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate
    });
  }

  /**
   * Increment usage counter for free tier
   */
  async incrementUsage(userId, type) {
    const userData = this.currentUserData || await this.getUserSubscriptionData(userId);
    
    const usage = userData.usage || {
      listeningQuestionsAnswered: 0,
      readingQuestionsAnswered: 0,
      writingPromptsUsed: 0
    };

    const oldValue = usage[type === 'listening' ? 'listeningQuestionsAnswered' : type === 'reading' ? 'readingQuestionsAnswered' : 'writingPromptsUsed'];

    if (type === 'listening') {
      usage.listeningQuestionsAnswered++;
    } else if (type === 'reading') {
      usage.readingQuestionsAnswered++;
    } else if (type === 'writing') {
      usage.writingPromptsUsed++;
    }

    const newValue = usage[type === 'listening' ? 'listeningQuestionsAnswered' : type === 'reading' ? 'readingQuestionsAnswered' : 'writingPromptsUsed'];
    console.log(`📊 ${type} usage: ${oldValue} → ${newValue}`);

    await this.updateUserSubscriptionData(userId, { usage });
    
    // Update current data cache
    this.currentUserData = await this.getUserSubscriptionData(userId);
  }

  /**
   * Check if user can access a feature
   */
  canAccess(feature, userData = null) {
    const data = userData || this.currentUserData;
    console.log('🔍 [DEBUG] canAccess called - feature:', feature, 'data:', data);
    
    if (!data) {
      console.log('🔍 [DEBUG] No data, returning true (new user)');
      return true; // ✅ No data yet = new user, allow access
    }

    const tierLimits = TIER_LIMITS[data.tier] || TIER_LIMITS[TIERS.FREE];
    const usage = data.usage || {}; // ✅ Default to empty usage object
    console.log('🔍 [DEBUG] Tier:', data.tier, 'TierLimits:', tierLimits, 'Usage:', usage);

    switch (feature) {
      case 'listening':
        const listeningResult = (usage.listeningQuestionsAnswered || 0) < tierLimits.listeningQuestions;
        console.log('🔍 [DEBUG] Listening check:', usage.listeningQuestionsAnswered, '<', tierLimits.listeningQuestions, '=', listeningResult);
        return listeningResult;
      
      case 'reading':
        const readingResult = (usage.readingQuestionsAnswered || 0) < tierLimits.readingQuestions;
        console.log('🔍 [DEBUG] Reading check:', usage.readingQuestionsAnswered, '<', tierLimits.readingQuestions, '=', readingResult);
        return readingResult;
      
      case 'writing':
        const writingResult = !tierLimits.hasWriting ? false : (usage.writingPromptsUsed || 0) < tierLimits.writingPrompts;
        console.log('🔍 [DEBUG] Writing check - hasWriting:', tierLimits.hasWriting, 'usage:', usage.writingPromptsUsed, '<', tierLimits.writingPrompts, '=', writingResult);
        return writingResult;
      
      case 'realTests':
        return tierLimits.hasRealTests;
      
      case 'deservesAttention':
        return tierLimits.hasDeservesAttention;
      
      default:
        return false;
    }
  }

  /**
   * Get remaining usage counts
   */
  getRemainingUsage(userData = null) {
    const data = userData || this.currentUserData;
    if (!data) return null;

    const tierLimits = TIER_LIMITS[data.tier] || TIER_LIMITS[TIERS.FREE];
    const usage = data.usage || {};

    return {
      listening: Math.max(0, tierLimits.listeningQuestions - (usage.listeningQuestionsAnswered || 0)),
      reading: Math.max(0, tierLimits.readingQuestions - (usage.readingQuestionsAnswered || 0)),
      writing: Math.max(0, tierLimits.writingPrompts - (usage.writingPromptsUsed || 0))
    };
  }

  /**
   * Get current tier name
   */
  getCurrentTier() {
    return this.currentUserData?.tier || TIERS.FREE;
  }

  /**
   * Show upgrade modal
   */
  showUpgradeModal(message = null) {
    const modal = document.getElementById('upgradeModal');
    if (!modal) {
      this.createUpgradeModal(message);
    } else {
      if (message) {
        const msgEl = modal.querySelector('.upgrade-modal__message');
        if (msgEl) msgEl.textContent = message;
      }
      modal.classList.remove('quiz--hidden');
    }
  }

  /**
   * Create upgrade modal if it doesn't exist
   */
  createUpgradeModal(message = null) {
    const defaultMessage = message || 'Keep enjoying SimpleTCF by selecting a plan!';
    
    const modalHTML = `
      <div id="upgradeModal" class="upgrade-modal">
        <div class="upgrade-modal__backdrop"></div>
        <div class="upgrade-modal__content">
          <div class="upgrade-modal__icon">🔒</div>
          <h2 class="upgrade-modal__title">Upgrade Required</h2>
          <p class="upgrade-modal__message">${defaultMessage}</p>
          <a href="/plan.html" class="btn btn--primary upgrade-modal__cta">View Plans</a>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ✅ NO event listeners - modal is non-dismissable
    // User MUST click "View Plans" to proceed
  }
}

// Export singleton instance
window.SubscriptionService = new SubscriptionService();
