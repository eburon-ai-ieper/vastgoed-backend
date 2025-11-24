# Mailgun Quick Setup for Your Sandbox

## Your Sandbox Domain
`sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org`

## Step 1: Authorize Your Email (REQUIRED for Sandbox)

1. Go to Mailgun dashboard
2. Navigate to: **Sending** → **Authorized Recipients**
3. Click **"Add Recipient"**
4. Add: `michaelvh89@hotmail.com`
5. Check your email and click the verification link
6. Also add any other demo emails you want to test with:
   - `broker@partners-vastgoed.com`
   - `jeanpierre.callant@example.com`
   - `mvh@allroundworks.com`

## Step 2: Get SMTP Credentials

1. Go to: **Sending** → **Domain Settings**
2. Click on your sandbox domain: `sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org`
3. Go to **"SMTP credentials"** tab
4. You'll see:
   - **SMTP hostname**: `smtp.mailgun.org`
   - **Port**: `587`
   - **Username**: `postmaster@sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org`
   - **Password**: Click "Reset password" or copy existing one

## Step 3: Create backend/.env

```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./database/vastgoed.db
NODE_ENV=development

# Mailgun Email Configuration
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org
SMTP_PASS=your-mailgun-smtp-password-here
SMTP_FROM=noreply@sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org
FRONTEND_URL=http://localhost:3000
```

**Important:** Replace `your-mailgun-smtp-password-here` with the actual password from Step 2.

## Step 4: Restart Backend

```bash
cd /home/botsrhere/Desktop/vastgoed-app/backend
npm run dev
```

## Step 5: Test

1. Create a maintenance request as a renter
2. Check console for: `✅ Email notification sent to {email}`
3. Check `michaelvh89@hotmail.com` inbox (and spam folder)

## Important Notes

⚠️ **Sandbox Limitation**: You can ONLY send to authorized recipients
- Make sure to authorize all demo account emails
- Production: Add your own domain to send to anyone

✅ **From Address**: Must use your sandbox domain
- `noreply@sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org`
- Or any email ending with `@sandbox314b101bed684fc59f0fb7d76bdbb9de.mailgun.org`

