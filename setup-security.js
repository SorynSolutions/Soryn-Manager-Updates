#!/usr/bin/env node

/**
 * Security Setup Script for Soryn Bot Lobby Manager
 * This script helps configure the enhanced security features
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔒 Soryn Bot Lobby Manager - Security Setup\n');

// Generate encryption key
function generateEncryptionKey() {
    console.log('📝 Generating AES-256 encryption key...');
    const key = crypto.randomBytes(32);
    const keyHex = key.toString('hex');
    
    console.log('✅ Encryption key generated:');
    console.log(`   ${keyHex}\n`);
    
    return keyHex;
}

// Create payload directory
function createPayloadDirectory() {
    const payloadDir = path.join(__dirname, 'backend', 'payloads');
    
    if (!fs.existsSync(payloadDir)) {
        fs.mkdirSync(payloadDir, { recursive: true });
        console.log('📁 Created payloads directory:');
        console.log(`   ${payloadDir}\n`);
    } else {
        console.log('📁 Payloads directory already exists:\n');
        console.log(`   ${payloadDir}\n`);
    }
    
    return payloadDir;
}

// Create sample .env template
function createEnvTemplate(encryptionKey) {
    const envTemplate = `# Soryn Bot Lobby Manager - Security Configuration

# Existing variables (update with your values)
SELLER_KEY=your_keyauth_seller_key_here
JWT_SECRET=your_jwt_secret_here

# New security variables
PAYLOAD_ENCRYPTION_KEY=${encryptionKey}

# Optional: Additional security settings
ENABLE_ANTI_DEBUG=true
ENABLE_ANTI_VM=true
ENABLE_INTEGRITY_CHECK=true
SECURITY_CHECK_INTERVAL=30000
`;

    const envPath = path.join(__dirname, 'backend', '.env.template');
    fs.writeFileSync(envPath, envTemplate);
    
    console.log('📄 Created .env template:');
    console.log(`   ${envPath}\n`);
    
    return envPath;
}

// Create payload placeholder files
function createPayloadPlaceholders(payloadDir) {
    const platforms = [
        { name: 'win32-x64.exe', desc: 'Windows 64-bit' },
        { name: 'win32-ia32.exe', desc: 'Windows 32-bit' },
        { name: 'darwin-x64.exe', desc: 'macOS 64-bit' },
        { name: 'linux-x64.exe', desc: 'Linux 64-bit' }
    ];
    
    console.log('📦 Creating payload placeholder files...\n');
    
    platforms.forEach(platform => {
        const filePath = path.join(payloadDir, platform.name);
        const placeholder = `# This is a placeholder for ${platform.desc} payload
# Replace this file with your actual encrypted application binary
# The file should be the real application executable for ${platform.desc}

# File: ${platform.name}
# Platform: ${platform.desc}
# Created: ${new Date().toISOString()}
# 
# Instructions:
# 1. Build your application for ${platform.desc}
# 2. Replace this file with the actual executable
# 3. The backend will automatically encrypt it when requested
# 4. Ensure the file has proper permissions
`;
        
        fs.writeFileSync(filePath, placeholder);
        console.log(`   ✅ ${platform.name} (${platform.desc})`);
    });
    
    console.log('');
}

// Create security test script
function createSecurityTest() {
    const testScript = `#!/usr/bin/env node

/**
 * Security Test Script
 * Tests the enhanced security features
 */

const SorynAuthClient = require('./src/authClient.js');

async function testSecurity() {
    console.log('🔒 Testing Security Features...\\n');
    
    const authClient = new SorynAuthClient('https://your-backend-url.com');
    
    try {
        // Test HWID generation
        console.log('1. Testing HWID generation...');
        const hwid = await authClient.getHWID();
        console.log(\`   HWID: \${hwid.substring(0, 16)}...\`);
        console.log(\`   Display Name: \${authClient.getDisplayName()}\\n\`);
        
        // Test security status
        console.log('2. Testing security status...');
        const status = authClient.getSecurityStatus();
        console.log(\`   Compromised: \${status.isCompromised}\`);
        console.log(\`   Checksum: \${status.checksum ? 'Valid' : 'Not calculated'}\\n\`);
        
        // Test security checks
        console.log('3. Testing security checks...');
        const securityCheck = authClient.performSecurityCheck();
        console.log(\`   Security Check: \${securityCheck ? 'PASSED' : 'FAILED'}\\n\`);
        
        console.log('✅ Security tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Security test failed:', error.message);
    }
}

testSecurity();
`;

    const testPath = path.join(__dirname, 'test-security.js');
    fs.writeFileSync(testPath, testScript);
    fs.chmodSync(testPath, '755');
    
    console.log('🧪 Created security test script:');
    console.log(`   ${testPath}\n`);
    
    return testPath;
}

// Main setup function
async function main() {
    try {
        // Generate encryption key
        const encryptionKey = generateEncryptionKey();
        
        // Create payload directory
        const payloadDir = createPayloadDirectory();
        
        // Create .env template
        const envPath = createEnvTemplate(encryptionKey);
        
        // Create payload placeholders
        createPayloadPlaceholders(payloadDir);
        
        // Create security test script
        const testPath = createSecurityTest();
        
        console.log('🎉 Security setup completed successfully!\n');
        
        console.log('📋 Next Steps:');
        console.log('1. Copy the encryption key above to your backend .env file');
        console.log('2. Update your backend .env file with the template provided');
        console.log('3. Replace placeholder payload files with your actual application binaries');
        console.log('4. Run the security test: node test-security.js');
        console.log('5. Update your backend server with the new endpoints');
        console.log('6. Test the complete authentication flow\n');
        
        console.log('⚠️  Important Security Notes:');
        console.log('- Keep your encryption key secure and never commit it to version control');
        console.log('- Regularly rotate encryption keys');
        console.log('- Monitor security logs for compromise attempts');
        console.log('- Test security features thoroughly before production deployment');
        console.log('- Consider additional hardening measures for production use\n');
        
        console.log('📚 For detailed information, see SECURITY_UPGRADE.md');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

// Run setup
if (require.main === module) {
    main();
}

module.exports = {
    generateEncryptionKey,
    createPayloadDirectory,
    createEnvTemplate,
    createPayloadPlaceholders,
    createSecurityTest
}; 