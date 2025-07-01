const axios = require('axios');
const config = require('./config');
const { v4: uuidv4 } = require('uuid');
const qs = require('querystring');
const os = require('os');

class Login {
    constructor() {
        this.sessionid = null;
        this.guid = uuidv4().replace(/-/g, '').substring(0, 32); // 32 chars, no hyphens
    }

    async initialize() {
        // Debug: Log the KeyAuth config
        console.log('KeyAuth config:', config.keyAuth);
        // Initialize KeyAuth session
        const { name, ownerid, version } = config.keyAuth;
        const response = await axios.post(
            'https://keyauth.win/api/1.2/',
            qs.stringify({
                type: 'init',
                ver: version,
                name,
                ownerid,
                enckey: this.guid
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to initialize KeyAuth');
        }
        this.sessionid = response.data.sessionid;
    }

    async validateLicense(key) {
        const SELLER_KEY = config.sellerKey;
        const computerName = os.userInfo().username; // Use Windows username

        // 1. Check key status with Seller API
        const infoParams = {
            sellerkey: SELLER_KEY,
            type: 'info',
            key: key
        };
        const infoResp = await axios.get('https://keyauth.win/api/seller/', { params: infoParams });
        const data = infoResp.data;

        if (!data.success) {
            throw new Error(data.message || 'Invalid key');
        }

        // 2. Check key status
        const status = (data.status || '').toLowerCase();
        if (status === 'banned') throw new Error('Your License Has Been Banned');
        if (status === 'expired') throw new Error('Your License Has Expired');

        // 3. Check if key is already used by another computer
        const usedBy = data.usedby || '';
        if (usedBy && usedBy !== computerName) {
            throw new Error('License Already Registered');
        }

        // 4. If key is unused, activate it for this computer
        if (!usedBy) {
            const activateParams = {
                sellerkey: SELLER_KEY,
                type: 'activate',
                key: key,
                user: computerName
            };
            const activateResp = await axios.get('https://keyauth.win/api/seller/', { params: activateParams });
            const activateData = activateResp.data;
            if (!activateData.success) {
                throw new Error(activateData.message || 'Failed To Activate License, Please Contact Support');
            }
        }

        // 5. If all checks pass, allow login
        return { success: true, message: 'Login Successful' };
    }
}

module.exports = Login; 