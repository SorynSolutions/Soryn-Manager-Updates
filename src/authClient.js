/**
 * Soryn Authentication Client
 * Handles all authentication through the secure backend server
 */

class SorynAuthClient {
    constructor(backendUrl) {
        this.backendUrl = backendUrl || 'https://your-backend.onrender.com';
        this.token = null;
        this.sessionId = null;
        this.hwid = null;
    }

    /**
     * Get hardware ID for the current machine
     */
    async getHWID() {
        if (this.hwid) return this.hwid;
        
        try {
            // Use a combination of system info to create a unique HWID
            const os = require('os');
            const crypto = require('crypto');
            
            const systemInfo = {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                cpus: os.cpus().length,
                totalMem: os.totalmem(),
                networkInterfaces: Object.keys(os.networkInterfaces())
            };
            
            const hwidString = JSON.stringify(systemInfo);
            this.hwid = crypto.createHash('sha256').update(hwidString).digest('hex');
            
            return this.hwid;
        } catch (error) {
            console.error('Failed to generate HWID:', error);
            // Fallback to a simple hash
            this.hwid = crypto.createHash('sha256').update(os.hostname()).digest('hex');
            return this.hwid;
        }
    }

    /**
     * Validate license key with backend server
     */
    async validateKey(key) {
        try {
            const hwid = await this.getHWID();
            
            const response = await fetch(`${this.backendUrl}/api/validate-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Soryn-Client/1.0'
                },
                body: JSON.stringify({
                    key: key,
                    hwid: hwid
                })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.sessionId = data.sessionId;
                this.hwid = hwid;
                
                // Store token for persistence
                localStorage.setItem('soryn_auth_token', this.token);
                localStorage.setItem('soryn_session_id', this.sessionId);
                
                return {
                    success: true,
                    message: data.message,
                    sessionId: this.sessionId
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Validation failed'
                };
            }
        } catch (error) {
            console.error('Key validation error:', error);
            return {
                success: false,
                error: 'Network error or server unavailable'
            };
        }
    }

    /**
     * Check if current session is valid
     */
    async checkStatus() {
        if (!this.token) {
            // Try to restore from localStorage
            const savedToken = localStorage.getItem('soryn_auth_token');
            const savedSessionId = localStorage.getItem('soryn_session_id');
            
            if (savedToken && savedSessionId) {
                this.token = savedToken;
                this.sessionId = savedSessionId;
            } else {
                return { success: false, error: 'No active session' };
            }
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/check-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'Soryn-Client/1.0'
                }
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    session: data.session
                };
            } else {
                // Clear invalid session
                this.clearSession();
                return {
                    success: false,
                    error: data.error || 'Session invalid'
                };
            }
        } catch (error) {
            console.error('Status check error:', error);
            return {
                success: false,
                error: 'Network error or server unavailable'
            };
        }
    }

    /**
     * Activate license for current hardware
     */
    async activateLicense() {
        if (!this.token) {
            return { success: false, error: 'No active session' };
        }

        try {
            const hwid = await this.getHWID();
            
            const response = await fetch(`${this.backendUrl}/api/activate-license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'Soryn-Client/1.0'
                },
                body: JSON.stringify({
                    hwid: hwid
                })
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    message: data.message
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Activation failed'
                };
            }
        } catch (error) {
            console.error('License activation error:', error);
            return {
                success: false,
                error: 'Network error or server unavailable'
            };
        }
    }

    /**
     * Logout and end session
     */
    async logout() {
        if (!this.token) {
            this.clearSession();
            return { success: true, message: 'Already logged out' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'Soryn-Client/1.0'
                }
            });

            const data = await response.json();
            this.clearSession();
            
            return {
                success: true,
                message: data.message || 'Logged out successfully'
            };
        } catch (error) {
            console.error('Logout error:', error);
            // Clear session even if logout request fails
            this.clearSession();
            return {
                success: true,
                message: 'Logged out locally'
            };
        }
    }

    /**
     * Clear local session data
     */
    clearSession() {
        this.token = null;
        this.sessionId = null;
        localStorage.removeItem('soryn_auth_token');
        localStorage.removeItem('soryn_session_id');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Get current session info
     */
    getSessionInfo() {
        return {
            token: this.token,
            sessionId: this.sessionId,
            hwid: this.hwid,
            isAuthenticated: this.isAuthenticated()
        };
    }

    /**
     * Test backend connectivity
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Soryn-Client/1.0'
                }
            });

            const data = await response.json();
            return {
                success: true,
                status: data.status,
                timestamp: data.timestamp
            };
        } catch (error) {
            console.error('Connection test error:', error);
            return {
                success: false,
                error: 'Cannot connect to authentication server'
            };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SorynAuthClient;
} else if (typeof window !== 'undefined') {
    window.SorynAuthClient = SorynAuthClient;
} 