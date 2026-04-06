/**
 * subscription-service.js
 * Manages user subscription tiers and access control
 *
 * Model:
 *  - FREE  : unlimited access to all content, with ads
 *  - AD_FREE: $10 CAD / 30 days — removes all ads
 */

const TIERS = {
  FREE: 'free',
  AD_FREE: 'ad-free'
};

const TIER_LIMITS = {
  [TIERS.FREE]: {
    listeningQuestions: Infinity,
    readingQuestions: Infinity,
    writingPrompts: Infinity,
    hasRealTests: true,
    hasDeservesAttention: true,
    hasWriting: true,
    hasAds: true,
    durationDays: null
  },
  [TIERS.AD_FREE]: {
    listeningQuestions: Infinity,
    readingQuestions: Infinity,
    writingPrompts: Infinity,
    hasRealTests: true,
    hasDeservesAttention: true,
    hasWriting: true,
    hasAds: false,
    durationDays: 30
  }
};

class SubscriptionService {
  constructor() {
    this.currentUserData = null;
    this._unsubscribeSnapshot = null;
    this._tierChangeCallbacks = [];
  }

  /**
   * Register a callback to be invoked when the user's tier changes in Firestore.
   * @param {function(newTier: string, previousTier: string): void} callback
   */
  addTierChangeCallback(callback) {
    this._tierChangeCallbacks.push(callback);
  }

  /**
   * Stop the real-time Firestore listener and reset cached state.
   * Call this when the user logs out.
   */
  cleanup() {
    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
      this._unsubscribeSnapshot = null;
    }
    this.currentUserData = null;
    this._tierChangeCallbacks = [];
  }

  /**
   * Initialize subscription service for current user
   */
  async init() {
    // Cancel any existing real-time listener before setting up a new one
    if (this._unsubscribeSnapshot) {
      this._unsubscribeSnapshot();
      this._unsubscribeSnapshot = null;
    }

    const user = window.AuthService?.getCurrentUser();
    if (!user) {
      return null;
    }

    try {
      const userData = await this.getUserSubscriptionData(user.uid);
      this.currentUserData = userData;
      
      // Notify registered callbacks about the initial tier so that AdService
      // can remove the bottom ad bar immediately for ad-free users.
      // We only notify when the tier is 'ad-free' to avoid triggering a page
      // reload (via refreshAdVisibility) for free-tier users on every load.
      if (this.currentUserData?.tier === 'ad-free') {
        this._tierChangeCallbacks.forEach(cb => {
          try { cb('ad-free', null); } catch (err) {
            console.error('[SubscriptionService] Tier init callback error:', err);
          }
        });
      }

      // Check if subscription has expired (this may update currentUserData)
      await this.checkAndUpdateExpiredSubscription(user.uid, userData);

      // Set up real-time listener so external Firebase changes are picked up
      this._setupTierListener(user.uid);
      
      // ✅ Return currentUserData (may have been updated if subscription expired)
      return this.currentUserData;
    } catch (error) {
      console.error('Error initializing subscription service:', error);
      return null;
    }
  }

  /**
   * Attach an onSnapshot listener to the user document so that manual tier
   * edits in Firebase are reflected immediately without a page refresh.
   * @param {string} userId
   */
  _setupTierListener(userId) {
    (async () => {
      try {
        const db = await window.__firestoreReady;
        if (!db || !window.firestoreExports) return;

        const { doc, onSnapshot } = window.firestoreExports;
        if (!onSnapshot) return;

        const userRef = doc(db, 'users', userId);

        this._unsubscribeSnapshot = onSnapshot(
          userRef,
          (snapshot) => {
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            if (!data.tier) data.tier = TIERS.FREE;
            if (!data.usage) {
              data.usage = this.currentUserData?.usage || {
                listeningQuestionsAnswered: 0,
                readingQuestionsAnswered: 0,
                writingPromptsUsed: 0,
                totalAdsViewed: 0
              };
            }

            const previousTier = this.currentUserData?.tier;
            const newTier = data.tier;

            this.currentUserData = data;

            // Notify registered callbacks only when the tier actually changes
            if (previousTier !== undefined && previousTier !== newTier) {
              this._tierChangeCallbacks.forEach(cb => {
                try { cb(newTier, previousTier); } catch (err) {
                  console.error('[SubscriptionService] Tier change callback error:', err);
                }
              });
            }
          },
          (error) => {
            console.error('[SubscriptionService] Snapshot listener error:', error);
          }
        );
      } catch (error) {
        console.error('[SubscriptionService] Failed to set up tier listener:', error);
      }
    })();
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
          writingPromptsUsed: 0,
          totalAdsViewed: 0
        };
      }
      
      // ✅ Ensure tier exists
      if (!data.tier) {
        data.tier = TIERS.FREE;
      }
      
      return data;
    } else {
      // Create default free tier user - get user info from Auth
      const user = window.AuthService?.getCurrentUser();
      
      const defaultData = {
        email: user?.email || '',
        displayName: user?.displayName || user?.email?.split('@')[0] || 'User',
        tier: TIERS.FREE,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        usage: {
          listeningQuestionsAnswered: 0,
          readingQuestionsAnswered: 0,
          writingPromptsUsed: 0,
          questionsAnsweredSinceLastAd: 0,
          totalAdsViewed: 0
        }
      };
      
      await this.updateUserSubscriptionData(userId, defaultData);
      
      // Create initial free tier record
      await this.createOrder(userId, TIERS.FREE, 0);
      
      return defaultData;
    }
  }

  /**
   * Create an order record
   */
  async createOrder(userId, tier, price = 0) {
    try {
      const db = await window.__firestoreReady;
      if (!db || !window.firestoreExports) {
        throw new Error('Firestore not available');
      }

      const { collection, addDoc, serverTimestamp } = window.firestoreExports;
      
      // Map tier to friendly plan names
      const planNames = {
        'free': 'Free (with Ads)',
        'ad-free': 'Ad-Free (30 days)'
      };
      
      const orderData = {
        userId: userId,
        tier: tier,
        plan: planNames[tier] || tier,
        price: price,
        status: price === 0 ? 'Free' : 'Completed',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);
    } catch (error) {
      console.error('Failed to create order:', error);
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
      await this.updateUserSubscriptionData(userId, {
        tier: TIERS.FREE,
        subscriptionStartDate: null,
        subscriptionEndDate: null
      });
      
      // Create order record for downgrade to free
      await this.createOrder(userId, TIERS.FREE, 0);
      
      // ✅ Refresh currentUserData after downgrade
      const updatedUserData = await this.getUserSubscriptionData(userId);
      this.currentUserData = updatedUserData;
    }
  }

  /**
   * Set user subscription tier (called after purchase)
   */
  async setUserTier(userId, tier, duration, price = 0) {
    const now = new Date();
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

    await this.updateUserSubscriptionData(userId, {
      tier: tier,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate
    });
    
    // Create order record for purchase
    await this.createOrder(userId, tier, price);
  }

  /**
   * Increment usage counter and track questions for ad triggering
   */
  async incrementUsage(userId, type) {
    const userData = this.currentUserData || await this.getUserSubscriptionData(userId);
    
    const usage = userData.usage || {
      listeningQuestionsAnswered: 0,
      readingQuestionsAnswered: 0,
      writingPromptsUsed: 0,
      questionsAnsweredSinceLastAd: 0,
      totalAdsViewed: 0
    };

    const oldValue = usage[type === 'listening' ? 'listeningQuestionsAnswered' : type === 'reading' ? 'readingQuestionsAnswered' : 'writingPromptsUsed'];

    if (type === 'listening') {
      usage.listeningQuestionsAnswered++;
    } else if (type === 'reading') {
      usage.readingQuestionsAnswered++;
    } else if (type === 'writing') {
      usage.writingPromptsUsed++;
    }

    // Track questions since last ad (for vignette every 10)
    if (type === 'listening' || type === 'reading') {
      usage.questionsAnsweredSinceLastAd = (usage.questionsAnsweredSinceLastAd || 0) + 1;
    }

    await this.updateUserSubscriptionData(userId, { usage });
    
    // Update current data cache
    this.currentUserData = await this.getUserSubscriptionData(userId);
  }

  /**
   * Reset the per-ad question counter (called after showing a vignette ad)
   */
  async resetAdCounter(userId) {
    const userData = this.currentUserData || await this.getUserSubscriptionData(userId);
    const usage = { ...(userData.usage || {}), questionsAnsweredSinceLastAd: 0 };
    await this.updateUserSubscriptionData(userId, { usage });
    this.currentUserData = await this.getUserSubscriptionData(userId);
  }

  /**
   * Increment the total ads viewed counter (called each time a vignette ad is shown)
   */
  async incrementAdsViewed(userId) {
    const userData = this.currentUserData || await this.getUserSubscriptionData(userId);
    const usage = { ...(userData.usage || {}) };
    usage.totalAdsViewed = (usage.totalAdsViewed || 0) + 1;
    await this.updateUserSubscriptionData(userId, { usage });
    this.currentUserData = await this.getUserSubscriptionData(userId);
  }

  /**
   * Check if user should see ads (free tier)
   */
  hasAds(userData = null) {
    const data = userData || this.currentUserData;
    if (!data) return true;
    const tierLimits = TIER_LIMITS[data.tier] || TIER_LIMITS[TIERS.FREE];
    return tierLimits.hasAds !== false;
  }

  /**
   * Check if user can access a feature
   */
  canAccess(feature, userData = null) {
    const data = userData || this.currentUserData;
    
    if (!data) {
      return true; // ✅ No data yet = new user, allow access
    }

    const tierLimits = TIER_LIMITS[data.tier] || TIER_LIMITS[TIERS.FREE];
    const usage = data.usage || {}; // ✅ Default to empty usage object

    switch (feature) {
      case 'listening':
        const listeningResult = (usage.listeningQuestionsAnswered || 0) < tierLimits.listeningQuestions;
        return listeningResult;
      
      case 'reading':
        const readingResult = (usage.readingQuestionsAnswered || 0) < tierLimits.readingQuestions;
        return readingResult;
      
      case 'writing':
        const writingResult = !tierLimits.hasWriting ? false : (usage.writingPromptsUsed || 0) < tierLimits.writingPrompts;
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
   * Create remove-ads / upgrade modal
   */
  createUpgradeModal(message = null) {
    const defaultMessage = message || 'Enjoy SimpleTCF ad-free — remove all ads for just CAD $10 / 30 days.';
    
    const modalHTML = `
      <div id="upgradeModal" class="upgrade-modal">
        <div class="upgrade-modal__backdrop"></div>
        <div class="upgrade-modal__content">
          <div class="upgrade-modal__icon" aria-hidden="true">🚫📢</div>
          <h2 class="upgrade-modal__title">Remove Ads</h2>
          <p class="upgrade-modal__message">${defaultMessage}</p>
          <a href="/plan.html" class="btn btn--primary upgrade-modal__cta">Go Ad-Free – CAD $10</a>
          <button class="btn btn--ghost upgrade-modal__dismiss" onclick="document.getElementById('upgradeModal').classList.add('quiz--hidden')">Continue with Ads</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

// Export singleton instance
window.SubscriptionService = new SubscriptionService();
