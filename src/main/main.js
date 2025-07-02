const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const SelectionWindow = require('./selectionWindow');
const MainViewWindow = require('./mainViewWindow');
const { createMainViewWindow } = require('./mainViewWindow');
const LicenseManager = require('../license/licenseManager');

// Define the application icon path
const iconPath = path.join(__dirname, 'icon.ico');

let selectionWindow = null;
let mainViewWindow = null;
let macroActive = false;
let macroInterval = null;
let licenseManager = null;

// Function to create the application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'Edition',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Inspect Element' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Fullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Synchronization Panel',
          click: () => {
            if (mainViewWindow) {
              mainViewWindow.openSyncPanel();
            }
          }
        },
        {
          label: 'License Management',
          click: () => {
            if (licenseManager) {
              licenseManager.showLicenseWindow();
            }
          }
        },
        {
          label: 'Reset License',
          click: () => {
            if (licenseManager) {
              // Clear license data
              licenseManager.store.delete('licenseKey');
              licenseManager.store.delete('licenseStatus');
              // Show a confirmation message
              const resetWindow = new BrowserWindow({
                width: 300,
                height: 150,
                autoHideMenuBar: true,
                resizable: false,
                modal: true
              });
              resetWindow.loadURL(`data:text/html;charset=utf-8,
                <html>
                  <head>
                    <style>
                      body { font-family: sans-serif; padding: 20px; text-align: center; }
                      button { margin-top: 15px; padding: 8px 15px; }
                    </style>
                  </head>
                  <body>
                    <h3>License reset</h3>
                    <p>Restart the application to apply the changes.</p>
                    <button onclick="window.close()">OK</button>
                  </body>
                </html>
              `);
            }
          }
        }
      ]
    },
    {
      role: 'help',
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            // Afficher une fenêtre avec des informations sur l'application
            const aboutWindow = new BrowserWindow({
              width: 300,
              height: 200,
              title: 'About',
              autoHideMenuBar: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true
              }
            });
            aboutWindow.loadFile(path.join(__dirname, '../renderer/about.html'));
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSelectionWindow() {
  selectionWindow = new SelectionWindow();
  selectionWindow.window.on('closed', () => {
    selectionWindow = null;
  });
}

// Check the license before starting the application
async function checkLicense() {
  // Skip license check and proceed with application
  console.log('Skipping license check, starting application...');
  createSelectionWindow();
  createApplicationMenu();
  setupIPCHandlers();
}

app.whenReady().then(() => {
  // Set the application icon for the entire application
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName());
  }
  
  // Check the license before starting the application
  checkLicense();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Check the license again if no window is open
      checkLicense();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add the IPC event listeners
function setupIPCHandlers() {
  // Event to start a session
  ipcMain.on('start-session', (event, config) => {
    console.log('Received start-session with config:', config);
    createMainViewWindow(config);
    if (selectionWindow) {
      selectionWindow.close();
      selectionWindow = null;
    }
  });
  
  // Event to open the synchronization panel
  ipcMain.on('open-sync-panel', () => {
    if (mainViewWindow) {
      mainViewWindow.openSyncPanel();
    }
  });
  
  // Event to execute a macro
  ipcMain.on('execute-macro', (event, data) => {
    const { macroId, gameMode } = data;
    
    if (mainViewWindow) {
      // Use the macroManager to execute the macro
      mainViewWindow.executeMacro(macroId, gameMode);
    }
  });
  
  // Event to receive the bitrate settings
  ipcMain.on('update-bitrate-settings', (event, settings) => {
    console.log('Received bitrate settings:', settings);
    
    // Store the settings in a global variable for future views
    global.serverConfig = {
      region: settings.region,
      hostBitrate: settings.hostBitrate,
      playerBitrate: settings.playerBitrate
    };
    
    // Update the existing views if they exist
    if (mainViewWindow && mainViewWindow.views) {
      mainViewWindow.views.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          // Determine the bitrate based on the view type
          const bitrate = view.viewType === 'host' ? settings.hostBitrate : settings.playerBitrate;
          
          // Send the new configuration to the view
          view.webContents.send('server-config', {
            region: settings.region,
            bitrate: bitrate,
            bypassRestriction: 'off'
          });
          
          console.log(`Configuration sent to view ${view.viewNumber} (${view.viewType}): bitrate=${bitrate}, region=${settings.region}`);
        }
      });
    }
  });
  
  // Event to request the views state
  ipcMain.on('request-views-state', (event) => {
    if (mainViewWindow) {
      mainViewWindow.updateSyncPanel();
    }
  });
  
  // Event to synchronize the views
  ipcMain.on('synchronize-views', (event, selectedIndices) => {
    if (mainViewWindow) {
      mainViewWindow.synchronizeViews(selectedIndices);
    }
  });
  
  // Events for synchronized keyboard
  ipcMain.on('keyboard-event', (event, keyEvent) => {
    if (mainViewWindow) {
      mainViewWindow.handleSynchronizedKeyboard(keyEvent);
    }
  });
  
  // Handle the main container scrolling
  ipcMain.on('container-scrolled', (event, position) => {
    if (mainViewWindow) {
      mainViewWindow.handleContainerScroll(position);
    }
  });
  
  // Handle the wheel events
  ipcMain.on('wheel-scrolled', (event, delta) => {
    if (mainViewWindow) {
      mainViewWindow.handleWheelScroll(delta);
    }
  });
  
  // Handle the keyboard events for scrolling
  ipcMain.on('keyboard-scroll', (event, data) => {
    if (mainViewWindow) {
      mainViewWindow.handleKeyboardScroll(data);
    }
  });
}

ipcMain.on('sync-scroll', (event, scrollPos) => {
  if (mainViewWindow) {
    mainViewWindow.syncScroll(scrollPos);
  }
});

// Macro handler for simulated key presses
ipcMain.on('toggle-macro', (event, enabled) => {
  if (enabled) {
    startMacro();
  } else {
    stopMacro();
  }
});

// Function to start the macro
function startMacro() {
  if (macroActive || !mainViewWindow) return;
  
  macroActive = true;
  
  // Notify the interface that the macro is active
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: true });
  }
  
  // Array of keys to simulate in rotation
  const mainKeys = ['a', 's', 'd', 'w'];
  const randomKeys = ['a', 's', 'd', 'w', 'q', 'e', 'z', 'x', 'c', 'space', 'shift', 'control'];
  let currentKeyIndex = 0;
  
  // Function to simulate a main key press for 500ms
  const simulateMainKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = mainKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % mainKeys.length;
    
    // Simulate the key press
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Release the key after 500ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 500);
      }
    });
  };
  
  // Function to simulate a random key press
  const simulateRandomKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = randomKeys[Math.floor(Math.random() * randomKeys.length)];
    
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Release the key after 100ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 100);
      }
    });
  };
  
  // Start the interval to simulate the main keys
  const mainKeyInterval = setInterval(simulateMainKey, 2000); // every 2 seconds
  
  // Start the interval to simulate the random keys
  const randomKeyInterval = setInterval(simulateRandomKey, 1000); // every 1 second
  
  macroInterval = {
    mainKeyInterval,
    randomKeyInterval
  };
}

// Function to stop the macro
function stopMacro() {
  if (!macroActive) return;
  
  macroActive = false;
  
  // Notify the interface that the macro is inactive
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: false });
  }
  
  // Stop the intervals
  if (macroInterval) {
    if (macroInterval.mainKeyInterval) clearInterval(macroInterval.mainKeyInterval);
    if (macroInterval.randomKeyInterval) clearInterval(macroInterval.randomKeyInterval);
    macroInterval = null;
  }
} 