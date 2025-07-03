const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Login = require('./src/Login')
const { createMainViewWindow } = require('./src/main/mainViewWindow')
const Store = require('electron-store')
const DiscordRPC = require('discord-rpc')
const fetch = require('node-fetch')
const fs = require('fs')
const { dialog } = require('electron')

let selectionWindow = null
let loginWindow
const store = new Store()
const clientId = '1386760973154648134' // Your Discord application's client ID
DiscordRPC.register(clientId)
const rpc = new DiscordRPC.Client({ transport: 'ipc' })
let rpcReady = false
let queuedPresence = null

const CURRENT_VERSION = "3.1.0" // Update this to match your app version

async function checkToolStatus() {
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
    const updateOk = await checkForUpdate();
    if (!updateOk) return; // Do not proceed if update was found
    const ok = await checkToolStatus()
    if (ok) {
        createLoginWindow()
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

async function checkForUpdate() {
    try {
        const res = await fetch('https://soryn-manager-update-metadata.onrender.com/latest.json');
        const data = await res.json();
        const latestVersion = data.version;
        const downloadUrl = data.url;

        const localVersion = app.getVersion();
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