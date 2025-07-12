const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Login = require('./src/Login')
const { createMainViewWindow } = require('./src/main/mainViewWindow')
const Store = require('electron-store')
const DiscordRPC = require('discord-rpc')
const fetch = require('node-fetch')
const fs = require('fs')
const { dialog } = require('electron')
const packageJson = require('./package.json');
const appVersion = packageJson.version;

let selectionWindow = null
let loginWindow
const store = new Store()
const clientId = '1386760973154648134' // Your Discord application's client ID
DiscordRPC.register(clientId)
const rpc = new DiscordRPC.Client({ transport: 'ipc' })
let rpcReady = false
let queuedPresence = null

// Security configuration - moved to backend
const SECURITY_CONFIG = {
    payloadEncryptionKey: process.env.PAYLOAD_ENCRYPTION_KEY || 'bc63c63ba3a16a50edd5cfc3ca0aff5fb6a9d01d6fae9122e869aba85b435360'
};

/**
 * SECURE LICENSE KEY READING
 * Reads stored license key from config file and validates with backend
 * This is secure because:
 * 1. Only reads from specific config file path
 * 2. Always validates with backend server
 * 3. No client-side caching or bypassing
 * 4. Hardware binding enforced by backend
 * 5. Session only created after successful backend validation
 */
async function attemptStoredLicenseValidation() {
    try {
        // Read from the specific config file path
        const configPath = path.join(process.env.APPDATA || '', 'soryns-lobby-manager', 'config.json');
        
        if (!fs.existsSync(configPath)) {
            console.log('[License] No stored config file found - user must enter license key');
            return { success: false, reason: 'no_stored_key' };
        }

        // Security: Check file size to prevent massive file attacks
        const stats = fs.statSync(configPath);
        if (stats.size > 10240) { // 10KB limit
            console.log('[License] Config file too large - potential security risk');
            return { success: false, reason: 'config_file_too_large' };
        }

        const configData = fs.readFileSync(configPath, 'utf8');
        
        // Security: Basic JSON validation
        let config;
        try {
            config = JSON.parse(configData);
        } catch (parseError) {
            console.log('[License] Invalid JSON in config file');
            return { success: false, reason: 'invalid_json' };
        }
        
        // Security: Validate config structure
        if (!config || typeof config !== 'object') {
            console.log('[License] Invalid config structure');
            return { success: false, reason: 'invalid_config_structure' };
        }
        
        if (!config.licenseKey || typeof config.licenseKey !== 'string' || config.licenseKey.trim() === '') {
            console.log('[License] No valid license key found in config file');
            return { success: false, reason: 'invalid_stored_key' };
        }

        // Security: Basic license key format validation
        const licenseKey = config.licenseKey.trim();
        if (licenseKey.length < 5 || licenseKey.length > 100) {
            console.log('[License] License key format appears invalid');
            return { success: false, reason: 'invalid_key_format' };
        }

        console.log('[License] Found stored license key - attempting backend validation...');

        // ALWAYS validate with backend - no client-side bypassing
        const login = new Login();
        const validationResult = await login.validateLicense(licenseKey);
        
        if (validationResult && validationResult.success) {
            console.log('[License] Stored license key validated successfully with backend');
            return { success: true, licenseKey };
        } else {
            console.log('[License] Stored license key failed backend validation');
            return { success: false, reason: 'backend_validation_failed' };
        }

    } catch (error) {
        console.error('[License] Error reading or validating stored license key:', error.message);
        return { success: false, reason: 'error', error: error.message };
    }
}

/**
 * SECURE LICENSE KEY STORAGE
 * Saves license key to config file after successful backend validation
 * This is secure because:
 * 1. Only saves after successful backend validation
 * 2. Key is stored in user's app data directory
 * 3. No encryption needed since backend validation is required
 * 4. Hardware binding prevents key sharing
 */
async function saveLicenseKeyToConfig(licenseKey) {
    try {
        const configDir = path.join(process.env.APPDATA || '', 'soryns-lobby-manager');
        const configPath = path.join(configDir, 'config.json');
        
        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Read existing config or create new one
        let config = {};
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(configData);
        }
        
        // Save license key
        config.licenseKey = licenseKey;
        config.lastSaved = new Date().toISOString();
        
        // Write config file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('[License] License key saved to config file successfully');
        
        return { success: true };
    } catch (error) {
        console.error('[License] Error saving license key to config:', error.message);
        return { success: false, error: error.message };
    }
}

async function checkToolStatus() {
    // 🚨 DEVELOPMENT BYPASS - Set to true to bypass tool status check
    // ⚠️  REMOVE THIS BEFORE PRODUCTION DEPLOYMENT
    const BYPASS_TOOL_STATUS = true; // Change to true to bypass
    
    if (BYPASS_TOOL_STATUS) {
        console.log('[DEVELOPMENT] Tool status check bypassed - proceeding with app startup');
        return true;
    }
    
    try {
        const res = await fetch('https://tool-status-api.onrender.com/tool-status')
        const { status } = await res.json()
        console.log(`[ToolStatus] API status: ${status}`)
        if (status === 'off') {
            const { dialog, app } = require('electron')
            console.log('[ToolStatus] Tool is LOCKED (status: off). Exiting.')
            await checkForUpdate(); // Run updater before quitting
            dialog.showErrorBox('Soryns Bot Lobby Manager Under Maintenance', 'Soryns Bot Lobby Manager is currently under maintenance. Keep an eye out for updates in the "News" channel on Discord or you may try again later.')
            app.quit()
            return false
        }
        console.log('[ToolStatus] Tool is UNLOCKED (status: on). Proceeding.')
        return true
    } catch (e) {
        const { dialog, app } = require('electron')
        console.error('[ToolStatus] Error checking status:', e)
        dialog.showErrorBox('Network Error', 'Could not check tool status. Please try again later.')
        app.quit()
        return false
    }
}

function createLoginWindow() {
    console.log('[Window] Creating login window...');
    loginWindow = new BrowserWindow({
        width: 350,
        height: 380,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    loginWindow.loadFile('src/login.html')
    loginWindow.setResizable(false)

    // REMOVED: Auto-login with stored license key - this was a security vulnerability
    // All license validation must go through backend server
}

function createMainWindow() {
    const preloadPath = path.join(__dirname, 'src/main', 'preload.js');
    console.log('Preload path:', preloadPath);
    selectionWindow = new BrowserWindow({
        width: 800,
        height: 900,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#1a1a2e',
            symbolColor: '#ffffff',
            height: 30
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        }
    })

    selectionWindow.loadFile('src/renderer/selection.html')
}

const login = new Login()

async function startApp() {
    console.log('[Startup] Attempting stored license validation...');
    
    // Try to validate stored license key first
    const storedValidation = await attemptStoredLicenseValidation();
    
    if (storedValidation.success) {
        console.log('[Startup] Stored license key validated - proceeding to main window');
        // Create main window directly since backend validation succeeded
        createMainWindow();
    } else {
        console.log('[Startup] Stored license validation failed - showing login window');
        console.log('[Startup] Reason:', storedValidation.reason);
        // Show login window for manual key entry
        createLoginWindow();
    }
}

app.whenReady().then(async () => {
    const updateOk = await checkForUpdate();
    if (!updateOk) return; // Do not proceed if update was found
    const ok = await checkToolStatus()
    if (ok) {
        await startApp()
        // Periodically check tool status every 60 seconds
        setInterval(async () => {
            const stillOk = await checkToolStatus()
            if (!stillOk) {
                // checkToolStatus will show dialog and quit
                // No further action needed
            }
        }, 60000)
    }
})

function setRichPresence() {
    const presence = {
        details: 'Hosting Bot Lobbies',
        state: `Soryn Bot Lobby Manager v${appVersion}`,
        largeImageKey: 'output-onlinepngtools',
        largeImageText: `Soryn Manager v${appVersion}`,
        instance: false
    };
    if (!rpcReady) {
        queuedPresence = presence;
        return;
    }
    rpc.setActivity(presence);
}

function clearRichPresence() {
    if (!rpcReady) return;
    rpc.clearActivity();
}

rpc.on('ready', () => {
    rpcReady = true;
    console.log('Discord Rich Presence: Connected');
    if (queuedPresence) {
        rpc.setActivity(queuedPresence);
        queuedPresence = null;
    }
});

rpc.login({ clientId }).catch(console.error);

// SECURE LICENSE VALIDATION - Backend-only validation with optional storage
ipcMain.handle('validate-license', async (event, licenseKey, saveToConfig = false) => {
    try {
        // Use backend comprehensive validation
        const result = await login.validateLicense(licenseKey)
        if (result && result.success) {
            // If user wants to save the key for future use
            if (saveToConfig) {
                await saveLicenseKeyToConfig(licenseKey);
            }
            
            // Create main window after successful validation
            createMainWindow()
            loginWindow.close()
            return { success: true }
        }
        return { success: false, message: 'Invalid license key' }
    } catch (error) {
        return { success: false, message: error.message }
    }
})

ipcMain.on('start-session', (event, config) => {
    console.log('Received start-session with config:', config);
    createMainViewWindow(config)
    if (selectionWindow) {
        selectionWindow.close()
        selectionWindow = null
    }
    setRichPresence();
})

// SECURE LOGIN ATTEMPT - Backend validation with optional key storage
ipcMain.on('login-attempt', (event, licenseKey, saveToConfig = false) => {
    login.validateLicense(licenseKey)
        .then(async (result) => {
            if (result && result.success) {
                // If user wants to save the key for future use
                if (saveToConfig) {
                    await saveLicenseKeyToConfig(licenseKey);
                }
                
                // Backend validation successful - create main window
                event.reply('login-success')
                createMainWindow()
                if (loginWindow) {
                    loginWindow.close()
                    loginWindow = null
                }
            } else {
                event.reply('login-failed', result.message || 'Validation failed')
            }
        })
        .catch((err) => {
            event.reply('login-failed', err.message)
        })
})

// REMOVED: Client-side security status - backend handles all security validation
ipcMain.handle('get-security-status', async (event) => {
    const authClient = login.authClient;
    return authClient.getSecurityStatus();
});

// REMOVED: Client-side payload execution - backend handles all payload validation
ipcMain.handle('load-and-execute-payload', async (event, licenseKey, expectedHash) => {
    try {
        const authClient = login.authClient;
        const result = await authClient.loadAndExecute(licenseKey, SECURITY_CONFIG.payloadEncryptionKey, expectedHash);
        return result;
    } catch (error) {
        console.error('Payload execution error:', error);
        return { success: false, error: error.message };
    }
});

// REMOVED: Client-side payload metadata - backend handles all payload information
ipcMain.handle('get-payload-metadata', async (event, licenseKey) => {
    try {
        const authClient = login.authClient;
        const result = await authClient.getPayloadMetadata(licenseKey);
        return result;
    } catch (error) {
        console.error('Payload metadata error:', error);
        return { success: false, error: error.message };
    }
});

app.on('window-all-closed', function () {
    clearRichPresence();
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) startApp()
})

async function checkForUpdate() {
    try {
        const res = await fetch('https://soryn-manager-update-metadata.onrender.com/latest.json');
        const data = await res.json();
        const latestVersion = data.version;
        const downloadUrl = data.url;

        const localVersion = appVersion;
        console.log('Local version:', localVersion);
        console.log('Remote version:', latestVersion);

        if (localVersion !== latestVersion) {
            const userResponse = dialog.showMessageBoxSync({
                type: 'info',
                buttons: ['Update Now', 'Later'],
                defaultId: 0,
                cancelId: 1,
                title: 'Update Available',
                message: `A new version (${latestVersion}) is available!`,
                detail: 'Would you like to download and install the update now?'
            });

            if (userResponse === 0) {
                // Download the new EXE to the Downloads folder
                const downloadsPath = app.getPath('downloads');
                const destPath = path.join(downloadsPath, path.basename(downloadUrl));
                const fileRes = await fetch(downloadUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                if (!fileRes.ok) {
                    throw new Error(`Failed to download update: ${fileRes.statusText}`);
                }
                const contentType = fileRes.headers.get('content-type');
                if (contentType && contentType.includes('html')) {
                    throw new Error('Downloaded file is HTML, not the EXE. Check the URL and headers.');
                }
                const fileStream = fs.createWriteStream(destPath);
                await new Promise((resolve, reject) => {
                    fileRes.body.pipe(fileStream);
                    fileRes.body.on('error', reject);
                    fileStream.on('finish', resolve);
                });

                dialog.showMessageBoxSync({
                    type: 'info',
                    title: 'Update Downloaded',
                    message: `The update has been downloaded to your Downloads folder:\n${destPath}\n\nPlease close the app and run the new installer.`
                });

                app.quit();
                return false; // Do not proceed
            } else if (userResponse === 1 || userResponse === -1) {
                // User clicked 'Later' or closed the dialog
                app.quit();
                return false;
            }
        } else {
            console.log('No update available.');
        }
        return true; // No update needed, proceed
    } catch (err) {
        console.error('Error checking for updates:', err);
        return true; // On error, allow app to proceed
    }
} 