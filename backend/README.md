# Soryn Authentication Backend

A secure backend server for handling KeyAuth license validation and session management.

## Features

- 🔐 **Secure KeyAuth Integration** - Seller key never exposed to clients
- 🛡️ **JWT Token Authentication** - Secure session management
- 📊 **Usage Analytics** - Track key usage and sessions
- ⚡ **Rate Limiting** - Prevent abuse and DDoS attacks
- 🗄️ **SQLite Database** - Lightweight, persistent storage
- 🔒 **Security Headers** - Helmet.js protection
- 📝 **Comprehensive Logging** - Monitor all activities

## API Endpoints

### Authentication
- `POST /api/validate-key` - Validate license key and create session
- `POST /api/activate-license` - Activate license for specific HWID
- `GET /api/check-status` - Check session status
- `POST /api/logout` - End session

### Health
- `GET /api/health` - Server health check

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your actual values
nano .env
```

**Required Environment Variables:**
- `SELLER_KEY` - Your KeyAuth seller key
- `JWT_SECRET` - Secret key for JWT token signing
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend domains

### 3. Local Development
```bash
npm run dev
```

### 4. Production
```bash
npm start
```

## Render.com Deployment

### 1. Create Render Account
- Sign up at [render.com](https://render.com)
- Connect your GitHub repository

### 2. Create New Web Service
- Click "New +" → "Web Service"
- Connect your repository
- Select the `backend` folder

### 3. Configure Service
```
Name: soryn-auth-backend
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 4. Environment Variables
Add these in Render dashboard:
```
SELLER_KEY=d4f8e5e20c3679b53ca2caabed9523eb
JWT_SECRET=your-super-secret-jwt-key-change-this
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### 5. Deploy
- Click "Create Web Service"
- Render will automatically deploy your backend

## Security Features

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable via environment variables

### CORS Protection
- Only allows requests from specified origins
- Prevents unauthorized cross-origin requests

### JWT Authentication
- 24-hour token expiration
- Secure token verification middleware

### Database Security
- SQL injection protection via parameterized queries
- Session tracking and blacklisting capabilities

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    key_value TEXT,
    hwid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);
```

### Usage Logs Table
```sql
CREATE TABLE usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    action TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Blacklisted Keys Table
```sql
CREATE TABLE blacklisted_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_value TEXT UNIQUE,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Client Integration

### Example Usage
```javascript
// Validate key
const response = await fetch('https://your-backend.onrender.com/api/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        key: 'your-license-key',
        hwid: 'hardware-id'
    })
});

const { token, sessionId } = await response.json();

// Use token for subsequent requests
const statusResponse = await fetch('https://your-backend.onrender.com/api/check-status', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

## Monitoring

### Health Check
```bash
curl https://your-backend.onrender.com/api/health
```

### Logs
- Check Render dashboard for application logs
- Database logs are stored in `auth.db`

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `ALLOWED_ORIGINS` includes your frontend domain
   - Check for trailing slashes in URLs

2. **KeyAuth API Errors**
   - Verify `SELLER_KEY` is correct
   - Check KeyAuth dashboard for API status

3. **Database Errors**
   - SQLite database is created automatically
   - Ensure write permissions in deployment directory

### Support
For issues related to:
- KeyAuth: Contact KeyAuth support
- Backend: Check logs in Render dashboard
- Client integration: Verify API endpoints and authentication

## License
This backend is part of the Soryn application suite. 