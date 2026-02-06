# Deploy Updated Firestore Rules to Google Cloud

This guide explains how to deploy the updated Firestore security rules to Google Cloud after the recent fix in PR #6.

## What Changed in the Recent Fix?

PR #6 added security rules for user data subcollections to fix permission errors. The updated `firestore.rules` file now includes:

```javascript
match /users/{userId} {
  // ... existing rules ...
  
  // NEW: User data subcollection rules
  match /data/{document} {
    allow read, create, update: if isOwner(userId);
    allow delete: if false;
  }
}
```

This allows authenticated users to access their tracking, listening, and events data stored in `/users/{userId}/data/{document}`.

## Prerequisites

Before deploying, ensure you have:

1. **Firebase CLI installed**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase project configured**
   - Your Firebase project should be set up in `.firebaserc`
   - Current project: Check with `firebase use`

3. **Authentication**
   ```bash
   firebase login
   ```

## Step 1: Verify Your Current Rules

Before deploying, check what's currently in your Firestore:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build** → **Firestore Database** → **Rules**
4. Review the current rules (these will be replaced)

## Step 2: Deploy the Updated Rules

From the root directory of your project, run:

```bash
firebase deploy --only firestore:rules
```

### Expected Output

```
=== Deploying to 'your-project-id'...

i  deploying firestore
i  firestore: checking firestore.rules for compilation errors...
✔  firestore: rules file firestore.rules compiled successfully
i  firestore: uploading rules firestore.rules...
✔  firestore: released rules firestore.rules to cloud.firestore

✔  Deploy complete!
```

## Step 3: Verify Deployment

### Via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Build** → **Firestore Database** → **Rules**
3. Verify the rules now include the `match /data/{document}` section
4. Check the timestamp shows recent deployment

### Via Firebase CLI

```bash
firebase firestore:rules:get
```

This will display the currently active rules in your project.

## Step 4: Test the Updated Rules

After deployment, test that the rules work correctly:

### Test 1: Authenticated User Can Access Their Data

1. Open your application and log in
2. Navigate to Reading or Listening practice
3. Answer some questions
4. Check browser console for errors - there should be none
5. Verify data is saved by refreshing the page

### Test 2: Security Rules Are Enforced

Try accessing data from the Firestore Console:

1. Go to **Firestore Database** → **Data**
2. Navigate to a user's data subcollection
3. The console should allow access (you're an admin)
4. The application should only allow users to access their own data

## Troubleshooting

### Error: "Permission denied"

**Cause:** Rules haven't been deployed yet or deployment failed.

**Solution:**
1. Re-run the deployment command
2. Check for syntax errors in `firestore.rules`
3. Verify you're deploying to the correct project

### Error: "Firebase CLI not found"

**Cause:** Firebase CLI is not installed or not in PATH.

**Solution:**
```bash
npm install -g firebase-tools
firebase login
```

### Error: "No project active"

**Cause:** Firebase project is not selected.

**Solution:**
```bash
# List available projects
firebase projects:list

# Select your project
firebase use your-project-id
```

### Error: "Compilation error in firestore.rules"

**Cause:** Syntax error in the rules file.

**Solution:**
1. Check the error message for line numbers
2. Verify the syntax matches the example in this guide
3. Test rules syntax in Firebase Console Rules Playground

## Alternative: Deploy via Firebase Console

If you prefer using the web interface:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build** → **Firestore Database** → **Rules**
4. Click **Edit rules**
5. Copy the contents of `firestore.rules` from your repository
6. Paste into the editor
7. Click **Publish**

**Note:** This method is less reliable for version control. Always deploy from the repository file.

## Deployment in CI/CD

If you have automated deployments (GitHub Actions, Cloud Build):

### GitHub Actions

The deployment should happen automatically when changes are merged to main. Check:

1. `.github/workflows/deploy.yml` or similar workflow file
2. Ensure `FIREBASE_TOKEN` secret is configured
3. Workflow should include:
   ```yaml
   - name: Deploy Firestore Rules
     run: firebase deploy --only firestore:rules
   ```

### Cloud Build

Check `cloudbuild.yaml` for the deployment step:

```yaml
- name: 'gcr.io/cloud-builders/npm'
  args: ['run', 'deploy']
```

## Best Practices

1. **Always test locally first** using Firebase Emulator:
   ```bash
   firebase emulators:start --only firestore
   ```

2. **Review rules before deployment** to ensure they're not too permissive

3. **Keep rules in version control** (already done in this repo)

4. **Monitor after deployment** - check Firebase Console for any permission errors

5. **Set up alerts** for unusual access patterns or quota issues

## Next Steps

After successful deployment:

- ✅ Test the application thoroughly
- ✅ Monitor Firestore usage in Firebase Console
- ✅ Check that users can save and retrieve their data
- ✅ Verify no permission errors in browser console

## Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md) - Initial Firestore setup guide
- [FIRESTORE_DEPLOYMENT.md](FIRESTORE_DEPLOYMENT.md) - General deployment guide

## Need Help?

If you encounter issues:

1. Check the [Firebase Status Dashboard](https://status.firebase.google.com/)
2. Review error messages in Firebase Console
3. Check browser console for client-side errors
4. Verify your Firebase project billing is active
5. Consult the [Firebase community](https://firebase.google.com/community)

---

**Important:** After deploying the rules, users may need to refresh their browser to clear any cached permission denials.
