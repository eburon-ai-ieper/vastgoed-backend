# Email Setup Guide for Real Delivery

## Quick Setup for Gmail

1. **Enable 2-Factor Authentication** on your Gmail account
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it: "Vastgoed App"
   - Copy the 16-character password

3. **Create/Edit `backend/.env` file:**

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./database/vastgoed.db
NODE_ENV=development

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
FRONTEND_URL=http://localhost:3000
```

4. **Replace:**
   - `your-email@gmail.com` with your Gmail address
   - `your-16-character-app-password` with the app password from step 2

5. **Restart the backend server**

## Alternative: Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@hotmail.com
SMTP_PASS=your-password
FRONTEND_URL=http://localhost:3000
```

## Alternative: Custom SMTP Server

```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
FRONTEND_URL=http://localhost:3000
```

## Testing

After setup, create a maintenance request and check:
1. Console logs should show: `✅ Email notification sent to {email}`
2. Check the recipient's inbox (and spam folder)
3. Email should have professional formatting with link to view request

## Troubleshooting

- **"Invalid login"**: Check your app password is correct (Gmail) or password is correct (other)
- **"Connection timeout"**: Check SMTP_HOST and SMTP_PORT are correct
- **Emails in spam**: Ask recipients to mark as "Not Spam"
- **No emails sent**: Check console logs for error messages

