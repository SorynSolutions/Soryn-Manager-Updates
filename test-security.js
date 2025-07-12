#!/usr/bin/env node

/**
 * Security Test Script
 * Tests the enhanced security features
 */

const SorynAuthClient = require('./src/authClient.js');

async function testSecurity() {
    console.log('🔒 Testing Security Features...\n');
    
    const authClient = new SorynAuthClient('https://your-backend-url.com');
    
    try {
        // Test HWID generation
        console.log('1. Testing HWID generation...');
        const hwid = await authClient.getHWID();
        console.log(`   HWID: ${hwid.substring(0, 16)}...`);
        console.log(`   Display Name: ${authClient.getDisplayName()}\n`);
        
        // Test security status
        console.log('2. Testing security status...');
        const status = authClient.getSecurityStatus();
        console.log(`   Compromised: ${status.isCompromised}`);
        console.log(`   Checksum: ${status.checksum ? 'Valid' : 'Not calculated'}\n`);
        
        // Test security checks
        console.log('3. Testing security checks...');
        const securityCheck = authClient.performSecurityCheck();
        console.log(`   Security Check: ${securityCheck ? 'PASSED' : 'FAILED'}\n`);
        
        console.log('✅ Security tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Security test failed:', error.message);
    }
}

testSecurity();
