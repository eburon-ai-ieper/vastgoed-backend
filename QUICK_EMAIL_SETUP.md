# Quick Email Setup for Showcase

## Step 1: Choose Your Email Provider

### Option A: Gmail (Recommended)
1. Go to: https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to: https://myaccount.google.com/apppasswords
4. Create app password:
   - Select "Mail"
   - Select "Other (Custom name)"
   - Name: "Vastgoed App"
   - Copy the 16-character password

### Option B: Outlook/Hotmail
- Use your regular email and password
- SMTP settings are already configured

## Step 2: Edit `backend/.env`

Open `backend/.env` and update:

```env
SMTP_HOST=smtp.gmail.com          # or smtp-mail.outlook.com for Hotmail
SMTP_PORT=587
SMTP_USER=michaelvh89@hotmail.com  # Your email
SMTP_PASS=your-password-here       # App password for Gmail, regular password for Hotmail
FRONTEND_URL=http://localhost:3000
```

## Step 3: Restart Backend

```bash
cd backend
# Stop current server (Ctrl+C)
npm run dev
```

## Step 4: Test

1. Create a maintenance request as a renter
2. Check console for: `✅ Email notification sent to {email}`
3. Check the recipient's inbox (and spam folder)

## What Emails Will Be Sent

- ✅ New maintenance request created → Owner notified
- ✅ Contractor auto-selected → Contractor notified  
- ✅ Appointment auto-scheduled → Contractor & Renter notified
- ✅ All workflow updates → Relevant parties notified

All emails include:
- Professional formatting
- Clear subject line
- Link to view request in system
- Branded header

