# Google Apps Script Email Setup (5 minutes)

This is the **easiest** way to send emails from your website - completely free, no API keys in your code, uses your existing Gmail account!

## Step 1: Create the Script (2 minutes)

1. Go to [https://script.google.com](https://script.google.com)
2. Sign in with your **simpletcf@gmail.com** account
3. Click **"New Project"**
4. Delete any code in the editor
5. Copy and paste this entire code:

```javascript
function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Email details
    const recipient = "simpletcf@gmail.com"; // Your email
    const subject = "SimpleTCF Contact: " + data.topic;
    
    // Build email body
    const body = 
      "New contact form submission from SimpleTCF\n\n" +
      "Name: " + data.name + "\n" +
      "Email: " + data.email + "\n" +
      "Phone: " + data.phone + "\n" +
      "Topic: " + data.topic + "\n\n" +
      "Message:\n" + data.message + "\n\n" +
      "---\n" +
      "Sent from SimpleTCF contact form";
    
    // Send email
    MailApp.sendEmail(recipient, subject, body);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Email sent successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

6. Click the **disk icon** (💾) or **File → Save** to save
7. Name your project: **"SimpleTCF Contact Form"**

## Step 2: Deploy as Web App (2 minutes)

1. Click **Deploy** → **New deployment**
2. Click the **gear icon** ⚙️ next to "Select type"
3. Choose **"Web app"**
4. Fill in these settings:
   - **Description:** SimpleTCF Contact Form
   - **Execute as:** Me
   - **Who has access:** **Anyone** ← IMPORTANT!
5. Click **Deploy**
6. Click **Authorize access**
7. Choose your simpletcf@gmail.com account
8. Click **Advanced** → **Go to SimpleTCF Contact Form (unsafe)** ← This is safe, it's your own script
9. Click **Allow**
10. **Copy the Web app URL** - it looks like:
    ```
    https://script.google.com/macros/s/AKfycby.../exec
    ```

## Step 3: Update Your Website (1 minute)

1. Open `public/script.js`
2. Find line ~403 that says:
   ```javascript
   const SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';
   ```
3. Replace it with your actual URL:
   ```javascript
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
   ```
4. Save the file

## ✅ Done! Test It

1. Deploy your website
2. Go to the contact form
3. Fill it out and submit
4. Check **simpletcf@gmail.com** inbox - you should receive the email!

## Benefits

✅ **No API keys exposed** - just a webhook URL (safe to publish)  
✅ **Completely free** - unlimited emails  
✅ **Uses your Gmail** - arrives directly at simpletcf@gmail.com  
✅ **Super simple** - 5 minutes total setup  
✅ **No third-party services** - all Google  

## Troubleshooting

**Emails not arriving?**
- Check your Gmail spam folder
- Make sure you set "Who has access" to **Anyone**
- Try re-deploying (Deploy → Manage deployments → Edit → New version)

**Authorization errors?**
- Make sure you authorized the script with simpletcf@gmail.com
- The script needs permission to send emails on your behalf

**CORS errors in browser?**
- This is normal with no-cors mode
- The email still sends successfully
- The code assumes success if no error is thrown

## Need to Change Something?

If you need to edit the script:
1. Go to [https://script.google.com](https://script.google.com)
2. Open your project
3. Make changes
4. **Deploy → Manage deployments → Edit → Version: New version → Deploy**
5. The URL stays the same, no need to update your website code
