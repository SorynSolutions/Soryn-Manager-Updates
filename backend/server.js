const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
const db = new sqlite3.Database('./auth.db');

// Create tables
db.serialize(() => {
    // Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE,
        key_value TEXT,
        hwid TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )`);

    // Usage logs table
    db.run(`CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        action TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Blacklisted keys table
    db.run(`CREATE TABLE IF NOT EXISTS blacklisted_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_value TEXT UNIQUE,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// KeyAuth API configuration
const KEYAUTH_CONFIG = {
    name: "Soryn",
    ownerid: "ndOSlZmy3F",
    version: "1.0",
    sellerKey: process.env.SELLER_KEY
};

// Utility functions
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

function logUsage(sessionId, action, req) {
    const stmt = db.prepare(`
        INSERT INTO usage_logs (session_id, action, ip_address, user_agent)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, action, req.ip, req.get('User-Agent'));
    stmt.finalize();
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Validate license key
app.post('/api/validate-key', async (req, res) => {
    try {
        const { key, hwid } = req.body;

        if (!key || !hwid) {
            return res.status(400).json({ error: 'Key and HWID are required' });
        }

        // Check if key is blacklisted
        db.get('SELECT * FROM blacklisted_keys WHERE key_value = ?', [key], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (row) {
                return res.status(403).json({ error: 'Key is blacklisted', reason: row.reason });
            }

            // Call KeyAuth Seller API for detailed info
            try {
                const infoParams = new URLSearchParams({
                    sellerkey: process.env.SELLER_KEY,
                    type: 'info',
                    key: key
                });
                const infoResp = await axios.get('https://keyauth.win/api/seller/', { params: infoParams });
                const data = infoResp.data;

                if (!data.success) {
                    return res.status(401).json({ success: false, error: data.message || 'Invalid key' });
                }

                // Check key status
                const status = (data.status || '').toLowerCase();
                if (status === 'banned') {
                    return res.status(403).json({ success: false, error: 'Your License Has Been Banned' });
                }
                if (status === 'expired') {
                    return res.status(403).json({ success: false, error: 'Your License Has Expired' });
                }

                // Check if key is already used by another computer
                const usedBy = data.usedby || '';
                if (usedBy && usedBy !== hwid) {
                    return res.status(403).json({ success: false, error: 'License Already Registered' });
                }

                // If key is unused, activate it for this computer
                if (!usedBy) {
                    const activateParams = new URLSearchParams({
                        sellerkey: process.env.SELLER_KEY,
                        type: 'activate',
                        key: key,
                        user: hwid
                    });
                    const activateResp = await axios.get('https://keyauth.win/api/seller/', { params: activateParams });
                    const activateData = activateResp.data;
                    if (!activateData.success) {
                        return res.status(400).json({ success: false, error: activateData.message || 'Failed To Activate License, Please Contact Support' });
                    }
                }

                // Create session
                const sessionId = generateSessionId();
                const token = jwt.sign(
                    { sessionId, key, hwid },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );

                // Store session in database
                db.run(`
                    INSERT INTO sessions (session_id, key_value, hwid)
                    VALUES (?, ?, ?)
                `, [sessionId, key, hwid]);

                logUsage(sessionId, 'key_validation', req);

                res.json({
                    success: true,
                    token,
                    sessionId,
                    message: 'Key validated successfully'
                });
            } catch (keyAuthError) {
                console.error('KeyAuth API error:', keyAuthError.response?.data || keyAuthError.message);
                res.status(500).json({ error: 'Authentication service unavailable' });
            }
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check session status
app.get('/api/check-status', verifyToken, (req, res) => {
    const { sessionId } = req.user;

    db.get('SELECT * FROM sessions WHERE session_id = ? AND is_active = 1', [sessionId], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!row) {
            return res.status(401).json({ error: 'Session not found or inactive' });
        }

        // Update last used timestamp
        db.run('UPDATE sessions SET last_used = CURRENT_TIMESTAMP WHERE session_id = ?', [sessionId]);

        logUsage(sessionId, 'status_check', req);

        res.json({
            success: true,
            session: {
                sessionId: row.session_id,
                hwid: row.hwid,
                createdAt: row.created_at,
                lastUsed: row.last_used
            }
        });
    });
});

// Activate license
app.post('/api/activate-license', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.user;
        const { hwid } = req.body;

        // Verify session exists
        db.get('SELECT * FROM sessions WHERE session_id = ? AND is_active = 1', [sessionId], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!row) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            // Call KeyAuth activate API
            try {
                const activateResponse = await axios.post('https://keyauth.win/api/1.2/', {
                    type: 'activate',
                    name: KEYAUTH_CONFIG.name,
                    ownerid: KEYAUTH_CONFIG.ownerid,
                    version: KEYAUTH_CONFIG.version,
                    key: row.key_value,
                    hwid: hwid
                }, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                if (activateResponse.data.success) {
                    logUsage(sessionId, 'license_activation', req);
                    res.json({
                        success: true,
                        message: 'License activated successfully'
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        error: activateResponse.data.message || 'Activation failed'
                    });
                }
            } catch (activateError) {
                console.error('KeyAuth activation error:', activateError.response?.data || activateError.message);
                res.status(500).json({ error: 'Activation service unavailable' });
            }
        });
    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout/end session
app.post('/api/logout', verifyToken, (req, res) => {
    const { sessionId } = req.user;

    db.run('UPDATE sessions SET is_active = 0 WHERE session_id = ?', [sessionId], (err) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        logUsage(sessionId, 'logout', req);
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Soryn Auth Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    db.close();
    process.exit(0);
});