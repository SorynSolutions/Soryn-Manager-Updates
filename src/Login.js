const SorynAuthClient = require('./authClient');

class Login {
    constructor() {
        this.authClient = new SorynAuthClient('https://soryn-manager-updates.onrender.com');
    }

    async validateLicense(key) {
        // Use backend for validation
        const result = await this.authClient.validateKey(key);
        if (!result.success) {
            throw new Error(result.error || 'Invalid key');
        }
        return { success: true, message: result.message };
    }
}

module.exports = Login; 