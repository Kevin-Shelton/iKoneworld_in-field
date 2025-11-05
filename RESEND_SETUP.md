# Resend Email Integration Setup Guide

This guide will help you set up real email sending and receiving with automatic translation using Resend.

---

## 📋 Prerequisites

- ✅ Resend account (free tier works for testing)
- ✅ Domain name (or use `resend.dev` for testing)
- ✅ Verbum API key for translation

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Resend API Key

1. Go to [https://resend.com/api-keys](https://resend.com/api-keys)
2. Click "Create API Key"
3. Name it: "iKoneworld Email"
4. Copy the API key (starts with `re_`)

### Step 2: Configure Environment Variables

Add to your `.env.local` or Vercel environment variables:

```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# For testing, use Resend's test domain
RESEND_FROM_EMAIL="iKoneworld Translation <onboarding@resend.dev>"

# For production, use your verified domain
# RESEND_FROM_EMAIL="iKoneworld Translation <noreply@yourdomain.com>"
```

### Step 3: Test Sending Emails

1. Deploy your app or run locally
2. Go to `/email` in your app
3. Click "Compose New"
4. Add a recipient (your personal email)
5. Write a message
6. Click "Send Email"
7. Check your inbox! ✉️

---

## 📨 Receiving Emails (Inbound)

To receive emails and have them appear in your inbox:

### Step 1: Set Up Inbound Domain

1. Go to [Resend Dashboard → Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain: `yourdomain.com`
4. Follow DNS setup instructions
5. Wait for verification (usually 5-10 minutes)

### Step 2: Configure Inbound Route

1. Go to [Resend Dashboard → Inbound](https://resend.com/inbound)
2. Click "Create Inbound Route"
3. Configure:
   - **Match**: `*@yourdomain.com` (all emails)
   - **Forward to**: Your webhook URL
   - **Webhook URL**: `https://yourdomain.com/api/email/inbound`
4. Save the route

### Step 3: Test Inbound Email

1. Send an email TO: `anything@yourdomain.com`
2. Resend will forward it to your webhook
3. Check your app's `/email` inbox
4. The email should appear with auto-translation! 🎉

---

## 🌐 Domain Setup (Production)

### Option 1: Use Resend Test Domain (Quick)

For testing, use `onboarding@resend.dev`:

```bash
RESEND_FROM_EMAIL="Your Name <onboarding@resend.dev>"
```

**Limitations:**
- ⚠️ Can only send to verified emails
- ⚠️ Cannot receive inbound emails
- ⚠️ Not for production use

### Option 2: Verify Your Own Domain (Recommended)

1. **Add Domain in Resend**
   - Go to [Domains](https://resend.com/domains)
   - Click "Add Domain"
   - Enter: `yourdomain.com`

2. **Add DNS Records**
   
   Resend will provide these records to add to your DNS:
   
   ```
   Type: TXT
   Name: @ (or yourdomain.com)
   Value: resend-verify=abc123...
   
   Type: MX
   Name: @ (or yourdomain.com)
   Priority: 10
   Value: mx1.resend.com
   
   Type: MX
   Name: @ (or yourdomain.com)
   Priority: 20
   Value: mx2.resend.com
   
   Type: TXT
   Name: @ (or yourdomain.com)
   Value: v=spf1 include:resend.com ~all
   
   Type: TXT
   Name: resend._domainkey
   Value: (DKIM key provided by Resend)
   ```

3. **Wait for Verification**
   - Usually takes 5-30 minutes
   - Check status in Resend Dashboard
   - Once verified, you can send from `anything@yourdomain.com`

4. **Update Environment Variable**
   ```bash
   RESEND_FROM_EMAIL="iKoneworld <noreply@yourdomain.com>"
   ```

---

## 🔧 Advanced Configuration

### Custom Reply-To Address

Allow recipients to reply directly:

```bash
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
```

### Webhook Security (Recommended)

Verify webhook requests are from Resend:

1. Go to [Resend Dashboard → Webhooks](https://resend.com/webhooks)
2. Copy your "Signing Secret"
3. Add to environment:
   ```bash
   RESEND_WEBHOOK_SECRET=whsec_your_secret_here
   ```

4. Update `/api/email/inbound/route.ts` to verify signatures

### Email Templates

Customize the HTML email template in `/lib/resend.ts`:

```typescript
function formatEmailHTML(content: string, senderName: string): string {
  // Your custom HTML template here
}
```

---

## 🧪 Testing

### Test Sending

```bash
# Send test email via API
curl -X POST https://yourdomain.com/api/email/send-multi \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Email",
    "content": "Hello, this is a test!",
    "recipients": [{"email": "test@example.com", "language": "en"}],
    "senderEmail": "you@yourdomain.com",
    "senderLanguage": "en"
  }'
```

### Test Receiving

```bash
# Test webhook endpoint
curl https://yourdomain.com/api/email/inbound
```

### View Logs

Check Resend Dashboard → Logs to see:
- Sent emails
- Delivery status
- Webhook calls
- Errors

---

## 🐛 Troubleshooting

### Emails Not Sending

**Check:**
1. ✅ `RESEND_API_KEY` is set correctly
2. ✅ `RESEND_FROM_EMAIL` is verified in Resend
3. ✅ Check Resend Dashboard → Logs for errors
4. ✅ Check server logs for API errors

**Common Issues:**
- "Domain not verified" → Verify your domain in Resend
- "Invalid API key" → Check `.env.local` or Vercel env vars
- "Rate limit exceeded" → Upgrade Resend plan

### Emails Not Receiving

**Check:**
1. ✅ Domain is verified in Resend
2. ✅ Inbound route is configured
3. ✅ Webhook URL is accessible (not localhost)
4. ✅ MX records are set correctly

**Test Webhook:**
```bash
curl -X POST https://yourdomain.com/api/email/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": ["you@yourdomain.com"],
    "subject": "Test",
    "text": "Hello"
  }'
```

### Translation Not Working

**Check:**
1. ✅ `VERBUM_API_KEY` is set
2. ✅ `NEXT_PUBLIC_VERBUM_API_URL` is set
3. ✅ Check API logs for translation errors
4. ✅ Verify Verbum API quota

---

## 📊 Monitoring

### Resend Dashboard

Monitor your email activity:
- **Logs**: See all sent emails and webhooks
- **Analytics**: Track delivery rates
- **Domains**: Check verification status
- **API Keys**: Manage access

### Application Logs

Check your application logs for:
- Email send attempts
- Translation requests
- Webhook processing
- Database insertions

---

## 💰 Pricing

### Resend Free Tier
- ✅ 100 emails/day
- ✅ 1 domain
- ✅ Inbound emails
- ✅ Webhooks

### Resend Pro ($20/month)
- ✅ 50,000 emails/month
- ✅ Unlimited domains
- ✅ Priority support
- ✅ Advanced analytics

---

## 🔐 Security Best Practices

1. **Never commit API keys** to Git
2. **Use environment variables** for all secrets
3. **Verify webhook signatures** in production
4. **Use HTTPS** for webhook URLs
5. **Rotate API keys** periodically
6. **Monitor logs** for suspicious activity

---

## 📚 Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Resend Inbound Guide](https://resend.com/docs/send/inbound-emails)
- [Resend Node.js SDK](https://github.com/resendlabs/resend-node)

---

## ✅ Checklist

Before going to production:

- [ ] Resend API key configured
- [ ] Domain verified in Resend
- [ ] DNS records added (SPF, DKIM, MX)
- [ ] Inbound route configured
- [ ] Webhook URL accessible
- [ ] Test sending email
- [ ] Test receiving email
- [ ] Test translation
- [ ] Monitor logs for errors
- [ ] Set up webhook signature verification

---

## 🆘 Support

If you need help:
- Resend Support: [support@resend.com](mailto:support@resend.com)
- Resend Discord: [discord.gg/resend](https://discord.gg/resend)
- Documentation: [resend.com/docs](https://resend.com/docs)
