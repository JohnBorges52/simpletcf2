# Answer History Visualization - User Guide

## Overview

The Answer History feature allows you to view all your quiz answers stored in the Firestore database directly on your profile page. This helps you track your progress, identify areas for improvement, and verify that your data is being saved correctly.

## How to Access

1. **Log in** to your account at [simpletcf.com](https://simpletcf.firebaseapp.com)
2. Click on **Profile** in the navigation menu
3. Navigate to the **"My Progress"** tab
4. Scroll down to see the **"Recent Answer History"** section

## What You'll See

The answer history table displays the following information:

| Column | Description |
|--------|-------------|
| **Date** | When you last answered this question |
| **Question** | Question identifier with section (Listening/Reading) |
| **Result** | Performance indicator based on your accuracy:<br>• "Mostly Correct" if you got it right more than wrong<br>• "Needs Practice" if you got it wrong more than right |
| **Correct** | Total number of times you answered correctly |
| **Wrong** | Total number of times you answered incorrectly |
| **Accuracy** | Percentage of correct answers, color-coded:<br>• 🟢 Green (>70%) - Excellent<br>• 🟠 Orange (50-70%) - Good<br>• 🔴 Red (<50%) - Needs improvement |

## Features

### Real-Time Data
- Data is fetched directly from Firestore database
- Always up-to-date with your latest quiz attempts
- No manual refresh needed

### Performance Tracking
- See which questions you consistently get right
- Identify questions that need more practice
- Track improvement over time

### Color-Coded Feedback
- Quickly spot areas of strength (green)
- Identify areas needing attention (orange/red)
- Visual cues make it easy to scan your performance

### Sorted by Recency
- Most recent answers appear first
- Easy to see your latest practice sessions
- Historical data is preserved

## Data Sources

The answer history combines data from:

1. **Reading Quiz** (`getTracking()`)
   - All reading comprehension questions
   - PDF-based questions
   - Text-based questions

2. **Listening Quiz** (`getTCFListening()`)
   - Audio practice questions
   - Listening comprehension
   - Real test attempts

## Limitations

- Currently displays up to **50 most recent answers**
- Shows aggregate data per question (not individual attempts)
- Requires authentication to view
- Data only available for authenticated users with Firestore storage

## Privacy & Security

✅ **Your data is secure:**
- Only you can view your answer history
- Firestore security rules prevent unauthorized access
- Data is tied to your authenticated user account
- No other users can access your information

## Troubleshooting

### "Loading answer history..." doesn't complete
- Check your internet connection
- Verify you're logged in
- Try refreshing the page
- Check browser console for errors

### "No answers recorded yet"
- You haven't answered any quiz questions yet
- Start practicing to see your history populate
- Make sure you're logged in when answering questions

### "Please log in to view your answer history"
- You need to be authenticated to access Firestore data
- Click "Sign In" and log in with your Google account
- Once logged in, your data will be migrated from localStorage

### "Error loading answer history"
- Network issue or Firestore temporarily unavailable
- Try refreshing the page
- If issue persists, contact support

## Tips for Using This Feature

1. **Regular Reviews**: Check your answer history weekly to track progress
2. **Focus on Red Items**: Prioritize questions with low accuracy (<50%)
3. **Pattern Recognition**: Look for patterns in mistakes across sections
4. **Goal Setting**: Aim to move orange items to green
5. **Celebrate Wins**: Acknowledge your high-accuracy questions!

## Future Enhancements

Potential future additions:
- Filter by date range
- Filter by section (Listening/Reading only)
- Export data to CSV
- Pagination for more than 50 answers
- Individual attempt history (not just aggregated)
- Performance charts and trends
- Comparison with other users (anonymized)

## Related Features

- **Overview Tab**: High-level statistics and KPIs
- **Real Tests Tab**: View your complete test results
- **My Progress Tab**: Accuracy charts and weight-based analysis

## Support

If you encounter issues or have suggestions:
- Check the [GitHub Issues](https://github.com/JohnBorges52/simpletcf2/issues)
- Contact support through the website
- Report bugs with browser console logs

## Technical Details

For developers:
- Data fetched from Firestore using `firestore-storage.js`
- Combines `tracking` and `listening` collections
- Client-side processing and sorting
- Responsive table design with CSS Grid
- ES6 modules for code organization

---

**Last Updated**: February 2026  
**Version**: 1.0.0
