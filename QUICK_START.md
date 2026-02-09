# Quick Start Guide: GitHub Secrets Setup

**TL;DR** - You need to add 8 secrets to GitHub, then your CI/CD will work.

---

## 1️⃣ Get Firebase Credentials (5 minutes)

Go to [Firebase Console](https://console.firebase.google.com/project/simpletcf/settings/general):

**Project Settings:**
```
Project ID:           simpletcf                        → FIREBASE_PROJECTID
Web API Key:          AIza...                          → FIREBASE_API_KEY
Auth Domain:          simpletcf.firebaseapp.com        → FIREBASE_AUTHDOMAIN
Storage Bucket:       simpletcf.appspot.com            → FIREBASE_STORAGEBUCKET
Messaging Sender ID:  123456789                        → FIREBASE_MESSAGINGSENDERID
App ID:               1:123456789:web:abc...           → FIREBASE_APPID
Measurement ID:       G-XXXXXXX  (optional)            → FIREBASE_MEASUREMENTID
```

**Service Accounts:**
- Go to **Service Accounts** tab
- Click **Generate New Private Key**
- Copy entire JSON file → FIREFOX_SERVICE_ACCOUNT_SIMPLETCF

---

## 2️⃣ Add GitHub Secrets (3 minutes per secret)

Go to **GitHub** → [JohnBorges52/simpletcf2](https://github.com/JohnBorges52/simpletcf2) → **Settings** → **Secrets and variables** → **Actions**

### Add 8 Secrets:

```
Name: FIREBASE_API_KEY
Value: AIza... (from Firebase Console Settings)

Name: FIREBASE_AUTHDOMAIN  
Value: simpletcf.firebaseapp.com

Name: FIREBASE_PROJECTID
Value: simpletcf

Name: FIREBASE_STORAGEBUCKET
Value: simpletcf.appspot.com

Name: FIREBASE_MESSAGINGSENDERID
Value: [from Firebase Console]

Name: FIREBASE_APPID
Value: [from Firebase Console]

Name: FIREBASE_MEASUREMENTID
Value: [from Firebase Console] (or empty)

Name: FIREBASE_SERVICE_ACCOUNT_SIMPLETCF
Value: [Entire JSON from Service Account key]
```

---

## 3️⃣ Test It (2 minutes)

1. Make any small change to your code (e.g., add a comment)
2. Commit & push:
   ```bash
   git add .
   git commit -m "test workflow"
   git push origin main
   ```
3. Go to GitHub → **Actions** tab
4. Watch the workflow run
5. Should show: ✅ **Deploy to Firebase Hosting on merge**

---

## 4️⃣ Verify It Works (1 minute)

Visit: **https://simpletcf.web.app**

Open DevTools (F12 → Console) and look for:
- ✅ `✅ Firebase initialized + persistence set`
- ✅ `✅ Got Firebase Storage URL for: ...`
- ❌ Should NOT see any red errorss

---

## ⚠️ Common Mistakes

| Mistake | Fix |
|---------|-----|
| Secret name has uppercase | Use EXACT names from list above |
| Secret value is wrong | Copy directly from Firebase Console |
| Service Account JSON is cut off | Copy ENTIRE file including `}` at end |
| Workflow still shows "No jobs" | Clear browser cache, try again |
| firebase-config.js is empty | Secrets not set correctly, check step 2 |

---

## 📋 Checklist

- [ ] Got all 7 Firebase values from Google Firebase Console
- [ ] Got Service Account JSON from Firebase Console
- [ ] Added 8 secrets to GitHub repository
- [ ] Pushed a test commit
- [ ] GitHub Actions shows ✅ success
- [ ] firebase-config.js has actual values (not empty)
- [ ] App works at https://simpletcf.web.app
- [ ] Browser console shows ✅ Firebase initialized

---

## 🆘 If It Still Doesn't Work

1. **Check GitHub Actions Logs**:
   - Go to: Actions → Latest run → expand "Generate firebase config" step
   - Look for error messages

2. **Check Browser Console**:
   - Go to: https://simpletcf.web.app
   - Press F12 → Console
   - Look for ❌ errors about missing secrets

3. **Verify Each Secret**:
   - Go to: GitHub Settings → Secrets
   - Verify each secret exists and name is EXACTLY correct

4. **Re-run Workflow**:
   - Go to: Actions → Latest run → Re-run jobs
   - Watch the logs

5. **Ask for Help**:
   - Share screenshot of:
     - GitHub Actions error logs
     - Browser console errors
     - List of secrets in GitHub Settings

---

## 📚 More Info

- **Full setup guide**: See [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
- **Architecture details**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Complete review**: See [CODE_REVIEW_SUMMARY.md](CODE_REVIEW_SUMMARY.md)

---

## 🎯 What Happens After

Once secrets are set:
1. Every time you push to `main` branch
2. GitHub automatically stores your secrets as environment variables
3. Your CI builds your app
4. `firebase-config.js` is generated with your Firebase credentials
5. App is deployed to Firebase Hosting
6. Firebase Auth and Storage work! ✅

**You don't need to do anything else.** Just code and push! 🚀
