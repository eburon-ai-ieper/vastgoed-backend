# Mailgun Email Troubleshooting

## Issue: Emails Show as Sent But Not Received

### Step 1: Check Mailgun Delivery Logs

1. Go to Mailgun Dashboard
2. Navigate to: **Sending** → **Logs** (or **Activity**)
3. Look for the emails that were sent
4. Check the **Status** column:
   - ✅ **Delivered** = Email reached inbox (check spam folder)
   - ⚠️ **Failed** = Click to see error reason
   - 🔄 **Accepted** = Mailgun accepted it, but delivery pending

### Step 2: Verify Recipient is Authorized (CRITICAL for Sandbox)

**Sandbox domains can ONLY send to authorized recipients!**

1. Go to: **Sending** → **Authorized Recipients**
2. Check if `michaelvh89@hotmail.com` is listed
3. Check if it shows **"Verified"** (green checkmark)
4. If not there or not verified:
   - Click **"Add Recipient"**
   - Enter: `michaelvh89@hotmail.com`
   - Check your email and click verification link
   - Wait for status to show "Verified"

### Step 3: Check Spam Folder

- Hotmail/Outlook often filters emails from sandbox domains
- Check **Spam/Junk** folder
- If found, mark as "Not Spam"

### Step 4: Check Email Address in Database

The email must match exactly what's in the database. Check:
- Database email: Should be `michaelvh89@hotmail.com`
- Mailgun authorized: Must be exactly `michaelvh89@hotmail.com`

### Step 5: Check Mailgun Logs for Errors

In Mailgun dashboard → Logs, look for:
- **"Recipient address not authorized"** = Need to authorize recipient
- **"Domain not verified"** = Domain setup issue
- **"Delivery failed"** = Check error details

### Common Issues:

1. **Recipient not authorized** (most common with sandbox)
   - Solution: Authorize in Mailgun → Authorized Recipients

2. **Email in spam**
   - Solution: Check spam folder, mark as "Not Spam"

3. **Email address mismatch**
   - Solution: Verify database email matches authorized email exactly

4. **Delivery delay**
   - Solution: Wait a few minutes, check Mailgun logs

## Quick Fix Checklist:

- [ ] `michaelvh89@hotmail.com` is in Authorized Recipients
- [ ] Status shows "Verified" (not pending)
- [ ] Checked spam/junk folder
- [ ] Mailgun logs show "Delivered" status
- [ ] Email in database matches exactly

