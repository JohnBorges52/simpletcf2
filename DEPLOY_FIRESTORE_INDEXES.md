# Deploy Firestore Indexes

## Overview

This guide explains how to deploy Firestore indexes required for user statistics to work properly.

## Problem

Users cannot see their statistics because Firestore composite indexes are missing. The queries in `db-service.js` that fetch user statistics require compound indexes on the `questionResponses` collection.

## Solution

The required indexes are now defined in `firestore.indexes.json`. You need to deploy them to your Firebase project.

## Deployment Steps

### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Deploy the indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

4. **Wait for indexes to build** - This can take several minutes depending on the amount of data. You can monitor progress in the Firebase Console under **Firestore Database → Indexes**.

### Option 2: Manual Creation in Firebase Console

If you prefer to create indexes manually or the CLI deployment fails:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database → Indexes**
4. Click **Add Index** and create each of the following:

#### Index 1: Basic User Statistics
- **Collection ID**: `questionResponses`
- **Fields to index**:
  - `userId` - Ascending
  - `answeredAt` - Descending
- **Query scope**: Collection

#### Index 2: Statistics by Question Type
- **Collection ID**: `questionResponses`
- **Fields to index**:
  - `userId` - Ascending
  - `questionType` - Ascending
  - `answeredAt` - Descending
- **Query scope**: Collection

#### Index 3: Test Results Basic
- **Collection ID**: `testResults`
- **Fields to index**:
  - `userId` - Ascending
  - `completedAt` - Descending
- **Query scope**: Collection

#### Index 4: Test Results by Type
- **Collection ID**: `testResults`
- **Fields to index**:
  - `userId` - Ascending
  - `testType` - Ascending
  - `completedAt` - Descending
- **Query scope**: Collection

## Verification

After deploying the indexes:

1. Wait for all indexes to show status **"Enabled"** in the Firebase Console
2. Clear your browser cache
3. Log in to your application
4. Navigate to the profile page
5. Verify that statistics are now displaying correctly

## Troubleshooting

### Index build is taking too long
- Index building time depends on the amount of existing data
- For large datasets, it can take 30+ minutes
- Monitor progress in Firebase Console

### Deployment fails with permissions error
- Ensure you're logged in: `firebase login`
- Ensure you have proper permissions on the Firebase project
- Try switching to the correct project: `firebase use <project-id>`

### Statistics still not showing after deployment
1. Check browser console for errors
2. Verify indexes are in **"Enabled"** state (not "Building" or "Error")
3. Check Firestore security rules are deployed: `firebase deploy --only firestore:rules`
4. Verify user has answered questions (check `questionResponses` collection has documents)

## What These Indexes Do

- **Index 1**: Allows fetching all user responses ordered by date
- **Index 2**: Allows filtering responses by question type (reading/listening) and ordering by date
- **Index 3**: Allows fetching all user test results ordered by completion date
- **Index 4**: Allows filtering test results by type and ordering by completion date

These indexes are required because Firestore needs composite indexes for queries that:
1. Filter by one or more fields AND
2. Order by a different field

## Related Files

- `firestore.indexes.json` - Index definitions
- `firebase.json` - Firebase configuration
- `db-service.js` - Database service that uses these indexes
- `profile.js` - Profile page that displays statistics

## Cost Implications

Firestore indexes have minimal cost implications:
- Storage cost is very small (typically < $0.01/month for most applications)
- Read/write operations cost the same whether or not indexes exist
- Indexes improve query performance, potentially reducing costs by making queries faster

## Further Reading

- [Firestore Index Overview](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Managing Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Index Limitations](https://firebase.google.com/docs/firestore/quotas#indexes)
