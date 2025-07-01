// Obfuscated seller key using base64 + XOR
const obfuscatedKey = "ZDRmOGU1ZTIwYzM2NzliNTNjYTJjYWFiZWQ5NTIzZWI="; // base64 of new key
const xorKey = 0x42; // XOR key for additional obfuscation

function deobfuscateKey() {
    try {
        // Decode base64
        const decoded = Buffer.from(obfuscatedKey, 'base64').toString();
        // Apply XOR decryption
        return decoded.split('').map(char => 
            String.fromCharCode(char.charCodeAt(0) ^ xorKey)
        ).join('');
    } catch (error) {
        console.error('Key deobfuscation failed:', error);
        return null;
    }
}

module.exports = {
    keyAuth: {
        name: "Soryn",
        ownerid: "ndOSlZmy3F",
        version: "1.0"
    },
    get sellerKey() {
        return deobfuscateKey();
    }
}; 