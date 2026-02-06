# Firestore Setup Guide

This guide will help you set up Firestore Database for the SimpleTCF2 application.

## Prerequisites

- Firebase project created and configured
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase Authentication already set up
- Access to Firebase Console

## Step 1: Enable Firestore

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (simpletcf)
3. Navigate to **Build** → **Firestore Database**
4. Click **Create database**
5. Choose **Start in production mode** (we have security rules configured)
6. Select your preferred region (choose one closest to your users)
7. Click **Enable**

## Step 2: Deploy Security Rules

Deploy the Firestore security rules from the repository:

```bash
# Login to Firebase (if not already logged in)
firebase login

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

The rules are defined in `firestore.rules` and will:
- Allow users to read/write only their own data
- Validate data structure and types
- Prevent modification of logged responses

## Step 3: Create Firestore Indexes

The application will create indexes automatically when you first use the features. However, you can also create them manually:

### Option A: Automatic (Recommended)

1. Use the application normally (register, answer questions)
2. Check the browser console for Firestore index creation links
3. Click the link to create the index in Firebase Console
4. Wait for index to be created (usually takes a few minutes)

### Option B: Manual

Go to Firebase Console → Firestore Database → Indexes and create:

**Index 1: User Responses by Date**
- Collection: `questionResponses`
- Fields to index:
  - `userId` - Ascending
  - `answeredAt` - Descending
- Query scope: Collection

**Index 2: Responses by Type**
- Collection: `questionResponses`
- Fields to index:
  - `userId` - Ascending
  - `questionType` - Ascending
  - `answeredAt` - Descending
- Query scope: Collection

**Index 3: Responses by Weight**
- Collection: `questionResponses`
- Fields to index:
  - `userId` - Ascending
  - `weight` - Ascending
  - `answeredAt` - Descending
- Query scope: Collection

## Step 4: Test the Implementation

### Test User Creation

1. Open your application
2. Register a new user account
3. Verify email and log in
4. Go to Firebase Console → Firestore Database → Data
5. Check that a document was created in the `users` collection

### Test Question Response Logging

1. Log in to your application
2. Navigate to Reading or Listening practice
3. Select a weight/difficulty level
4. Answer a few questions
5. Go to Firebase Console → Firestore Database → Data
6. Check the `questionResponses` collection for new documents

### Test Profile Statistics

1. After answering some questions, navigate to the Profile page
2. Check that the statistics are displayed:
   - Questions answered
   - Accuracy percentage
3. The statistics should match the responses logged in Firestore

## Step 5: Monitor and Optimize

### Set Up Monitoring

1. Go to Firebase Console → Firestore Database → Usage
2. Monitor:
   - Document reads/writes
   - Storage usage
   - Network egress

### Set Up Alerts

1. Go to Google Cloud Console → Billing
2. Set up budget alerts for Firestore usage
3. Recommended: Set alert at 50%, 90%, and 100% of your budget

### Optimize Queries

- Use indexes for all queries (automatic in our implementation)
- Limit query results when possible (we use `limit()` in statistics)
- Cache frequently accessed data on the client side
- Use server timestamps instead of client timestamps

## Firestore Pricing Considerations

Firestore has a free tier and then charges for:
- **Reads:** $0.06 per 100,000 documents
- **Writes:** $0.18 per 100,000 documents
- **Deletes:** $0.02 per 100,000 documents
- **Storage:** $0.18 per GB per month

### Cost Optimization Tips

1. **Batch operations** - Group multiple writes when possible
2. **Use caching** - Cache statistics data for a reasonable time
3. **Limit queries** - Don't fetch all data, use pagination
4. **Monitor usage** - Set up alerts for unusual spikes
5. **Clean up test data** - Remove old test documents

## Troubleshooting

### Problem: "Missing or insufficient permissions"

**Solution:** 
- Verify that Firestore security rules are deployed
- Check that the user is authenticated
- Verify the user is accessing their own data

### Problem: "Index not found" error

**Solution:**
- Click the provided link to create the index
- Wait a few minutes for the index to build
- Refresh the page and try again

### Problem: Statistics not showing in profile

**Solution:**
- Check browser console for errors
- Verify that questions have been answered
- Check that `db-service.js` is loaded
- Verify Firestore initialization completed successfully

### Problem: Responses not being logged

**Solution:**
- Check browser console for errors
- Verify user is authenticated
- Check that `window.dbService` is available
- Review Firestore security rules

## Development vs Production

### Development

For development, you might want to:
- Use Firestore Emulator for local testing
- Enable debug mode in security rules
- Use separate Firebase project

### Production

For production:
- Use production mode security rules
- Enable backups (requires Blaze plan)
- Set up monitoring and alerts
- Review and optimize indexes regularly

## Firestore Emulator (Optional)

To test locally without using production database:

```bash
# Install Firebase emulator
firebase init emulators

# Select Firestore emulator
# Start emulator
firebase emulators:start --only firestore

# In your code, connect to emulator (add to config.js):
if (location.hostname === "localhost") {
  connectFirestoreEmulator(db, "localhost", 8080);
}
```

## Data Backup

### Manual Backup

```bash
# Export all collections
gcloud firestore export gs://YOUR_BUCKET_NAME/backups/$(date +%Y%m%d)

# Import from backup
gcloud firestore import gs://YOUR_BUCKET_NAME/backups/BACKUP_DATE
```

### Automated Backup (Requires Blaze Plan)

1. Go to Firebase Console → Firestore Database → Import/Export
2. Set up scheduled exports
3. Choose destination Cloud Storage bucket
4. Set schedule (daily recommended)

## Next Steps

After completing setup:

1. ✅ Test all features thoroughly
2. ✅ Monitor usage for the first week
3. ✅ Optimize indexes based on actual queries
4. ✅ Set up backup strategy
5. ✅ Document any custom configurations

## Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Pricing Calculator](https://firebase.google.com/pricing)

## Support

For issues:
- Check [Firestore Documentation](https://firebase.google.com/docs/firestore)
- Review `FIRESTORE_DATABASE.md` for API details
- Check Firebase Console for error logs
- Ask on [Stack Overflow](https://stackoverflow.com/questions/tagged/google-cloud-firestore) with tag `google-cloud-firestore`

---

**Setup completed?** Test the application and verify all features work correctly!
