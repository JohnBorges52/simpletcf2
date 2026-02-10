# Email Verification Flow - Implementation Guide

## Overview
This document describes the complete email verification flow for SimpleTCF, ensuring unverified users cannot access protected content and providing a smooth registration experience.

---

## 🔄 User Flow

### **First-Time Registration**

1. **User visits `/register.html`**
   - Enters name, email, password
   - Clicks "Get Started"

2. **Account Creation**
   - Firebase creates account with `emailVerified: false`
   - Verification email is automatically sent to user's inbox
   - Popup appears: "Check Your Email" with email address shown

3. **"Got it" Button**
   - User clicks "Got it" button
   - → User is **signed out** (cannot access app until verified)
   - → Redirected to `/login.html`
   - User cannot access protected pages until email is verified

4. **Email Verification**
   - User opens email and clicks verification link
   - Link redirects to Firebase action handler (via `config.js`)
   - Firebase verifies email → `emailVerified: true`
   - User is redirected to `/welcome.html`

5. **Welcome Page (`/welcome.html`)**
   - Shows: "Thanks for verifying your email. Click the button below to start using SimpleTCF."
   - Displays user's name and email
   - User clicks "Go to Home Page"
   - → Creates Firestore user document (if doesn't exist)
   - → Redirects to `/index.html`
   - User is now fully authenticated and can access all features

---

### **Re-Registration Attempt (Existing Email, Unverified)**

**Scenario**: User registered but never verified email, tries to register again with same credentials.

1. **User visits `/register.html` again**
   - Enters same email/password

2. **Detection & Handling**
   - System catches `auth/email-already-in-use` error
   - Attempts sign-in with provided credentials
   - If successful and `emailVerified: false`:
     - Resends verification email
     - Shows "Check Your Email" popup
     - Signs out user immediately
     - Redirects to `/login.html` when user clicks "Got it"

3. **Success Message**
   - User sees: "We sent a verification email to [email]"
   - Can now check email and follow verification link

**Note**: If user tries to register with an existing email but **wrong password**, they see: "This email is already registered. Please sign in instead."

---

### **Re-Registration Attempt (Existing Email, Verified)**

**Scenario**: User registered and verified, but tries to register again.

1. **User enters verified email**
   - System detects email is already in use
   - Attempts sign-in, finds `emailVerified: true`

2. **Response**
   - User sees error: "This email is already registered. Please sign in instead."
   - User should use `/login.html` to access their account

---

### **Manual URL Access (Protected Pages)**

**Scenario**: Unverified user (or logged-out user) manually types `/profile.html`, `/listening.html`, `/reading.html`, or `/writing.html` in browser.

**Behavior**:
- Page checks authentication status
- If user is **logged out** → Redirect to `/login.html`
- If user is **logged in but NOT verified** → Sign out → Redirect to `/login.html`
- If user is **logged in AND verified** → Show page content

**Result**: Unverified users are treated exactly like logged-out users. No "check your email" popup appears.

---

### **Login Flow**

1. **Verified User Login**
   - User enters email/password on `/login.html`
   - If `emailVerified: true` → Show welcome overlay → Redirect to `/index.html`

2. **Unverified User Login**
   - User enters email/password on `/login.html`
   - System checks `emailVerified: false`
   - → Sends new verification email
   - → Signs out user immediately
   - → Shows error: "📩 Your email isn't verified. We just sent a new verification link to [email]. Please verify, then log in."

---

## 🔒 Security & Access Control

### **Protected Pages**
The following pages require **both** authentication AND email verification:
- `/profile.html`
- `/listening.html`
- `/reading.html`
- `/writing.html`

### **Auth Gating Logic**
```javascript
// Check 1: User logged in?
if (!user) {
  window.location.href = "/login.html";
  return;
}

// Check 2: Email verified?
if (!user.emailVerified) {
  // Sign out unverified user
  await signOutUser();
  window.location.href = "/login.html";
  return;
}

// ✅ User is authenticated AND verified
// Show page content
```

### **Why Sign Out Unverified Users?**
- **Prevents unauthorized access**: Unverified users cannot access protected content
- **Enforces verification**: Users must complete verification to use the app
- **Consistent UX**: Unverified users are treated the same as logged-out users
- **Security best practice**: Don't maintain sessions for unverified accounts

---

## 🛠️ Technical Implementation

### **Files Modified**

#### **1. `config.js`** (Registration Logic)
- **Line ~300**: Updated registration error handling
  - Detects `auth/email-already-in-use`
  - Attempts sign-in to check verification status
  - Resends verification email if unverified
  - Shows appropriate user message

- **Line ~715**: Updated `showVerificationMessage()`
  - "Got it" button now signs out user
  - Redirects to `/login.html` instead of staying on register page

#### **2. Protected Pages** (Auth Gating)
- **`profile.js`** (Line ~700)
- **`listening.js`** (Line ~20)
- **`reading.js`** (Line ~20)
- **`writing.js`** (Line ~6)

**Changes**:
- Added check: `if (!user || !user.emailVerified)`
- If unverified, sign out user and redirect to `/login.html`
- Removed redirects to `/verify-email.html`

#### **3. `welcome.html`** (Verification Success Page)
- **Line ~100**: Updated auth checks
  - If no user → Redirect to `/login.html`
  - If unverified → Sign out → Redirect to `/login.html`
  - If verified → Show welcome message and "Go to Home Page" button

---

## 🔧 Firebase Console Settings

### **1. Email Verification Template**

**Location**: Firebase Console → Authentication → Templates → Email address verification

**Recommended Template**:
```
Subject: Verify your email for SimpleTCF

Hi %DISPLAY_NAME%,

Thanks for signing up for SimpleTCF! We're excited to help you prepare for the TCF exam.

To complete your registration and start practicing, please verify your email address by clicking the link below:

%LINK%

This link will expire in 24 hours.

If you didn't create a SimpleTCF account, you can safely ignore this email.

Best regards,
The SimpleTCF Team
```

### **2. Authorized Domains**

**Location**: Firebase Console → Authentication → Settings → Authorized domains

**Required Domains**:
- `localhost` (for development)
- `simpletcf.firebaseapp.com` (Firebase Hosting default)
- `simpletcf.web.app` (Firebase Hosting custom domain)
- Your production domain (e.g., `simpletcf.com`)

**How to Add**:
1. Go to Authentication → Settings → Authorized domains
2. Click "Add domain"
3. Enter domain (e.g., `simpletcf.com`)
4. Click "Add"

### **3. Email Verification Action URL**

**Location**: Firebase Console → Authentication → Templates → Email address verification → Customize action URL

**Recommended Setting**:
- **Default**: `https://simpletcf.firebaseapp.com/__/auth/action`
- This automatically redirects to your app with the verification code
- The code in `config.js` handles the `mode=verifyEmail&oobCode=...` parameters

**How It Works**:
1. User clicks link in email
2. Firebase processes verification code
3. Redirects to your app: `https://yourdomain.com/?mode=verifyEmail&oobCode=ABC123...`
4. `config.js` detects these parameters and:
   - Calls `applyActionCode()` to verify email
   - Redirects to `/welcome.html`

### **4. Continue URL (Optional)**

**Location**: Same as above → "Continue URL"

**Purpose**: After email verification, redirect users to a specific page

**Recommended**:
- Leave blank or set to: `https://yourdomain.com/welcome.html`
- The code handles redirection automatically

---

## 📋 Testing Checklist

### **Test 1: First-Time Registration**
- [ ] Register with new email
- [ ] Verification email sent
- [ ] Popup shows "Check Your Email"
- [ ] Click "Got it" → Redirected to `/login.html`
- [ ] Try accessing `/profile.html` → Redirected to `/login.html` (not logged in)
- [ ] Click verification link in email → Redirected to `/welcome.html`
- [ ] See welcome message with name/email
- [ ] Click "Go to Home Page" → Redirected to `/index.html`
- [ ] Can now access `/profile.html`, `/listening.html`, etc.

### **Test 2: Re-Registration (Unverified)**
- [ ] Register with email
- [ ] Click "Got it" but DON'T verify email
- [ ] Try to register again with same email/password
- [ ] See popup: "Email verification sent to your inbox"
- [ ] Receive new verification email
- [ ] Click "Got it" → Redirected to `/login.html`

### **Test 3: Re-Registration (Verified)**
- [ ] Register and verify email
- [ ] Try to register again with same email
- [ ] See error: "This email is already registered. Please sign in instead."

### **Test 4: Login (Unverified)**
- [ ] Register but don't verify
- [ ] Try to log in with email/password
- [ ] See error: "Your email isn't verified. We just sent a new verification link..."
- [ ] Receive verification email
- [ ] User is signed out

### **Test 5: Login (Verified)**
- [ ] Register and verify email
- [ ] Log in with email/password
- [ ] See welcome overlay
- [ ] Redirected to `/index.html`
- [ ] Can access all protected pages

### **Test 6: Manual URL Access (Unverified)**
- [ ] Register but don't verify
- [ ] While logged in (before clicking "Got it"), manually type `/profile.html` in URL
- [ ] User is signed out
- [ ] Redirected to `/login.html`
- [ ] NO popup saying "check your email"

### **Test 7: Manual URL Access (Logged Out)**
- [ ] Make sure logged out
- [ ] Type `/listening.html` in URL
- [ ] Redirected to `/login.html`
- [ ] NO popup saying "check your email"

---

## 🎯 Key Improvements

### **Before**
❌ Unverified users could stay logged in  
❌ Protected pages showed "check email" popup for unverified users  
❌ Re-registration with unverified email showed wrong error message  
❌ Confusing UX with multiple verification-related pages  

### **After**
✅ Unverified users are automatically signed out  
✅ Protected pages treat unverified users like logged-out users  
✅ Re-registration with unverified email resends verification automatically  
✅ Clear and consistent user experience  
✅ Better security (no sessions for unverified accounts)  

---

## 🚀 Deployment Notes

### **Environment Variables**
No environment variables needed - Firebase config is already in `config.js`.

### **Firebase Hosting**
Make sure these files are deployed:
- `public/register.html`
- `public/login.html`
- `public/welcome.html`
- `public/verify-email.html` (optional, for edge cases)
- `public/config.js`
- `public/auth-service.js`
- All protected pages (`profile.html`, `listening.html`, etc.)

### **Deploy Command**
```bash
firebase deploy --only hosting
```

---

## 📞 Support

If users report issues with email verification:

1. **Check spam folder**: Verification emails might be filtered
2. **Resend email**: Use `/verify-email.html` or attempt login again
3. **Check Firebase Console**: Authentication → Users → Check `emailVerified` status
4. **Manually verify** (admin only): 
   - Firebase Console → Authentication → Users
   - Click on user → Edit → Check "Email verified"

---

## 🔍 Debugging

### **Enable Verbose Logging**
All auth operations already log to console:
- `console.log("✅ User authenticated and email verified:", user.email)`
- `console.log("🔒 User email not verified, signing out...")`
- `console.log("❌ No user found, redirecting to login")`

### **Common Issues**

**Issue**: Verification email not received
- Check Firebase Console → Authentication → Templates (make sure template is enabled)
- Check user's spam folder
- Check email quota (Firebase free tier: 100/day)

**Issue**: User stuck in verification loop
- Check browser console for errors
- Clear browser cache and cookies
- Try incognito mode
- Manually verify in Firebase Console (admin)

**Issue**: Protected pages accessible without verification
- Check browser console for auth status
- Make sure `config.js` is loaded before page scripts
- Check network tab for auth state changes

---

## ✅ Summary

This implementation ensures:
1. **Unverified users = Logged-out users** (no access to protected content)
2. **Automatic re-send** of verification emails for existing unverified accounts
3. **Clean UX** with clear messaging and proper redirects
4. **Security** via automatic sign-out of unverified sessions
5. **Welcome flow** that guides users through verification completion

All changes are client-side only (no backend/cloud functions required), following Firebase Auth best practices.
