# Firestore Migration Deployment Guide

## ⚠️ UPDATED: Recent Security Rules Fix

**Important:** This document covers the initial Firestore migration. For deploying the **recent security rules update** (PR #6), see:

📖 **[DEPLOY_FIRESTORE_RULES.md](DEPLOY_FIRESTORE_RULES.md)** - Deploy updated Firestore rules to Google Cloud

---

## Overview
This migration changes the application's quiz answer storage from browser localStorage to Firestore Database, enabling data persistence across devices and browsers.

## Files Changed

### Core Files
- **public/config.js** - Added Firestore imports and initialization
- **public/firestore-storage.js** - NEW: Helper module for Firestore storage operations
- **public/listening.js** - Updated to use Firestore storage with async/await
- **public/app.js** - Updated to use Firestore storage with async/await
- **public/reading.js** - Updated to use Firestore storage with async/await

### Configuration Files
- **firestore.rules** - NEW: Security rules for Firestore
- **firebase.json** - Added Firestore rules configuration

### HTML Files
- **public/listening.html** - Updated to load listening.js as ES6 module
- **public/practice.html** - Updated to load app.js as ES6 module
- **public/reading.html** - Updated to load reading.js as ES6 module

## Deployment Steps

### 1. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

This will deploy the security rules that ensure users can only access their own data.

**📖 For detailed deployment instructions, see:** [DEPLOY_FIRESTORE_RULES.md](DEPLOY_FIRESTORE_RULES.md)

### 2. Deploy Hosting
```bash
firebase deploy --only hosting
```

This will deploy all the updated JavaScript and HTML files.

### 3. Verify Deployment
After deployment, check:
- Firebase Console > Firestore Database is enabled
- Security rules are active
- Quiz pages (listening, reading, practice) load without errors

## Key Features

### ✅ Automatic Migration
- When an authenticated user first loads a quiz page after the update, their localStorage data is automatically migrated to Firestore
- Migration happens only once per user
- Original localStorage data is kept as backup

### ✅ Backward Compatibility
- Unauthenticated users continue to use localStorage
- No breaking changes for existing users
- Data persists even if Firestore is temporarily unavailable

### ✅ Security
- Firestore rules prevent unauthorized access
- Users can only read/write their own data
- All operations require authentication

## Data Structure in Firestore

```
users/
  {userId}/
    data/
      tracking: {
        answers: {
          "{testId}-question{number}": {
            correct: number,
            wrong: number,
            lastAnswered: timestamp
          }
        },
        lastUpdated: timestamp
      }
      events: {
        items: [
          {
            ts: timestamp,
            test_id: string,
            question_number: number,
            question_weight: number,
            correct: boolean
          }
        ],
        lastUpdated: timestamp
      }
      listening: {
        answers: {
          "{questionKey}": {
            correct: number,
            wrong: number,
            lastAnswered: timestamp
          }
        },
        tests: {
          count: number,
          items: [
            {
              number: number,
              date: timestamp,
              weightedScore: number,
              pct: number,
              clb: string,
              band: string,
              totalCorrect: number
            }
          ]
        },
        lastUpdated: timestamp
      }
```

## Testing Checklist

After deployment, verify:

- [ ] **Authenticated users can save answers**
  - Log in with Google
  - Answer a few quiz questions
  - Refresh the page
  - Verify answers are retained

- [ ] **Answers sync across devices**
  - Log in on one device
  - Answer some questions
  - Log in on another device
  - Verify the answers appear

- [ ] **Migration works**
  - Clear Firestore data for a test user
  - Add some data to localStorage manually
  - Log in as that user
  - Verify localStorage data appears in Firestore

- [ ] **Unauthenticated users can still use the app**
  - Log out
  - Answer some questions
  - Verify they're saved to localStorage
  - Refresh the page
  - Verify answers are retained

- [ ] **Security rules work**
  - Try to access another user's data via Firestore Console
  - Verify access is denied

## Troubleshooting

### Users report lost data
- Check if they're logged in
- Check Firestore Console for their user ID
- Verify security rules are deployed correctly

### Migration not happening
- Check browser console for errors
- Verify Firebase Auth is working
- Check that __firestore is initialized in window object

### Firestore operations failing
- Check Firestore Console for quota limits
- Verify project billing is enabled
- Check network tab for CORS errors

## Rollback Plan

If issues occur, you can rollback by:
1. Reverting to the previous commit
2. Deploying the old code: `firebase deploy --only hosting`
3. User data in localStorage will still be there
4. Firestore data will remain but won't be accessed

## Support

For issues, check:
- Browser console errors
- Firebase Console > Firestore Database
- Firebase Console > Authentication
- Network tab in browser DevTools
