# Complete Secure Setup: No Credentials in GitHub

## Architecture

Your app now uses **Option 4: Firebase Remote Config** to store configuration outside GitHub:

```
┌─────────────────────────────────┐
│  Firebase Console               │
│  - Remote Config (public data)  │
│  - Security Rules               │
│  - Auth & Storage settings      │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Your App (Browser)                  │
│  1. Load firebase-config.js (empty)  │
│  2. Init Firebase                    │
│  3. Fetch Remote Config              │
│  4. Use config throughout app        │
└──────────────────────────────────────┘
```

**Key Point:** No credentials in code. All stored securely in Firebase!

---

## For Local Development

### 1. Create `.env.local` (NOT in git)
```bash
# Copy from .env.example
cp .env.example .env.local

# Edit .env.local with YOUR credentials:
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTHDOMAIN=simpletcf.firebaseapp.com
FIREBASE_PROJECTID=simpletcf
FIREBASE_STORAGEBUCKET=simpletcf.firebasestorage.app
FIREBASE_MESSAGINGSENDERID=233851428734
FIREBASE_APPID=1:233851428734:web:a1bd5148731c8845825d2f
FIREBASE_MEASUREMENTID=G-K63ZE5JTL9
```

### 2. Generate firebase-config.js Locally
```bash
# Install dependencies
npm install

# Generate config from .env.local
npm run generate-config

# Now firebase-config.js has your real credentials locally
# Never push this to GitHub!
```

### 3. Set Additional Config in Firebase Remote Config
1. Go to [Firebase Console → Remote Config](https://console.firebase.google.com/project/simpletcf/config)
2. Add values like:
   - `AUDIO_STORAGE_PATH: "audio"`
   - `ENABLE_FEATURE_X: true`
   - `API_ENDPOINT: "https://api.example.com"`

### 4. Use in Your Code
```javascript
// Get values from Remote Config
const audioPath = window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio');
const enableFeature = window.getRemoteConfigBoolean('ENABLE_FEATURE_X', false);

// Use throughout your app
console.log('Audio stored in:', audioPath);
if (enableFeature) {
  // Do something
}
```

---

## For Production (GitHub Actions)

### 1. GitHub Secrets
Keep secrets in GitHub Settings (encrypted):
```
FIREBASE_API_KEY
FIREBASE_AUTHDOMAIN
FIREBASE_PROJECTID
FIREBASE_STORAGEBUCKET
FIREBASE_MESSAGINGSENDERID
FIREBASE_APPID
FIREBASE_MEASUREMENTID
FIREBASE_SERVICE_ACCOUNT_SIMPLETCF
```

### 2. GitHub Actions Workflow
```yaml
# .github/workflows/firebase-hosting-merge.yml
- name: Generate firebase config
  run: node scripts/generate-firebase-config.js
  env:
    FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
    # ... other secrets ...
```

### 3. Set Remote Config Values
Same as local dev — add values in [Firebase Console → Remote Config](https://console.firebase.google.com/project/simpletcf/config)

---

## Security Checklist

- [x] `firebase-config.js` is in `.gitignore`
- [x] `.env.local` is in `.gitignore`
- [x] No credentials in code
- [x] `firebase-config.js` only generated, never committed
- [x] Remote Config stores non-sensitive configuration
- [x] Firebase Rules restrict access

---

## File Summary

| File | Committed? | Contains | Purpose |
|------|-----------|----------|---------|
| `.env.example` | ✅ Yes | Placeholder values | Template for local setup |
| `.env.local` | ❌ No (.gitignore) | Real credentials | Local development only |
| `firebase-config.js` | ❌ No (.gitignore) | Generated, real creds | Runtime Firebase init |
| `config.js` | ✅ Yes | Code only | Loads config, no secrets |
| `REMOTE_CONFIG_SETUP.md` | ✅ Yes | Docs | How to use Remote Config |

---

## Complete Data Flow

### Local Development
```
1. You: Edit .env.local (never pushed)
2. You: npm run generate-config
3. firebase-config.js: Generated with credentials (locally only)
4. Browser: Loads firebase-config.js
5. Browser: Initializes Firebase + Remote Config
6. Browser: Uses config throughout app
7. You: Push code (only code, no credentials)
```

### Production
```
1. You: Push code to GitHub
2. GitHub Actions: Reads secrets from GitHub (encrypted)
3. GitHub Actions: Runs generate-firebase-config.js
4. GitHub Actions: firebase-config.js generated (at build time)
5. GitHub Actions: Deploy to Firebase with generated file
6. Browser: Loads deployed firebase-config.js
7. Browser: Initializes Firebase + Remote Config
8. Browser: Uses config throughout app
9. firebase-config.js: Never stored in git ✅
```

---

## Step-By-Step Setup Guide

### Quick Start (5 minutes)

1. **Create `.env.local`**
   ```bash
   cp .env.example .env.local
   # Edit with your Firebase credentials
   ```

2. **Generate config**
   ```bash
   npm install
   npm run generate-config
   ```

3. **Set Remote Config values**
   - Go to [Firebase Console → Remote Config](https://console.firebase.google.com/project/simpletcf/config)
   - Add any configuration values you need
   - Click Publish

4. **Test locally**
   - Start your app
   - Open DevTools: F12 → Console
   - Should see: `✅ Remote Config loaded`
   - Test: `window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio')`

5. **Push code**
   ```bash
   git add .
   git commit -m "Add Remote Config support"
   git push origin main
   # Don't add .env.local or firebase-config.js — they're in .gitignore!
   ```

### Production Setup (after GitHub Actions runs)

1. **GitHub Actions automatically:**
   - Reads secrets from GitHub
   - Generates `firebase-config.js`
   - Deploys to Firebase

2. **You set Remote Config values in Firebase Console:**
   - Same as local dev
   - Values apply everywhere

---

## Using Remote Config in Your Pages

### In listening.js
```javascript
// Get config value
const audioPath = window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio');

// Use it
const fullPath = `${audioPath}/lesson1.mp3`;
const audioUrl = await window.getFirebaseStorageUrl(fullPath);
```

### In any other file
```javascript
// All helpers are global
window.getRemoteConfigString(key, defaultValue)
window.getRemoteConfigNumber(key, defaultValue)
window.getRemoteConfigBoolean(key, defaultValue)
```

---

## Updating Configuration

### To change a value:
1. Go to [Firebase Console → Remote Config](https://console.firebase.google.com/project/simpletcf/config)
2. Edit the value
3. Click **Publish**
4. Users will see the new value within 1 hour (or immediately if they force-refresh)

**No code changes needed!** 🎉

---

## Troubleshooting

### Q: I see "Firebase Storage not initialized"
**A:** 
- Make sure you ran: `npm run generate-config`
- Check `.env.local` has correct credentials
- Verify `firebase-config.js` has real values (not empty)

### Q: Remote Config not loading
**A:**
- Check Firebase Console → Remote Config
- Make sure you published any changes
- Check browser console: F12 → Console
- Verify `window.__remoteConfig` exists

### Q: firebase-config.js is empty
**A:**
- `.env.local` might have wrong credentials
- Run: `npm run generate-config` again
- Check the console output for errors

### Q: How do I update config in production?
**A:**
- Go to Firebase Console → Remote Config
- Edit values
- Click Publish
- Users see the change within 1 hour

---

## FAQs

**Q: Is my configuration file safe to push to GitHub?**
A: No! `.env.local` and `firebase-config.js` are in `.gitignore`. They're never pushed. ✅

**Q: Can I push `firebase-config.js`?**
A: No! It's in `.gitignore`. GitHub Actions generates it automatically. ✅

**Q: Do I need to commit `.env.local`?**
A: No! Keep it local only (it's in `.gitignore`). Each person uses their own. ✅

**Q: How do team members set up locally?**
A: 
1. They clone your repo
2. They copy `.env.example` to `.env.local`
3. They add their Firebase credentials to `.env.local`
4. They run: `npm run generate-config`
5. They never commit `.env.local` ✅

**Q: What if Remote Config is down?**
A: The app still works! It uses default values from the helper functions.

**Q: Can Remote Config values include credentials?**
A: Yes, but it's not recommended. Keep only non-sensitive config there.

---

## See Also

- [REMOTE_CONFIG_SETUP.md](REMOTE_CONFIG_SETUP.md) - Detailed Remote Config guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design overview
- [Firebase Remote Config Docs](https://firebase.google.com/docs/remote-config)

---

## Summary

✅ **You have a production-grade, secure setup:**
- Credentials NEVER in GitHub
- Configuration stored in Firebase Remote Config
- Easy to change without redeploying
- Works offline with default values
- Team-friendly (each person has their own `.env.local`)

**Ready to use!** 🚀
