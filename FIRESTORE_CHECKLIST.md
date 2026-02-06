# Firestore Setup Checklist

Use this checklist to set up Firestore for your SimpleTCF2 application.

## Prerequisites
- [ ] Firebase project exists (simpletcf)
- [ ] Firebase Authentication is working
- [ ] You have admin access to Firebase Console
- [ ] Firebase CLI is installed (`npm install -g firebase-tools`)

## Setup Steps

### Step 1: Enable Firestore Database
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Select your project (simpletcf)
- [ ] Click **Build** → **Firestore Database** in left menu
- [ ] Click **"Create database"** button
- [ ] Select **"Start in production mode"**
- [ ] Choose your region (e.g., us-central1, europe-west1)
- [ ] Click **"Enable"** and wait for setup to complete

**Status:** Firestore is now enabled ✅

### Step 2: Deploy Security Rules
```bash
# Navigate to project directory
cd /path/to/simpletcf2

# Login to Firebase (if needed)
firebase login

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

- [ ] Security rules deployed successfully
- [ ] Check Firebase Console → Firestore Database → Rules tab
- [ ] Verify rules are showing (not default template)

**Status:** Security rules are deployed ✅

### Step 3: Test User Creation
- [ ] Open your application in browser
- [ ] Register a new test user
- [ ] Complete email verification
- [ ] Log in with the test user

**Verify:**
- [ ] Go to Firebase Console → Firestore Database → Data tab
- [ ] See `users` collection created
- [ ] See a document with your user ID
- [ ] Document contains: email, displayName, createdAt, lastLoginAt

**Status:** User creation works ✅

### Step 4: Test Question Response Logging
- [ ] Navigate to Reading practice
- [ ] Select a difficulty level
- [ ] Answer 2-3 questions
- [ ] Navigate to Listening practice
- [ ] Select a difficulty level
- [ ] Answer 2-3 questions

**Verify:**
- [ ] Go to Firebase Console → Firestore Database → Data tab
- [ ] See `questionResponses` collection created
- [ ] See multiple response documents
- [ ] Each document contains: userId, questionId, questionType, isCorrect, etc.

**Status:** Response logging works ✅

### Step 5: Create Required Indexes
- [ ] Open browser DevTools console (F12)
- [ ] Look for Firestore index errors (if any)
- [ ] Click the index creation link in the error
- [ ] Wait for index to build (1-2 minutes)
- [ ] Refresh the page

**Common indexes needed:**
- [ ] userId + answeredAt (descending)
- [ ] userId + questionType + answeredAt (descending)
- [ ] userId + weight + answeredAt (descending)

**Status:** Indexes created ✅

### Step 6: Test Profile Statistics
- [ ] Navigate to Profile page
- [ ] Check "Questions answered" shows correct count
- [ ] Check "Accuracy" shows percentage
- [ ] Switch to "Progress" tab
- [ ] Verify statistics show by question type
- [ ] Verify weight breakdown is displayed

**Status:** Profile statistics work ✅

## Verification Checklist

### Firebase Console Checks
- [ ] Firestore Database is enabled
- [ ] Security rules are deployed (not default)
- [ ] `users` collection exists with documents
- [ ] `questionResponses` collection exists with documents
- [ ] Indexes are created (no errors in console)

### Application Checks
- [ ] Users can register and login
- [ ] Answering questions doesn't show errors
- [ ] Profile shows statistics from Firestore
- [ ] No "permission denied" errors in console
- [ ] No "index not found" errors in console

## Troubleshooting

### Issue: "Firestore is not initialized"
- **Cause:** Firestore not enabled in Firebase Console
- **Fix:** Complete Step 1 above

### Issue: "Missing or insufficient permissions"
- **Cause:** Security rules not deployed
- **Fix:** Run `firebase deploy --only firestore:rules`

### Issue: "Index not found" error in console
- **Cause:** Query needs an index
- **Fix:** Click the link in the error message to create index

### Issue: Statistics not showing in profile
- **Cause:** No data logged yet, or indexes missing
- **Fix:** 
  1. Answer some questions first
  2. Create indexes if prompted
  3. Refresh the page

### Issue: "9 FAILED_PRECONDITION" error
- **Cause:** Firestore not enabled or rules not deployed
- **Fix:** Complete Steps 1 and 2 above

## Success Criteria

All of these should be true:
- ✅ Firestore enabled in Firebase Console
- ✅ Security rules deployed
- ✅ User documents created automatically
- ✅ Response documents created automatically
- ✅ Indexes created (no console errors)
- ✅ Profile shows real statistics

## Next Steps After Setup

- [ ] Monitor Firestore usage in Firebase Console
- [ ] Set up billing alerts
- [ ] Test with multiple users
- [ ] Verify data privacy (users can't see others' data)
- [ ] Review `FIRESTORE_DATABASE.md` for API details

## Need Help?

- **Quick Start:** `FIRESTORE_QUICKSTART.md` - Answers common questions
- **Detailed Guide:** `FIRESTORE_SETUP.md` - Step-by-step instructions
- **Database Schema:** `FIRESTORE_DATABASE.md` - API reference
- **Implementation:** `FIRESTORE_IMPLEMENTATION.md` - What was built

## Completion

Date completed: _______________

Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Setup is complete when all checkboxes are marked! ✅**
