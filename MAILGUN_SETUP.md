# Mailgun Setup Guide

## Step 1: Create Mailgun Account

1. Go to: https://signup.mailgun.com/
2. Sign up for free account
   - Free tier: 5,000 emails/month for first 3 months
   - Then: 1,000 emails/month free forever
3. Verify your email address

## Step 2: Add Domain or Use Sandbox

**Option A: Use Sandbox Domain (Quick - for testing)**
- Mailgun provides a sandbox domain: `sandbox12345.mailgun.org`
- Limited: Can only send to authorized recipients
- Good for: Testing and demos

**Option B: Add Your Own Domain (Recommended for production)**
- Add your domain in Mailgun dashboard
- Requires DNS configuration (they provide instructions)
- Can send to anyone

## Step 3: Get SMTP Credentials

1. Go to: **Sending** → **Domain Settings** (or Sandbox)
2. Click on your domain/sandbox
3. Go to **"SMTP credentials"** tab
4. You'll see:
   - **SMTP hostname**: `smtp.mailgun.org`
   - **Port**: `587`
   - **Username**: `postmaster@your-domain.mailgun.org`
   - **Password**: Click "Reset password" to generate one

## Step 4: Authorize Recipients (Sandbox Only)

If using sandbox domain:
1. Go to: **Sending** → **Authorized Recipients**
2. Add email addresses you want to send to
3. Check emails and verify them

## Step 5: Configure Backend

Create or edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./database/vastgoed.db
NODE_ENV=development

# Mailgun Email Configuration
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=noreply@your-domain.mailgun.org
FRONTEND_URL=http://localhost:3000
```

**Replace:**
- `your-domain.mailgun.org` with your actual Mailgun domain
- `your-mailgun-smtp-password` with the password from Step 3
- `SMTP_FROM` can be any email using your Mailgun domain

## Step 6: Restart Backend

```bash
cd /home/botsrhere/Desktop/vastgoed-app/backend
# Stop current server (Ctrl+C)
npm run dev
```

## Step 7: Test

1. Create a maintenance request
2. Check console for: `✅ Email notification sent to {email}`
3. Check recipient's inbox

## Troubleshooting

- **"Authentication failed"**: Check SMTP_USER and SMTP_PASS are correct
- **"Sandbox domain"**: Make sure recipient is authorized (Step 4)
- **"Domain not verified"**: Complete domain verification if using custom domain
- **Emails in spam**: Ask recipients to mark as "Not Spam"

## Benefits

✅ No password needed - uses SMTP credentials (API-like)
✅ Free: 5,000 emails/month (then 1,000/month)
✅ Reliable delivery
✅ Good for demos and production
✅ Easy setup

