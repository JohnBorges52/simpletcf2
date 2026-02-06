# GitHub Secrets Setup Guide

This guide explains how to set up your GitHub repository secrets for Firebase deployment to work properly.

## Why This Matters

Your repository has **no hardcoded secrets** in the code (which is great!). Instead, secrets are:
1. **Stored securely** in GitHub as Environment Secrets
2. **Injected at build time** by the GitHub Actions workflow
3. **Used to generate** `firebase-config.js` dynamically (which is in `.gitignore`)

This means: **No secrets in git, no secrets in the final deployment file**.

---

## How It Works

```
┌─────────────────────┐
│  You push to main   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  GitHub Actions Workflow runs:          │
│  .github/workflows/firebase-hosting-    │
│  merge.yml                              │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Step 1: Checkout code                  │
│  Step 2: Run: node scripts/             │
│          generate-firebase-config.js    │
│          ├─ Reads secrets from env      │
│          └─ Creates public/firebase-    │
│             config.js                   │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Step 3: Deploy to Firebase Hosting     │
│  (firebase-config.js now exists)        │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  ✅ Live! App loads firebase-config.js  │
│     and Firebase works.                 │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### 1. Get Your Firebase Credentials

Go to **Firebase Console** → **Settings** (⚙️) → **Project Settings**:

```
Firebase Project ID (FIREBASE_PROJECTID):
  Example: simpletcf

Web API Key (FIREBASE_API_KEY):
  Example: AIza... (long string)

Auth Domain (FIREBASE_AUTHDOMAIN):
  Example: simpletcf.firebaseapp.com

Storage Bucket (FIREBASE_STORAGEBUCKET):
  Example: simpletcf.appspot.com

Messaging Sender ID (FIREBASE_MESSAGINGSENDERID):
  Example: 123456789

App ID (FIREBASE_APPID):
  Example: 1:123456789:web:abc...

Measurement ID (FIREBASE_MEASUREMENTID):
  Example: G-XXXXXXX
  (Optional, can be empty)
```

### 2. Add GitHub Repository Secrets

**Go to**: GitHub Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each secret individually:

| Secret Name | Value | Source |
|---|---|---|
| `FIREBASE_API_KEY` | Your API Key | Firebase Console |
| `FIREBASE_AUTHDOMAIN` | your-project.firebaseapp.com | Firebase Console |
| `FIREBASE_PROJECTID` | your-project-id | Firebase Console |
| `FIREBASE_STORAGEBUCKET` | your-project.appspot.com | Firebase Console |
| `FIREBASE_MESSAGINGSENDERID` | Your Sender ID | Firebase Console |
| `FIREBASE_APPID` | Your App ID | Firebase Console |
| `FIREBASE_MEASUREMENTID` | Your Measurement ID | Firebase Console (optional) |
| `FIREBASE_SERVICE_ACCOUNT_SIMPLETCF` | Your Service Account JSON | See below |

### 3. Add Service Account Secret

The `FIREBASE_SERVICE_ACCOUNT_SIMPLETCF` is special—it's a full JSON file.

**To get it**:
1. Go to **Firebase Console** → **Settings** ⚙️ → **Service Accounts**
2. Click **Generate New Private Key**
3. A JSON file downloads—**copy the entire contents** (it's a long JSON object)
4. In GitHub Settings → Secrets, create `FIREBASE_SERVICE_ACCOUNT_SIMPLETCF`
5. Paste the entire JSON content

The JSON will look like:
```json
{
  "type": "service_account",
  "project_id": "simpletcf",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  ...
}
```

### 4. Update Firebase Rules (Optional but Recommended)

Set up **Firestore/Storage Security Rules** to allow your app to read data:

**Firestore** (if you use it):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

**Storage** (for audio/files):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;  // Change to: request.auth != null  if you want to restrict
      allow write: if request.auth != null;
    }
  }
}
```

---

## Verify Your Setup

### ✅ Check 1: Workflow Runs Without Errors

1. Go to **GitHub Repo** → **Actions**
2. Look for your latest workflow run
3. Check if it shows **"No jobs were run"** (it shouldn't anymore)
4. Click the run and check the logs

### ✅ Check 2: firebase-config.js is Generated

1. After the workflow runs successfully, go to **GitHub Repo** → **Code**
2. Navigate to `public/firebase-config.js`
3. You should see something like:
   ```javascript
   window.firebaseConfig = {
     "apiKey": "AIza...",
     "authDomain": "simpletcf.firebaseapp.com",
     "projectId": "simpletcf",
     "storageBucket": "simpletcf.appspot.com",
     ...
   };
   ```
   
   **If it's empty or missing**: Check the workflow logs for errors

### ✅ Check 3: Deployment Succeeds

1. Check the GitHub Actions workflow output
2. Look for: `✅ Deploy to Firebase Hosting on merge`
3. It should show a success checkmark

### ✅ Check 4: App Works Live

1. Visit your Firebase Hosting URL: `https://simpletcf.web.app`
2. Open **Browser DevTools** (F12) → **Console**
3. Look for messages like:
   ```
   ✅ Got Firebase Storage URL for: ...
   ```
4. If you see Firebase errors, check that secrets were set correctly

---

## Troubleshooting

### Problem: "No jobs were run" in GitHub Actions

**Causes**:
- Workflow file is malformed (✅ Fixed in deploy.yml)
- Event trigger doesn't match (you pushed to `main`?)
- Secrets are missing

**Solution**: 
- Check that `deploy.yml` is valid YAML
- Verify you're pushing to `main` branch
- Check that secrets exist in GitHub repository settings

### Problem: firebase-config.js is empty

**Cause**: Secrets not provided at build time

**Solution**:
1. Check GitHub Actions logs for: `node scripts/generate-firebase-config.js`
2. Look for warnings: `Warning: some firebase env vars are empty`
3. Verify all 7 secrets are added in GitHub Settings

### Problem: Firebase Storage not working on live site

**Cause**: `storageBucket` is missing or wrong

**Solution**:
1. Check `firebase-config.js` on your live site
2. Verify `storageBucket` is correct (format: `project.appspot.com`)
3. Check **Firebase Storage Rules** allow reading files

### Problem: Authentication errors

**Cause**: Secrets values are wrong or from different Firebase project

**Solution**:
1. Delete all secrets and re-verify each value from Firebase Console
2. Ensure you're using secrets from the **correct** Firebase project
3. Redeploy after updating secrets

---

## Local Development

To test locally:

1. **Create `.env.local`** in your project root:
   ```
   FIREBASE_API_KEY=your_api_key
   FIREBASE_AUTHDOMAIN=your_auth_domain
   FIREBASE_PROJECTID=your_project_id
   FIREBASE_STORAGEBUCKET=your_storage_bucket
   FIREBASE_MESSAGINGSENDERID=your_sender_id
   FIREBASE_APPID=your_app_id
   FIREBASE_MEASUREMENTID=your_measurement_id
   ```

2. **Run the config generator**:
   ```bash
   npm run generate-config
   ```
   
   This creates `public/firebase-config.js` locally

3. **Start a local server**:
   ```bash
   npm install -g http-server
   http-server public/
   ```

4. **Check browser console** for Firebase messages

---

## Security Checklist

- ✅ No Firebase credentials in `.gitignore`ed files
- ✅ `firebase-config.js` is in `.gitignore`
- ✅ Secrets stored in GitHub (not in code)
- ✅ Service Account JSON is in GitHub secrets only
- ✅ Production secrets never in commit history

---

## Need Help?

- Check Firebase Console for project details
- Review GitHub Actions logs for specific errors
- Verify `.github/workflows/firebase-hosting-merge.yml` matches expected structure
- Ensure `scripts/generate-firebase-config.js` is executable

**If workflow still fails**: Check that `deploy.yml` only contains ONE workflow definition (should be fixed now).
