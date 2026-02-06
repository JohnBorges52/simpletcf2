# Firebase Remote Config Setup Guide

## What is Remote Config?

Firebase Remote Config lets you store configuration values securely in Firebase Console without pushing them to GitHub. Your app fetches these values at startup.

**Benefits:**
- ✅ No credentials in your repository
- ✅ Change configuration without redeploying
- ✅ Feature flags, API endpoints, storage paths
- ✅ Different config per environment (dev/prod)

---

## How It Works

```
1. You set values in Firebase Console (Remote Config)
2. User opens your app
3. App initializes Firebase
4. App fetches Remote Config values
5. App uses those values throughout the session

No Git commits needed! 🎉
```

---

## Step 1: Set Up Remote Config in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/simpletcf)
2. In left menu: **Build** → **Remote Config**
3. Click **Create Config**

---

## Step 2: Add Configuration Values

You can store any key-value pairs. Examples:

### Basic Configuration

| Key | Type | Value | Description |
|-----|------|-------|-------------|
| `AUDIO_STORAGE_PATH` | String | `audio` | Path to stored audio files |
| `DATA_STORAGE_PATH` | String | `data` | Path to stored data files |
| `ENABLE_ANALYTICS` | Boolean | `true` | Whether to enable analytics |
| `API_ENDPOINT` | String | `https://api.example.com` | API endpoint |
| `MAX_FILE_SIZE_MB` | Number | `10` | Max file size in MB |

### To Add a Value in Firebase Console:

1. In Remote Config page, click **Add parameter**
2. **Parameter name**: `AUDIO_STORAGE_PATH`
3. **Parameter type**: String
4. **Default value**: `audio`
5. Click **Save**

Repeat for each value you want to store.

---

## Step 3: Use Values in Your Code

Your app has three helper functions ready to use:

### Get a String Value
```javascript
const audioPath = window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio');
console.log('Audio path:', audioPath);
```

### Get a Number Value
```javascript
const maxSize = window.getRemoteConfigNumber('MAX_FILE_SIZE_MB', 10);
console.log('Max file size:', maxSize, 'MB');
```

### Get a Boolean Value
```javascript
const analyticsEnabled = window.getRemoteConfigBoolean('ENABLE_ANALYTICS', true);
console.log('Analytics enabled:', analyticsEnabled);
```

---

## Step 4: Use in listening.js (Example)

If you want to use custom audio paths from Remote Config:

```javascript
// In listening.js, when you need the audio path:
const audioStoragePath = window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio');

// Use it with your storage helper:
const fullPath = `${audioStoragePath}/lesson1.mp3`;
const audioUrl = await window.getFirebaseStorageUrl(fullPath);
```

---

## What to Store in Remote Config

### ✅ Good for Remote Config:
- API endpoints
- Storage folder paths
- Feature flags (enable/disable features)
- Analytics settings
- Cache durations
- Custom URLs
- App version info

### ❌ NOT for Remote Config:
- Firebase API keys (use `firebase-config.js` from env vars)
- Database credentials
- Admin tokens
- Personal data

---

## Accessing from Anywhere in Your App

Once `window.__remoteConfig` is initialized, you can access it from any JavaScript file:

```javascript
// In any .js file (not just config.js):
const myValue = window.getRemoteConfigString('MY_KEY', 'default');
```

---

## A/B Testing with Remote Config

Firebase Remote Config also supports A/B testing! You can:
- Test different configurations with different users
- See which performs better
- Roll out winner to everyone

---

## Refresh Configuration During Session

By default, Remote Config refreshes every 1 hour. To force a refresh:

```javascript
const remoteConfig = window.__remoteConfig;
if (remoteConfig) {
  await fetchAndActivate(remoteConfig);
  console.log('✅ Config refreshed');
}
```

---

## Example: Complete Setup

**Firebase Console:**
```
Parameter: AUDIO_PATH
Value: audio

Parameter: ENABLE_FEATURE_X
Value: true
```

**Your Code (listening.js):**
```javascript
const audioPath = window.getRemoteConfigString('AUDIO_PATH');
const enableFeature = window.getRemoteConfigBoolean('ENABLE_FEATURE_X', false);

if (enableFeature) {
  console.log('Feature X is enabled!');
}

const fullPath = `${audioPath}/lesson1.mp3`;
const url = await window.getFirebaseStorageUrl(fullPath);
```

---

## Verify It's Working

1. Open your app in browser
2. Press F12 → Console
3. Should see: `✅ Remote Config loaded`
4. Test getting a value:
   ```javascript
   window.getRemoteConfigString('AUDIO_STORAGE_PATH', 'audio')
   ```

---

## Troubleshooting

### Remote Config returns empty/default values
- Check Firebase Console → Remote Config
- Verify parameters are published
- Wait a few seconds (might be cached)
- Hard refresh browser (Ctrl+Shift+R)

### "Remote Config not available (offline?)"
- You might be offline
- Remote Config is optional — app still works with defaults
- Check browser console for details

### How often does it update?
- Default: Every 1 hour
- Can be changed in code: `minimumFetchIntervalMillis`
- See `config.js` line ~336

---

## Environment-Specific Config

You can set different values for different environments:

**Firebase Console → Remote Config → Targeting:**
1. Create a condition: `User properties: environment = prod`
2. Set different values for that condition
3. Users are assigned via custom claims or properties

---

## Next Steps

1. ✅ Open Firebase Console → Remote Config
2. ✅ Add some test parameters
3. ✅ Reload your app
4. ✅ Test: `window.getRemoteConfigString('YOUR_KEY')`
5. ✅ Use in your code!

No more storing credentials in GitHub! 🎉
