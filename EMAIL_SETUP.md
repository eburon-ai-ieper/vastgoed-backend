# Email Notification Setup

## Demo Mode (Current)

All email notifications are currently configured to send to **michaelvh89@hotmail.com** for demo/showcase purposes.

The system will:
- Send all emails to the demo address
- Include the actual recipient's name and email in the subject/body
- Work even without SMTP configuration (will log to console)

## To Enable Real Email Sending

1. Configure SMTP in `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
```

2. For Gmail:
   - Enable 2-factor authentication
   - Generate an "App Password" (not your regular password)
   - Use the app password in `SMTP_PASS`

3. The system will then send real emails to actual recipients (not just demo address)

## Current Behavior

- ✅ All emails go to: **michaelvh89@hotmail.com**
- ✅ Actual recipient info is included in the email
- ✅ Works without SMTP (logs to console)
- ✅ If SMTP is configured, emails are actually sent

