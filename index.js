const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Login = require('./src/Login')
const { createMainViewWindow } = require('./src/main/mainViewWindow')
const Store = require('electron-store')
const DiscordRPC = require('discord-rpc')
const { autoUpdater } = require('electron-updater')

let selectionWindow = null
let loginWindow
const store = new Store()
const clientId = '1386760973154648134' // Your Discord application's client ID
DiscordRPC.register(clientId)
const rpc = new DiscordRPC.Client({ transport: 'ipc' })
let rpcReady = false
let queuedPresence = null

function createLoginWindow() {
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

    const storedKey = store.get('licenseKey')
    if (storedKey) {
        login.validateLicense(storedKey)
            .then(() => {
                createMainWindow()
                loginWindow.close()
            })
            .catch(() => {
                // If auto-login fails, show login form as normal
            })
    }
}

function createMainWindow() {
    const preloadPath = path.join(__dirname, 'src', 'main', 'preload.js');
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

app.whenReady().then(async () => {
    try {
        await login.initialize()
        createLoginWindow()
    } catch (error) {
        console.error('Failed to initialize:', error)
        app.quit()
    }
})

ipcMain.handle('validate-license', async (event, licenseKey) => {
    try {
        const result = await login.validateLicense(licenseKey)
        if (result) {
            // Save the license key on successful validation
            store.set('licenseKey', licenseKey)
            createMainWindow()
            loginWindow.close()
            return { success: true }
        }
        return { success: false, message: 'Invalid license key' }
    } catch (error) {
        return { success: false, message: error.message }
    }
})

// Add IPC handler for checking updates
ipcMain.handle('check-for-update', async () => {
    try {
        console.log('Checking for updates...');
        autoUpdater.checkForUpdates();
        return { success: true };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, message: error.message };
    }
});

function setRichPresence() {
    const presence = {
        details: 'Hosting Bot Lobbies',
        state: 'Soryn Bot Lobby Manager v3.1',
        largeImageKey: 'output-onlinepngtools', // You must upload an asset named 'logo' in your Discord app
        largeImageText: 'Soryn Bot Lobby Manager v3.1',
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

ipcMain.on('start-session', (event, config) => {
    console.log('Received start-session with config:', config);
    createMainViewWindow(config)
    if (selectionWindow) {
        selectionWindow.close()
        selectionWindow = null
    }
    setRichPresence();
})

ipcMain.on('login-attempt', (event, licenseKey) => {
    login.validateLicense(licenseKey)
        .then(() => {
            store.set('licenseKey', licenseKey)
            event.reply('login-success')
            createMainWindow()
            if (loginWindow) {
                loginWindow.close()
                loginWindow = null
            }
        })
        .catch((err) => {
            event.reply('login-failed', err.message)
        })
})

app.on('window-all-closed', function () {
    clearRichPresence();
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow()
})

// Auto-update event handlers
autoUpdater.on('update-available', () => {
    console.log('Update available');
    if (selectionWindow) {
        selectionWindow.webContents.send('update-available');
    }
});

autoUpdater.on('update-not-available', () => {
    console.log('Update not available');
    if (selectionWindow) {
        selectionWindow.webContents.send('update-not-available');
    }
});

autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded, installing...');
    // Install and restart
    autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    if (selectionWindow) {
        selectionWindow.webContents.send('update-error', err == null ? "unknown" : err.message);
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    console.log('Download progress:', progressObj);
    if (selectionWindow) {
        selectionWindow.webContents.send('update-download-progress', progressObj);
    }
}); 