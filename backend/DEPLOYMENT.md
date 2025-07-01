# Render.com Deployment Guide

This guide will walk you through deploying the Soryn Authentication Backend to Render.com.

## Prerequisites

1. **GitHub Account** - Your code must be in a GitHub repository
2. **Render.com Account** - Sign up at [render.com](https://render.com)
3. **KeyAuth Account** - Ensure your KeyAuth credentials are ready

## Step 1: Prepare Your Repository

### 1.1 Push Backend to GitHub
```bash
# In your project root
git add backend/
git commit -m "Add secure authentication backend"
git push origin main
```

### 1.2 Verify Repository Structure
Your repository should look like this:
```
your-repo/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── env.example
│   ├── README.md
│   └── DEPLOYMENT.md
├── src/
│   ├── config.js
│   ├── authClient.js
│   └── ...
└── ...
```

## Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Click "Get Started"
3. Sign up with GitHub (recommended)
4. Authorize Render to access your repositories

## Step 3: Deploy Backend Service

### 3.1 Create New Web Service
1. In Render dashboard, click **"New +"**
2. Select **"Web Service"**
3. Connect your GitHub repository
4. Click **"Connect"**

### 3.2 Configure Service Settings
```
Name: soryn-auth-backend
Environment: Node
Region: Choose closest to your users
Branch: main
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

### 3.3 Set Environment Variables
Click **"Environment"** tab and add these variables:

```
SELLER_KEY=d4f8e5e20c3679b53ca2caabed9523eb
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
```

**Important Security Notes:**
- Generate a strong JWT_SECRET (use a password generator)
- Update ALLOWED_ORIGINS with your actual frontend domains
- Never commit these values to your repository

### 3.4 Advanced Settings (Optional)
```
Auto-Deploy: Yes (recommended)
Health Check Path: /api/health
```

### 3.5 Deploy
1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Start the server
   - Provide a public URL

## Step 4: Verify Deployment

### 4.1 Check Health Endpoint
```bash
curl https://your-service-name.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4.2 Test Key Validation (Optional)
```bash
curl -X POST https://your-service-name.onrender.com/api/validate-key \
  -H "Content-Type: application/json" \
  -d '{"key":"test-key","hwid":"test-hwid"}'
```

## Step 5: Update Client Configuration

### 5.1 Update authClient.js
Replace the backend URL in your client code:

```javascript
// In src/authClient.js
const authClient = new SorynAuthClient('https://your-service-name.onrender.com');
```

### 5.2 Update config.js
Remove the seller key from client-side config:

```javascript
// src/config.js - Remove seller key, keep only basic config
module.exports = {
    keyAuth: {
        name: "Soryn",
        ownerid: "ndOSlZmy3F",
        version: "1.0"
    }
    // sellerKey is now handled by backend
};
```

## Step 6: Monitor and Maintain

### 6.1 View Logs
- Go to your service in Render dashboard
- Click **"Logs"** tab
- Monitor for errors and usage

### 6.2 Set Up Alerts (Optional)
- Enable email notifications for deployment status
- Monitor service uptime

### 6.3 Database Management
- SQLite database is automatically created
- Data persists between deployments
- Consider backing up `auth.db` for production

## Troubleshooting

### Common Issues

#### 1. Build Failures
**Error:** `npm install` fails
**Solution:** Check `package.json` dependencies and Node.js version

#### 2. Environment Variables
**Error:** `SELLER_KEY is undefined`
**Solution:** Verify environment variables are set correctly in Render dashboard

#### 3. CORS Errors
**Error:** `Access to fetch at '...' from origin '...' has been blocked`
**Solution:** Update `ALLOWED_ORIGINS` with your frontend domain

#### 4. KeyAuth API Errors
**Error:** `Authentication service unavailable`
**Solution:** Verify `SELLER_KEY` is correct and KeyAuth service is up

#### 5. Database Errors
**Error:** `SQLite database locked`
**Solution:** This is usually temporary, retry the request

### Performance Optimization

#### 1. Enable Caching
```javascript
// Add to server.js
app.use(express.static('public', { maxAge: '1h' }));
```

#### 2. Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_session_id ON usage_logs(session_id);
```

#### 3. Rate Limiting Tuning
Adjust rate limits based on your usage patterns:
```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Increase if needed
    message: 'Too many requests'
});
```

## Security Checklist

- [ ] JWT_SECRET is strong and unique
- [ ] ALLOWED_ORIGINS is properly configured
- [ ] SELLER_KEY is set in environment variables
- [ ] No sensitive data in client-side code
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] HTTPS is enforced (automatic on Render)

## Cost Optimization

### Free Tier Limits
- 750 hours/month
- 512 MB RAM
- Shared CPU
- Sleeps after 15 minutes of inactivity

### Paid Plans
- $7/month for always-on service
- 1 GB RAM
- Dedicated CPU
- Custom domains

## Next Steps

1. **Test thoroughly** with your actual license keys
2. **Monitor logs** for any issues
3. **Set up monitoring** for production use
4. **Consider upgrading** to paid plan for production
5. **Backup database** regularly
6. **Update client code** to use new authentication flow

## Support

- **Render Support:** [help.render.com](https://help.render.com)
- **KeyAuth Support:** [keyauth.win](https://keyauth.win)
- **GitHub Issues:** Create issues in your repository

Your backend is now securely deployed and your seller key is protected! 🎉 