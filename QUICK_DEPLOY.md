# Quick Deploy Guide - Updated Firestore Rules

## After Recent Fix (PR #6)

The Firestore security rules were updated to fix permission errors. Deploy them now:

```bash
# 1. Make sure you're logged in
firebase login

# 2. Verify you're on the correct project
firebase use

# 3. Deploy the updated rules
firebase deploy --only firestore:rules
```

## Expected Output

```
✔ firestore: released rules firestore.rules to cloud.firestore
✔ Deploy complete!
```

## Verify It Worked

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Go to **Firestore Database** → **Rules**
3. Check that you see the `match /data/{document}` section
4. Timestamp should show recent deployment

## What Got Fixed?

The rules now allow users to access their data in:
- `/users/{userId}/data/tracking`
- `/users/{userId}/data/listening`
- `/users/{userId}/data/events`

## Need More Help?

See the complete guide: [DEPLOY_FIRESTORE_RULES.md](DEPLOY_FIRESTORE_RULES.md)

## Troubleshooting

**Error: "Firebase CLI not found"**
```bash
npm install -g firebase-tools
```

**Error: "No project active"**
```bash
firebase projects:list
firebase use your-project-id
```

**Error: "Permission denied"**
- Make sure you have owner/editor access to the Firebase project
- Try logging in again: `firebase login --reauth`
