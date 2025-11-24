# SendGrid Setup Guide

## Step 1: Create SendGrid Account

1. Go to: https://signup.sendgrid.com/
2. Sign up for free account (100 emails/day forever)
3. Verify your email address

## Step 2: Create API Key

1. Once logged in, go to: **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Name it: "Vastgoed App"
4. Select permissions: **"Full Access"** (or "Mail Send" only)
5. Click **"Create & View"**
6. **IMPORTANT:** Copy the API key immediately (you won't see it again!)
   - It looks like: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 3: Verify Sender Identity (Required for first use)

1. Go to: **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in your details:
   - Email: `michaelvh89@hotmail.com` (or any email you control)
   - Name: Your name
   - Company: Partners & Vastgoed
   - Address: Your address
4. Check your email and click the verification link
5. Wait for approval (usually instant, sometimes a few minutes)

## Step 4: Configure Backend

Create or edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./database/vastgoed.db
NODE_ENV=development

# SendGrid Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-actual-api-key-here
SMTP_FROM=michaelvh89@hotmail.com
FRONTEND_URL=http://localhost:3000
```

**Important:**
- Replace `SG.your-actual-api-key-here` with your actual API key from Step 2
- Replace `michaelvh89@hotmail.com` in `SMTP_FROM` with the email you verified in Step 3
- The `SMTP_USER=apikey` must be literally the word "apikey" (not your email)

## Step 5: Restart Backend

```bash
cd /home/botsrhere/Desktop/vastgoed-app/backend
# Stop current server (Ctrl+C)
npm run dev
```

## Step 6: Test

1. Create a maintenance request
2. Check console for: `✅ Email notification sent to {email}`
3. Check recipient's inbox (may take a few seconds)

## Troubleshooting

- **"Authentication failed"**: Check API key is correct (starts with `SG.`)
- **"Sender not verified"**: Complete Step 3 (verify sender)
- **Emails in spam**: Ask recipients to mark as "Not Spam"
- **"Invalid login"**: Make sure `SMTP_USER=apikey` (literally the word "apikey")

## Benefits

✅ No password needed - just API key
✅ Free: 100 emails/day
✅ Professional delivery
✅ Better inbox placement
✅ Analytics available in SendGrid dashboard

