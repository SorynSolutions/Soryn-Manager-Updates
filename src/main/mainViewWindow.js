const { BrowserWindow, BrowserView, ipcMain, app, globalShortcut, Menu } = require('electron');
const path = require('path');
const { FullScreenSpooferScript } = require('./fullscreenSpoofer');
const fs = require('fs');
const url = require('url');
const MacroManager = require('./macro');
const { throttle } = require('lodash');

// Script to simulate that the window is always active
const AlwaysActiveWindowScript = `
  // Replace document.hasFocus() to always return true
  const originalHasFocus = document.hasFocus;
  document.hasFocus = function() { return true; };
  
  // Define document.visibilityState as always "visible"
  Object.defineProperty(document, 'visibilityState', {
    get: function() { return 'visible'; }
  });
  
  // Define document.hidden as always false
  Object.defineProperty(document, 'hidden', {
    get: function() { return false; }
  });
  
  // Handle document visibility events
  const fireVisibilityChange = (type) => {
    const evt = new Event('visibilitychange');
    document.dispatchEvent(evt);
  };
  
  // Intercept the blur event and simulate the focus
  window.addEventListener('blur', function(e) {
    setTimeout(() => {
      const focusEvent = new FocusEvent('focus');
      window.dispatchEvent(focusEvent);
      document.dispatchEvent(focusEvent);
      if (document.activeElement && document.activeElement.blur) {
        const focusedElement = document.activeElement;
        focusedElement.dispatchEvent(focusEvent);
      }
    }, 0);
  }, true);
  
  // Function to ensure that videos continue to play
  const keepVideosPlaying = () => {
    document.querySelectorAll('video, audio').forEach(media => {
      if (media.paused && !media.ended && media.autoplay !== false) {
        media.play().catch(e => {});
      }
    });
  };
  
  // Check periodically the media that could have been paused
  setInterval(keepVideosPlaying, 1000);
  
  // CSS styles to maintain the active appearance
  const styleElement = document.createElement('style');
  styleElement.textContent = \`
    /* Prevent elements from changing appearance when the window is inactive */
    :root, body, * {
      opacity: 1 !important;
      filter: none !important;
      animation-play-state: running !important;
      transition-property: none important;
    }
    
    /* Ensure that videos and animations keep their full visibility */
    video, audio, canvas, iframe {
      opacity: 1 !important;
    }
    
    /* Remove specific filters that could be applied when inactive */
    *:not(:focus-within) {
      filter: none !important;
    }
  \`;
  document.head.appendChild(styleElement);
  
  console.log('[AlwaysActiveWindow] Module activated');
`;

class MainViewWindow {
  constructor(config) {
    // Define the icon path
    const iconPath = path.join(__dirname, 'logo.ico');

    this.config = config;
    this.views = [];
    this.scrollPosition = { x: 0, y: 0 };
    this.lastScrollUpdateTime = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.viewsVisibility = new Map(); // To keep track of visible views
    this.fullscreenView = null; // To track the fullscreen view
    
    // Define the heights of the control bars from the initialization
    this.titleBarHeight = 30; // Height of the custom title bar
    this.controlBarHeight = 70;
    this.totalControlBarHeight = this.titleBarHeight + this.controlBarHeight;
    this.extraViewSpacing = 8;
    
    // Initialize the number of views per row based on the mode
    this.viewsPerRow = config.mode === 'multiplayer' ? 5 : 4;
    
    // Initialize the synchronization configuration
    this.syncConfig = {
      groups: [],
      lastActive: null
    };
    
    // Initialize the macro manager
    this.macroManager = new MacroManager(this);
    
    // Add a property to track the state of the random movements macro
    this.randomMovementActive = false;
    
    // Add properties to manage the random movements timeouts
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    
    // Add properties to manage the synchronized movements
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    
    this.settingsWindow = null;
    
    // Create the main window
    this.window = new BrowserWindow({
      width: 1600,
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
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Soryns Bot Lobby Manager',
      show: false,
      backgroundColor: '#000000',
      icon: iconPath
    });

    // Load the base page
    this.window.loadFile(path.join(__dirname, '../renderer/main.html'));
    
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.setupBrowserViews();
      this.setupScrollListeners();
      // Initialize a default synchronization group
      this.initDefaultSyncGroup();
    });

    // Handle the window resizing
    this.window.on('resize', () => {
      this.resizeViews();
      this.updateViewsVisibility();
    });
    
    // Configure the IPC handlers
    this.setupIpcHandlers();
    
    // Load the server settings from the localStorage
    this.loadServerSettings();

    // In the constructor, add:
    this.isAppMuted = false;
  }
  
  addBot() {
    const existingIndices = this.views.map(v => v.viewIndex).sort((a, b) => a - b);
    let nextIndex = 0;
    while (existingIndices.includes(nextIndex)) {
      nextIndex++;
    }
    this.createBrowserView(nextIndex);

    // Find the newly created view and add it to the default synchronization group
    const newView = this.views.find(v => v.viewIndex === nextIndex);
    if (newView) {
      newView.isSynchronized = true;
      const defaultGroup = this.syncConfig.groups.find(g => g.id === 'default');
      if (defaultGroup && !defaultGroup.views.includes(nextIndex)) {
        defaultGroup.views.push(nextIndex);
        console.log(`View ${nextIndex} has been added to the default sync group.`);
      }
    }

    // Sort the views by their viewIndex to ensure they are positioned correctly
    this.views.sort((a, b) => a.viewIndex - b.viewIndex);
    
    this.resizeViews();
  }
  
  toggleMute(isMuted) {
    this.isAppMuted = isMuted;
    this.views.forEach(view => {
      view.webContents.setAudioMuted(isMuted);
    });
  }

  toggleRandomMovements(enable) {
    this.macroManager.toggleRandomMovements(enable);
  }

  // Method to load the server settings from the localStorage
  loadServerSettings() {
    console.log('Loading the server settings');
    
    // Par défaut
    global.serverConfig = {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000,
      resolution: '720p'
    };
    
    // Ask the renderer process to retrieve the settings from the localStorage
    this.window.webContents.once('did-finish-load', () => {
      this.window.webContents.executeJavaScript(`
        (function() {
          try {
            const betterXcloudSettings = localStorage.getItem('BetterXcloud');
            if (betterXcloudSettings) {
              console.log('BetterXcloud parameters found:', betterXcloudSettings);
              return betterXcloudSettings;
            }
            return null;
          } catch(err) {
            console.error('Error while retrieving the parameters:', err);
            return null;
          }
        })()
      `).then(result => {
        if (result) {
          try {
            const settings = JSON.parse(result);
            console.log('Loaded parameters:', settings);
            
            // Update the server configuration
            if (settings["server.region"]) {
              global.serverConfig.region = settings["server.region"];
            }
            
            if (settings["server.bypassRestriction"]) {
              global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
            }
            
            // Retrieve the video resolution
            if (settings["stream.video.resolution"]) {
              global.serverConfig.resolution = settings["stream.video.resolution"];
            }
            
            // Retrieve the bitrate values
            if (settings["host.bitrate"]) {
              global.serverConfig.hostBitrate = settings["host.bitrate"];
            }
            
            if (settings["player.bitrate"]) {
              global.serverConfig.playerBitrate = settings["player.bitrate"];
            }
            
            console.log('Server configuration updated:', global.serverConfig);
          } catch (error) {
            console.error('Error while parsing the parameters:', error);
          }
        } else {
          console.log('No BetterXcloud parameters found, using default values');
        }
      }).catch(err => {
        console.error('Error while executing the script to retrieve the parameters:', err);
      });
    });
  }
  
  // Initialize a default synchronization group
  initDefaultSyncGroup() {
    console.log('Initializing the default synchronization group');
    
    // Créer un groupe par défaut avec toutes les vues
    const allViewIndices = this.views.map(view => view.viewIndex);
    
    if (allViewIndices.length > 0) {
      // Créer un nouveau groupe par défaut
      const defaultGroup = {
        id: 'default',
        name: 'Groupe par défaut',
        views: allViewIndices,
        active: true
      };
      
      // Ajouter le groupe à la configuration
      this.syncConfig.groups = [defaultGroup];
      this.syncConfig.lastActive = 'default';
      
      // Marquer toutes les vues comme synchronisées
      this.views.forEach(view => {
        view.isSynchronized = true;
      });
      
      console.log(`Default group created with ${allViewIndices.length} views`);
    } else {
      console.warn('No view available to create a default group');
    }
  }
  
  // Configure the IPC handlers for the communication with the renderer
  setupIpcHandlers() {
    ipcMain.handle('get-initial-config', () => {
      // Return the initial configuration
      return {
        viewCount: this.config.viewCount,
        viewsPerRow: this.viewsPerRow,
        totalControlBarHeight: this.totalControlBarHeight,
        extraViewSpacing: this.extraViewSpacing,
        isAppMuted: this.isAppMuted
      };
    });
    
    ipcMain.on('scroll-position', (event, pos) => {
      this.throttledUpdateViewPositions(pos);
    });
    
    // Handle synchronization requests
    ipcMain.on('synchronize-views', (event, selectedIndices) => {
      this.synchronizeViews(selectedIndices);
    });
    
    // Handler for the 'open-settings' event
    ipcMain.on('open-settings', () => {
      this.openSettings();
    });

    // Add IPC handlers for the new buttons
    ipcMain.on('toggle-random-movements', (event, enable) => {
      this.toggleRandomMovements(enable);
    });
    
    ipcMain.on('toggle-mute', (event, isMuted) => {
      this.toggleMute(isMuted);
    });
    
    // Handler for the 'reload-view' event
    ipcMain.on('reload-view', (event, viewId) => {
      console.log(`Request to reload the view ${viewId}`);
      
      // Check if the view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Reloading the view ${viewId} (${view.viewType} ${view.viewNumber})`);
          view.webContents.reload();
        } else {
          console.log(`The view ${viewId} is not valid or is destroyed`);
        }
      } else {
        console.log(`Invalid view ID: ${viewId}`);
      }
    });
    
    // Handler for the 'toggle-view-fullscreen' event
    ipcMain.on('toggle-view-fullscreen', (event, viewId) => {
      console.log(`Toggle the fullscreen mode for the view ${viewId}`);
      
      // Check if the view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        this.toggleViewFullscreen(view);
      }
    });
    
    ipcMain.on('close-view', (event, viewId) => {
      this.closeView(viewId);
    });
    
    ipcMain.on('add-bot', () => {
      this.addBot();
    });
    
    // Handler for the 'open-view-devtools' event
    ipcMain.on('open-view-devtools', (event, viewId) => {
      console.log(`Opening the DevTools for the view ${viewId}`);
      
      // Check if the view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
    
    // Handler for the 'close-current-window' event
    ipcMain.on('close-current-window', () => {
      console.log('Received request to close the window');
      // Close the settings window if it exists
      if (this.settingsWindow) {
        console.log('Closing the settings window');
        this.settingsWindow.close();
        this.settingsWindow = null;
        
        // Reload the settings and update the existing views
        this.reloadSettingsAndUpdateViews();
      }
    });
    
    // Handler for the 'request-views-state' event
    ipcMain.on('request-views-state', (event) => {
      this.updateSyncPanel();
    });
    
    // Handler for the 'request-macros' event
    ipcMain.on('request-macros', (event, gameMode) => {
      // In a future version, we could load the macros dynamically from a configuration
      // For now, we do nothing because the macros are defined on the client side
      console.log(`Request to load the macros for the mode: ${gameMode}`);
    });
    
    // Handler for the keyboard events
    ipcMain.on('keyboard-event', (event, keyEvent) => {
      // Propagate the keyboard event to the synchronized views
      this.handleKeyboardEvent(keyEvent);
    });

    // In setupIpcHandlers, add:
    ipcMain.on('toggle-app-mute', () => {
      this.isAppMuted = !this.isAppMuted;
      // Mute/unmute all BrowserViews
      this.views.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            document.querySelectorAll('video, audio').forEach(media => { media.muted = ${this.isAppMuted}; });
          `).catch(() => {});
        }
      });
      // Also mute/unmute the main window if needed
      if (this.window && this.window.webContents && !this.window.webContents.isDestroyed()) {
        this.window.webContents.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(media => { media.muted = ${this.isAppMuted}; });
        `).catch(() => {});
      }
      // Notify renderer(s) of the new mute state
      this.window.webContents.send('app-mute-state', this.isAppMuted);
    });

    // Handle view control events
    ipcMain.on('view-control', (event, { action, index }) => {
      // ... existing code ...
    });
  }

  closeView(viewId) {
    const idToClose = parseInt(viewId, 10);
    if (isNaN(idToClose)) {
      console.error(`Invalid viewId to close: ${viewId}`);
      return;
    }

    const indexInArray = this.views.findIndex(v => v.viewIndex === idToClose);

    if (indexInArray === -1) {
      console.error(`Could not find view with viewId ${idToClose} to close.`);
      return;
    }

    const view = this.views[indexInArray];
    if (view) {
      this.window.removeBrowserView(view);
      if (view.controlBar) {
        this.window.removeBrowserView(view.controlBar);
        if (view.controlBar.webContents && !view.controlBar.webContents.isDestroyed()) {
          view.controlBar.webContents.destroy();
        }
      }
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
      this.views.splice(indexInArray, 1);
      this.viewsVisibility.delete(idToClose);
      
      this.resizeViews();
    }
  }

  // Ajouter cette méthode pour vérifier si une vue est visible
  isViewVisible(view) {
    // Check if the view exists in our collection
    const index = this.views.indexOf(view);
    if (index === -1) return false;
    
    // Use the visibility map to determine if the view is visible
    return this.viewsVisibility.get(index) === true;
  }

  // Improve the stopRandomMovements method to stop all movements
  stopRandomMovements() {
    console.log('Stopping all random movements');
    
    // Disable the flag of the macro
    this.randomMovementActive = false;
    
    // Stop all synchronized movements
    this.stopAllSynchronizedMovements();
    
    console.log('All random movements have been stopped successfully');
  }

  // Improved method to synchronize the views with management of the movements state
  synchronizeViews(selectedIndices) {
    // Save the currently synchronized views for comparison
    const previouslySynchronized = this.views.filter(v => v.isSynchronized).map(v => v.viewIndex);
    
    // Reset the synchronization state
    this.views.forEach(view => {
      view.isSynchronized = false;
    });

    // Mark the selected views as synchronized
    selectedIndices.forEach(index => {
      const view = this.views.find(v => v.viewIndex === index);
      if (view) {
        view.isSynchronized = true;
      }
    });

    // Update the synchronization configuration
    if (selectedIndices.length > 0) {
      const existingDefaultGroup = this.syncConfig.groups.find(g => g.id === 'default');
      
      if (existingDefaultGroup) {
        // Update the existing group
        existingDefaultGroup.views = selectedIndices;
        existingDefaultGroup.active = true;
      } else {
        // Create a new group
        const newGroup = {
          id: 'default',
          name: 'Default group',
          views: selectedIndices,
          active: true
        };
        
        // Reset the groups and add the new one
        this.syncConfig.groups = [newGroup];
        this.syncConfig.lastActive = 'default';
      }
    }
    
    // If the random movements macro is active
    if (this.randomMovementActive) {
      // Find the views that have been desynchronized
      const desynchronizedViews = previouslySynchronized.filter(index => !selectedIndices.includes(index));
      
      // Stop the movements in these specific views
      desynchronizedViews.forEach(index => {
        const view = this.views.find(v => v.viewIndex === index);
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Stopping the movements for the desynchronized view ${view.viewNumber}`);
          view.webContents.executeJavaScript(`
            if (typeof window.clearRandomMovements === 'function') {
              window.clearRandomMovements();
              console.log('Movements stopped due to desynchronization');
            }
          `).catch(err => {
            console.log(`Error while stopping the movements in the view ${view.viewNumber}:`, err.message);
          });
        }
      });
      
      // If new views have been synchronized
      const newlySynchronized = selectedIndices.filter(index => !previouslySynchronized.includes(index));
      
      if (newlySynchronized.length > 0) {
        console.log(`${newlySynchronized.length} new views synchronized, injecting the current movement state`);
        
        // Inject the current movement state in the new views
        newlySynchronized.forEach(index => {
          const view = this.views.find(v => v.viewIndex === index);
          if (view) {
            this.injectCurrentMovementState(view);
          }
        });
      }
    }

    this.updateSyncPanel();
  }
  
  // Method to stop all movements in all views
  stopAllSynchronizedMovements() {
    console.log('Stopping all synchronized movements');
    
    // Stop the central controller
    this.centralMovementController.isRunning = false;
    
    // Clean all central timeouts
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Clean other timeouts and intervals
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Reset the controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Stop the movements in each view
    const synchronizedViews = this.getAllSynchronizedViews();
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.executeJavaScript(`
          if (typeof window.clearRandomMovements === 'function') {
            window.clearRandomMovements();
          }
        `).catch(() => {});
      }
    });
    
    // Release all keys in each view
    this.views.forEach(view => this.releaseAllKeysInView(view));
  }
  
  // Method to release all keys in a view
  releaseAllKeysInView(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return;
    }
    
    try {
      const releaseScript = `
        (function() {
          try {
            console.log('Relâchement de toutes les touches');
            
            // List of all keys to release (in QWERTY)
            const keysToRelease = ['w', 'a', 's', 'd', ' '];
            
            // Create and dispatch the keyup events for each key
            keysToRelease.forEach(key => {
              try {
                if (window.releaseKey) {
                  window.releaseKey(key);
                } else {
                  const code = key === ' ' ? 'Space' : 'Key' + key.toUpperCase();
                  const keyCode = key === ' ' ? 32 : key.toUpperCase().charCodeAt(0);
                  
                  const keyEvent = new KeyboardEvent('keyup', {
                    key: key,
                    code: code,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  
                  document.dispatchEvent(keyEvent);
                }
              } catch (keyErr) {
                console.error('Error while releasing ' + key + ':', keyErr);
              }
            });
            
            if (window._gameKeyHandlers && typeof window._gameKeyHandlers.clearAllKeys === 'function') {
              window._gameKeyHandlers.clearAllKeys();
            }
            
            return "All keys released";
          } catch (e) {
            console.error('General error while releasing the keys:', e);
            return "Error: " + e.message;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(releaseScript).catch(() => {});
    } catch (e) {
      console.error(`General error for the view ${view.viewNumber}:`, e);
    }
  }
  
  // Method to inject the current movement state in a newly synchronized view
  injectCurrentMovementState(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Injecting the current movement state in the view ${view.viewNumber}`);
    
    // If the central controller is already running, inject the script with the current state
    if (this.centralMovementController.isRunning) {
      const currentState = JSON.stringify({
        lastDirection: this.centralMovementController.lastDirection,
        recentMoves: this.centralMovementController.recentMoves,
        currentIndex: this.centralMovementController.currentIndex
      });
      
      const initScript = `
        window.SYNC_STATE = ${currentState};
        console.log('Synchronization state received:', window.SYNC_STATE);
      `;
      
      view.webContents.executeJavaScript(initScript)
        .then(() => {
          // Once the state is injected, start the movement script
          this.executeDirectMovementScript(view, true);
        })
        .catch(err => {
          console.error(`Error while injecting the state in the view ${view.viewNumber}:`, err);
          // If there is an error, try to start the script without state
          this.executeDirectMovementScript(view, false);
        });
    } else {
      // If the controller is not running, simply start the script
      this.executeDirectMovementScript(view, false);
    }
  }
  
  // Improved method to execute a direct movement script with synchronization
  executeDirectMovementScript(view, joinExisting = false) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Execution of a movement script for the view ${view.viewNumber}${joinExisting ? ' (joining an existing sequence)' : ''}`);
    
    // Complete script of random movements to inject into the view, modified to use synchronized movements
    const scriptContents = `
      (function() {
        console.log("Starting the synchronized movements script");
        
        // Constants and variables - in QWERTY (WASD)
        const KEYS = {
          FORWARD: 'w',    // Forward (W in QWERTY)
          LEFT: 'a',       // Left (A in QWERTY)
          BACKWARD: 's',   // Backward (S in QWERTY)
          RIGHT: 'd',      // Right (D in QWERTY)
          JUMP: ' '        // Jump (Space)
        };
        
        // Directions possibles
        const DIRECTIONS = [
          [KEYS.FORWARD],     // Forward
          [KEYS.LEFT],        // Left
          [KEYS.BACKWARD],    // Backward
          [KEYS.RIGHT],       // Right
          [KEYS.FORWARD, KEYS.LEFT],  // Forward-left
          [KEYS.FORWARD, KEYS.RIGHT], // Forward-right
          [KEYS.BACKWARD, KEYS.LEFT], // Backward-left
          [KEYS.BACKWARD, KEYS.RIGHT] // Backward-right
        ];
        
        // Local state variables
        let isRunning = true;
        const timeoutIds = [];
        
        // Get the synchronized state if it exists
        const syncState = window.SYNC_STATE || { 
          lastDirection: null,
          recentMoves: [],
          currentIndex: 0
        };
        
        console.log("Initial state:", syncState);
        
        // Function to send the state to the main process
        function sendStateToMain(state) {
          if (window.electronAPI && window.electronAPI.updateMovementState) {
            window.electronAPI.updateMovementState(state);
          }
        }
        
        // Function to receive the state from the main process
        function listenForStateUpdates() {
          if (window.electronAPI && window.electronAPI.onMovementStateUpdate) {
            window.electronAPI.onMovementStateUpdate((state) => {
              Object.assign(syncState, state);
              console.log("State updated from the main process:", syncState);
            });
          }
        }
        
        // Function to press a key
        function pressKey(key) {
          if (!isRunning) return false;
          try {
            console.log('Pressing ' + key);
            
            if (window.pressKey) {
              return window.pressKey(key);
            } else {
              const event = new KeyboardEvent('keydown', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Error while pressing ' + key, e);
            return false;
          }
        }
        
        // Function to release a key
        function releaseKey(key) {
          try {
            console.log('Releasing ' + key);
            
            if (window.releaseKey) {
              return window.releaseKey(key);
            } else {
              const event = new KeyboardEvent('keyup', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Error while releasing ' + key, e);
            return false;
          }
        }
        
        // Fonction pour recevoir et exécuter une action de mouvement
        window.executeMovementAction = function(action) {
          // Wrap in a promise that resolves immediately
          return new Promise((resolve, reject) => {
            try {
              if (!isRunning) {
                console.log('Impossible to execute the action: script stopped');
                resolve(false);
                return;
              }
              
              console.log('Executing the action:', action);
              
              // If it's a jump
              if (action.type === 'jump') {
                const success = pressKey(KEYS.JUMP);
                
                if (success) {
                  const jumpReleaseId = setTimeout(() => {
                    releaseKey(KEYS.JUMP);
                  }, action.duration || 200);
                  
                  timeoutIds.push(jumpReleaseId);
                  resolve(true);
                } else {
                  console.error('Failed to press space');
                  resolve(false);
                }
                return;
              }
              
              // If it's a directional movement
              if (action.type === 'move') {
                // Apply all direction keys
                const allPressed = action.keys.every(key => pressKey(key));
                
                if (allPressed) {
                  // Schedule the release
                  const releaseId = setTimeout(() => {
                    // Release all keys
                    action.keys.forEach(key => releaseKey(key));
                    
                    // If correction is needed
                    if (action.correction) {
                      setTimeout(() => {
                        const correctionPressed = pressKey(action.correction);
                        
                        if (correctionPressed) {
                          const correctionReleaseId = setTimeout(() => {
                            releaseKey(action.correction);
                          }, action.correctionDuration || 300);
                          
                          timeoutIds.push(correctionReleaseId);
                        }
                      }, 30);
                    }
                  }, action.duration || 200);
                  
                  timeoutIds.push(releaseId);
                  resolve(true);
                } else {
                  console.error('Failed to press some keys');
                  resolve(false);
                }
                return;
              }
              
              console.error('Unrecognized action type:', action.type);
              resolve(false);
            } catch (error) {
              console.error('Error while executing the action:', error);
              reject(error);
            }
          });
        };
        
        // Function to stop all movements
        window.clearRandomMovements = function() {
          isRunning = false;
          
          // Clean all timeouts
          timeoutIds.forEach(id => clearTimeout(id));
          timeoutIds.length = 0;
          
          // Release all possible keys
          Object.values(KEYS).forEach(key => {
            releaseKey(key);
          });
          
          console.log('Random movements stopped');
        };
        
        // Initialize the state update listening
        listenForStateUpdates();
        
        // If we join an existing sequence, we don't need to start the jumps
        if (${joinExisting}) {
          console.log("Join the existing sequence without starting new movements");
        }
        
        return "Synchronized movements script started";
      })();
    `;
    
    // Execute the script in the view
    view.webContents.executeJavaScript(scriptContents)
      .then(result => {
        console.log(`Result of the script for view ${view.viewNumber}:`, result);
        
        // If it's a new sequence (no joinExisting), start the central sequence if it's not already started
        if (!joinExisting && this.centralMovementController.isRunning && this.centralMovementController.currentIndex === 0) {
          this.startCentralMovementSequence();
        }
      })
      .catch(err => {
        console.error(`Error while executing the script for view ${view.viewNumber}:`, err);
      });
  }
  
  // Method to execute the initial jump sequence
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Execution of the jump ${jumpIndex+1}/3`);
    
    // Send the jump command to all synchronized views
    const jumpAction = {
      type: 'jump',
      duration: 200
    };
    
    this.executeActionOnAllSynchronizedViews(jumpAction);
    
    // Continue with the next jump or pass to random movements
    if (jumpIndex < 2) {
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 500);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Pass to random movements after the 3 jumps
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }
  
  // Method to execute a random movement
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Possible directions (like in the injected script) - in QWERTY (WASD)
    const directions = [
      ['w'],     // Forward (W in QWERTY)
      ['a'],     // Left (A in QWERTY)
      ['s'],     // Backward (S in QWERTY)
      ['d'],     // Right (D in QWERTY)
      ['w', 'a'], // Forward-left
      ['w', 'd'], // Forward-right
      ['s', 'a'], // Backward-left
      ['s', 'd']  // Backward-right
    ];
    
    const maxRecentMoves = 5;
    
    try {
      // 1. Choose a direction, avoiding the last used one
      const availableDirections = directions.filter(dir => 
        !this.centralMovementController.lastDirection || 
        JSON.stringify(dir) !== JSON.stringify(this.centralMovementController.lastDirection)
      );
      
      // Avoid also recent movements
      const nonRecentDirections = availableDirections.filter(dir => 
        !this.centralMovementController.recentMoves.some(recent => JSON.stringify(dir) === JSON.stringify(recent)))
      
      // Use non recent directions if possible, otherwise all available directions
      const directionPool = nonRecentDirections.length > 0 ? nonRecentDirections : availableDirections;
      
      let directionKeys = directionPool[Math.floor(Math.random() * directionPool.length)];
      
      // 2. Determine the duration of the movement (between 50ms and 1500ms)
      let duration = Math.floor(Math.random() * 1450 + 50);
      
      // 3. If the forward movement ('w') is chosen, 50% chance to replace it with backward ('s')
      let correctionKey = null;
      let correctionDuration = 0;
      
      if (directionKeys.includes('w') && Math.random() < 0.5) {
        // Pass to 's' and increase the duration slightly
        directionKeys = ['s'];
        duration += Math.floor(Math.random() * 300 + 200); // +200-500ms
        
        // Add a correction 'w'
        correctionKey = 'w';
        correctionDuration = duration + 100; // +0.1s
      }
      
      // 4. Create the action
      const moveAction = {
        type: 'move',
        keys: directionKeys,
        duration: duration,
        correction: correctionKey,
        correctionDuration: correctionDuration
      };
      
      // 5. Execute the action on all synchronized views
      this.executeActionOnAllSynchronizedViews(moveAction);
      
      // 6. Update the history of movements
      this.centralMovementController.recentMoves.push(directionKeys);
      if (this.centralMovementController.recentMoves.length > maxRecentMoves) {
        this.centralMovementController.recentMoves.shift();
      }
      this.centralMovementController.lastDirection = directionKeys;
      
      // 7. Schedule the next movement with a random delay (500-1000ms)
      const totalDuration = duration + (correctionKey ? 30 + correctionDuration : 0);
      const nextDelay = totalDuration + Math.floor(Math.random() * 500 + 500);
      
      const timerId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(timerId);
      
    } catch (error) {
      console.error('Error in the central random movement:', error);
      
      // In case of error, try to continue after a delay
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }
  
  // Method to start and control the central movement sequence
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Starting the central movement sequence');
    
    // Reset the controller state
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Start with 3 jumps
    this.executeJumpSequence(0);
  }

  // Execute an action on all synchronized views
  executeActionOnAllSynchronizedViews(action) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Convert the action to JSON and escape special characters
          const actionJSON = JSON.stringify(action).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          
          // Secure script that ensures executeMovementAction is available
          const safeScript = `
            (function() {
              try {
                if (typeof window.executeMovementAction === 'function') {
                  return window.executeMovementAction(${actionJSON});
                } else {
                  console.error('executeMovementAction is not available in this view');
                  return false;
                }
              } catch (err) {
                console.error('Error while executing the action:', err);
                return false;
              }
            })();
          `;
          
          // Execute the script securely
          view.webContents.executeJavaScript(safeScript)
            .then(result => {
              if (!result) {
                console.log(`Action not executed in view ${view.viewNumber}, function not available`);
              }
            })
            .catch(err => {
              console.error(`Error while executing the action in view ${view.viewNumber}:`, err);
            });
        } catch (e) {
          console.error(`Error while preparing the action for view ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Add a method to open the synchronization panel
  openSyncPanel() {
    if (this.syncWindow) {
      this.syncWindow.focus();
      return;
    }

    // Get the dimensions of the main screen
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculate the width based on the resolution
    // 350px for 1920px wide (1080p)
    const panelWidth = Math.round((350 * screenWidth) / 1920);
    
    // Fixed height for the panel
    const panelHeight = 800;

    this.syncWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Synchronization Panel',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'syncPanelPreload.js')
      }
    });

    this.syncWindow.loadFile(path.join(__dirname, '../renderer/syncPanel.html'));

    this.syncWindow.on('closed', () => {
      this.syncWindow = null;
    });

    // Update the panel when the state changes
    this.updateSyncPanel();
  }

  // Add a method to open the macro panel
  openMacroPanel() {
    if (this.macroWindow) {
      this.macroWindow.focus();
      return;
    }

    // Get the dimensions of the main screen
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculate the width based on the resolution
    const panelWidth = Math.round((400 * screenWidth) / 1920);
    
    // Fixed height for the panel
    const panelHeight = 600;

    this.macroWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Macro Panel',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'macroPanelPreload.js')
      }
    });

    // Pass the current game mode in the URL parameters
    this.macroWindow.loadFile(path.join(__dirname, '../renderer/macroPanel.html'), {
      query: { mode: this.config.mode }
    });

    this.macroWindow.on('closed', () => {
      this.macroWindow = null;
    });
  }

  // Add a method to open the settings page
  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    // Get the dimensions of the main screen
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculate the width based on the resolution
    const panelWidth = Math.round((500 * screenWidth) / 1920);
    
    // Fixed height for the panel
    const panelHeight = 650;

    this.settingsWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'VPN/Video Settings',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  // Update the synchronization panel data
  updateSyncPanel() {
    if (this.syncWindow && !this.syncWindow.isDestroyed()) {
      const viewsData = {
        viewsPerRow: this.viewsPerRow,
        views: this.views.map((view, index) => ({
          index: view.viewIndex,
          type: view.viewType,
          number: view.viewNumber,
          isSynchronized: view.isSynchronized
        }))
      };

      this.syncWindow.webContents.send('views-update', viewsData);
    }
  }

  // Method to update the status of a macro in the control bar
  updateControlBarMacroStatus(macroNumber, isActive) {
    if (this.macroWindow && !this.macroWindow.isDestroyed()) {
      this.macroWindow.webContents.send('macro-status-changed', { macroNumber, isActive });
    }
  }

  // Method to get all synchronized views
  getAllSynchronizedViews() {
    return this.views.filter(view => view.isSynchronized && view.webContents && !view.webContents.isDestroyed());
  }
  
  // Throttled update of view positions
  throttledUpdateViewPositions = throttle((position) => {
    const now = Date.now();
    
    // If the scrolling is very fast (less than 16ms between events), limit the frequency
    if (now - this.lastScrollUpdateTime < 16) {
      return;
    }
    
    this.lastScrollUpdateTime = now;
    this.scrollPosition = position;
    this.updateViewPositions();
    
    // Indicate that we are scrolling
    this.isScrolling = true;
    
    // Reset the scrolling timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // After 150ms without scrolling, consider the scrolling as finished
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.updateViewsVisibility(); // Update the visibility of the views once the scrolling is finished
    }, 150);
  }, 16);
  
  // Handle scrolling by the mouse wheel
  handleWheelScroll(delta) {
    // Calculate the new scrolling position
    const newY = Math.max(0, this.scrollPosition.y + delta.y);
    const maxScroll = this.calculateMaxScrollOffset();
    
    // Limit the scrolling position to the maximum
    this.scrollPosition.y = Math.min(newY, maxScroll);
    
    // Update the positions of the views
    this.throttledUpdateViewPositions(this.scrollPosition);
  }
  
  // Handle keyboard scrolling
  handleKeyboardScroll(data) {
    const { key, amount } = data;
    const step = amount || 50; // Default step
    
    if (key === 'ArrowDown' || key === 'PageDown') {
      const newY = Math.min(this.scrollPosition.y + step, this.calculateMaxScrollOffset());
      this.scrollPosition.y = newY;
    } else if (key === 'ArrowUp' || key === 'PageUp') {
      const newY = Math.max(0, this.scrollPosition.y - step);
      this.scrollPosition.y = newY;
    } else if (key === 'Home') {
      this.scrollPosition.y = 0;
    } else if (key === 'End') {
      this.scrollPosition.y = this.calculateMaxScrollOffset();
    }
    
    this.throttledUpdateViewPositions(this.scrollPosition);
  }

  // Configurer les écouteurs de défilement directs depuis la fenêtre principale
  setupScrollListeners() {
    console.log('Configuration of the scroll listeners on the main window');
    
    // Listen to the mouse wheel events on the main window
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'mouseWheel') {
        console.log('Direct mouseWheel event:', input.deltaY);
        const scrollAmount = input.deltaY * 3; // Multiplier for faster scrolling
        
        // Send the scrolling event via the throttling system
        this.handleWheelScroll({ 
          x: 0, 
          y: scrollAmount 
        });
        
        event.preventDefault();
      } else if (input.type === 'keyDown') {
        // Handle navigation keys
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(input.key)) {
          console.log('KeyDown event for navigation:', input.key);
          let amount = 50; // Standard amount
          
          if (input.key === 'PageDown' || input.key === 'PageUp') {
            amount = 200; // Not greater for Page Up/Down
          }
          
          this.handleKeyboardScroll({
            key: input.key,
            amount: amount
          });
          
          event.preventDefault();
        }
      }
    });
    
    // Communicate the container size to the renderer
    this.window.webContents.on('did-finish-load', () => {
      console.log('Window loaded, updating the container size');
      this.updateContainerSize();
    });
  }

  // Calculate and communicate the container size
  updateContainerSize() {
    const numViews = this.views.length;
    const totalHeight = this.calculateTotalContentHeight();
    
    console.log(`Updating the container size: ${totalHeight}px for ${numViews} views`);
    
    // Send the size to the renderer to configure the scrolling area
    this.window.webContents.send('set-container-size', {
      width: this.window.getContentBounds().width,
      height: totalHeight
    });
  }

  // Calculate the total content height
  calculateTotalContentHeight() {
    const numRows = Math.ceil(this.views.length / this.viewsPerRow);
    return numRows * (this.viewHeight + this.viewMargin) + this.totalControlBarHeight + this.extraViewSpacing;
  }

  // Method to update the positions of the views
  updateViewPositions() {
    this.views.forEach((view, index) => {
      this.positionView(view, index);
    });
    
    // Update the visibility of the views if we are not scrolling
    if (!this.isScrolling) {
      this.updateViewsVisibility();
    }
  }
  
  // Determine which views are visible and optimize their display
  updateViewsVisibility() {
    const { height } = this.window.getContentBounds();
    const visibleTop = this.scrollPosition.y;
    const visibleBottom = visibleTop + height;
    
    // Preload margin (200px before and after the visible area)
    const bufferSize = 200;
    const expandedTop = Math.max(0, visibleTop - bufferSize);
    const expandedBottom = visibleBottom + bufferSize;
    
    this.views.forEach((view, index) => {
      const row = Math.floor(index / this.viewsPerRow);
      const viewTop = this.totalControlBarHeight + this.extraViewSpacing + (row * (this.viewHeight + this.viewMargin));
      const viewBottom = viewTop + this.viewHeight;
      
      // Check if the view is in the extended visible area
      const isVisible = (viewBottom >= expandedTop && viewTop <= expandedBottom);
      
      // If the visibility state has changed
      if (this.viewsVisibility.get(view.viewIndex) !== isVisible) {
        if (isVisible) {
          // The view has become visible
          this.positionView(view, index);
        } else {
          // The view is no longer visible, move it off screen
          view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
          
          // Also move the control bar off screen
          if (view.controlBar) {
            view.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
          }
        }
        
        // Update the visibility state
        this.viewsVisibility.set(view.viewIndex, isVisible);
      }
    });
  }

  // Calculate the maximum scroll offset
  calculateMaxScrollOffset() {
    const { height } = this.window.getContentBounds();
    const totalHeight = this.calculateTotalContentHeight();
    return Math.max(0, totalHeight - height);
  }

  setupBrowserViews() {
    const { mode, viewCount } = this.config;
    const viewsPerRow = mode === 'multiplayer' ? 5 : 4;
    
    // Calculate the dimensions of the BrowserViews
    this.calculateViewDimensions(viewsPerRow, viewCount);
    
    // Create the BrowserViews
    for (let i = 0; i < viewCount; i++) {
      this.createBrowserView(i);
      // Initialize all views as not visible
      this.viewsVisibility.set(i, false);
    }
    
    // Initial update of the visibility
    this.updateViewsVisibility();
    
    // Update the container size
    this.updateContainerSize();
    
    // Create the context menu
    this.setupContextMenu();
    
    // Handle mouse clicks to activate the BrowserViews
    this.window.on('click', (event) => {
      // Browse all visible views
      for (let i = 0; i < this.views.length; i++) {
        if (this.viewsVisibility.get(this.views[i].viewIndex) === true) {
          const view = this.views[i];
          const bounds = view.getBounds();
          
          // Check if the click is within the bounds of this view
          if (event.x >= bounds.x && event.x <= bounds.x + bounds.width &&
              event.y >= bounds.y && event.y <= bounds.y + bounds.height) {
            
            // Focus this view
            this.window.setTopBrowserView(view);
            view.webContents.focus();
            
            // Send the click event to the view
            view.webContents.sendInputEvent({
              type: 'mouseDown',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            view.webContents.sendInputEvent({
              type: 'mouseUp',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            // Stop the propagation if we found a view that matches
            return;
          }
        }
      }
    });
  }
  
  calculateViewDimensions(viewsPerRow, viewCount) {
    if (viewCount === 0) {
      this.viewWidth = 0;
      this.viewHeight = 0;
      return;
    }
    const { width, height } = this.window.getContentBounds();
    // The control bar heights are already defined in the constructor
    
    // Define the margins
    this.horizontalMargin = Math.floor(width * 0.05); // 5% of margin on each side
    this.viewMargin = 10; // 10px margin between views
    
    // Determine the number of lines needed
    const rows = Math.ceil(viewCount / viewsPerRow);
    
    // Calculate the available space after the lateral margins
    const availableWidth = width - (this.horizontalMargin * 2);
    // Calculate the width of each view considering the margins between views
    const totalViewMargins = (viewsPerRow - 1) * this.viewMargin;
    this.viewWidth = Math.floor((availableWidth - totalViewMargins) / viewsPerRow);
    
    // Calculate the height to maintain a 16:9 ratio (width / 16 * 9)
    this.viewHeight = Math.floor(this.viewWidth / 16 * 9);
    
    // Always maintain the 16:9 ratio, even if the views exceed the window
    this.rows = rows;
    this.viewsPerRow = viewsPerRow;
  }

  createBrowserView(index) {
    // Define the partition according to the mode
    const partition = this.config.mode === 'cdl' 
      ? `persist:cdl-profile-${index}` 
      : `persist:view-${index}`;
      
    // Determine the type of view (host/player) and the synchronization state
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    const isHost = col === 0; // The first view of each line is a host
    const viewType = isHost ? 'host' : 'player';
    const viewNumber = isHost ? row + 1 : (row * (this.viewsPerRow - 1)) + col;
      
    // Create a new BrowserView
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'betterxcloudpreload.js'),
        partition: partition // Independent sessions with specific profile for CDL
      }
    });
    
    // Disable auto-resize to avoid focus and mouse problems
    view.setAutoResize({ width: false, height: false });
    
    // Define the properties of type and synchronization
    view.viewType = viewType;      // 'host' or 'player'
    view.viewNumber = viewNumber;  // View number (1-N)
    view.isSynchronized = false;   // By default, views are not synchronized
    view.viewIndex = index;        // Keep the index for reference
    
    this.window.addBrowserView(view);
    this.views.push(view);
    
    // Position the view
    this.positionView(view, index);
    
    // Create the control bar for this view
    this.createViewControlBar(view, index);
    
    // Before loading the URL, configure the bitrate parameters according to the type of view
    view.webContents.on('did-finish-load', () => {
      // Check if server parameters have been defined
      const serverConfig = global.serverConfig || {
        region: 'default',
        bypassRestriction: 'off',
        hostBitrate: 5000000,
        playerBitrate: 500000,
        resolution: '720p'
      };
      
      // Determine the correct bitrate according to the type of view
      const bitrate = viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
      
      // Send the configuration to the view
      view.webContents.send('server-config', {
        region: serverConfig.region,
        bitrate: bitrate,
        bypassRestriction: serverConfig.bypassRestriction,
        resolution: serverConfig.resolution
      });
      
      console.log(`Vue ${viewNumber} (${viewType}) - Configuration: bitrate=${bitrate}, region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, resolution=${serverConfig.resolution}`);
      
      // Inject directly a script to configure the Better X Cloud parameters
      const script = `
        (function() {
          try {
            console.log("Direct configuration of the parameters for view ${viewType}");
            
            // Get the current parameters or create a new object
            let settings = {};
            try {
              const existingSettings = localStorage.getItem("BetterXcloud");
              if (existingSettings) {
                settings = JSON.parse(existingSettings);
              }
            } catch (e) {
              console.error("Error while retrieving the parameters:", e);
            }
            
            // Inject the pressKey and releaseKey functions for the macros
            window.pressKey = function(key) {
              console.log("PressKey called for:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keydown', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Erreur pressKey:", e);
                return false;
              }
            };
            
            window.releaseKey = function(key) {
              console.log("ReleaseKey appelé pour:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keyup', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Erreur releaseKey:", e);
                return false;
              }
            };
            
            // Apply the parameters
            settings["server.region"] = "${serverConfig.region}";
            settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
            settings["stream.video.maxBitrate"] = ${bitrate};
            settings["stream.video.resolution"] = "${serverConfig.resolution}";
            
            // Store the reference values
            settings["host.bitrate"] = ${serverConfig.hostBitrate};
            settings["player.bitrate"] = ${serverConfig.playerBitrate};
            
            // Save the parameters
            localStorage.setItem("BetterXcloud", JSON.stringify(settings));
            
            console.log("View ${viewType} - Configured parameters:", {
              type: "${viewType}",
              bitrate: ${bitrate},
              region: "${serverConfig.region}",
              resolution: "${serverConfig.resolution}"
            });
            
            return true;
          } catch (error) {
            console.error("Error while configuring the parameters:", error);
            return false;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(script)
        .then(result => {
          console.log(`Configuration of the BetterXcloud parameters for view ${viewNumber} (${viewType}): ${result ? 'successful' : 'failed'}`);
        })
        .catch(error => {
          console.error(`Error while configuring the parameters for view ${viewNumber}:`, error);
        });
      
      // Inject the FullScreen Spoofer script
      view.webContents.executeJavaScript(FullScreenSpooferScript)
        .then(() => {
          console.log(`FullScreen Spoofer injected in view ${index}`);
        })
        .catch(err => {
          console.error(`Error while injecting the FullScreen Spoofer in view ${index}:`, err);
        });
        
      // Inject the AlwaysActiveWindow script
      this.injectAlwaysActiveWindow(view, index);
    });
    
    // Load xbox.com/EN-US/play
    view.webContents.loadURL('https://www.xbox.com/en-US/play/launch/call-of-duty-black-ops-6---cross-gen-bundle/9PF528M6CRHQ');
    
    // Open the DevTools in detached mode for each view
    //view.webContents.openDevTools({ mode: 'detach' });
  }

  // Create an HTML control bar for each BrowserView
  createViewControlBar(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Determine the type of label (Host for the first view of each line, Bot for the others)
    const isFirstInRow = col === 0;
    
    // Calculate the host or bot number
    const hostNumber = row + 1; // The host number is based on the line (starts at 1)
    
    // For the bots, maintain a global numbering from 1 to N
    let botNumber = 1;
    if (!isFirstInRow) {
      // Calculate the global bot number
      // For each line, there are (viewsPerRow - 1) bots
      // Example: if viewsPerRow = 5, then line 0 = bots 1-4, line 1 = bots 5-8, etc.
      botNumber = (row * (this.viewsPerRow - 1)) + col;
    }
    
    const label = isFirstInRow ? `Host ${hostNumber}` : `Bot ${botNumber}`;
    
    // Create a BrowserView for the control bar with the preload
    const controlBar = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'viewControlBarPreload.js')
      }
    });
    
    this.window.addBrowserView(controlBar);
    
    // Load the HTML file of the control bar with the label and the view ID as parameters
    controlBar.webContents.loadFile(
      path.join(__dirname, '../renderer/viewControlBar.html'),
      { search: `label=${encodeURIComponent(label)}&viewId=${view.viewIndex}` }
    );
    
    // Store the reference to this control bar with the parent view
    view.controlBar = controlBar;
    
    // Position the control bar
    this.positionViewControlBar(view, index);
  }
  
  // Position the control bar of a view
  positionViewControlBar(view, index) {
    if (!view.controlBar) return;
    
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculate the x position considering the margins
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculate the y position considering the margins between views and the scrolling
    const y = this.totalControlBarHeight + this.extraViewSpacing + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // Height of the control bar
    const controlBarHeight = 28;
    
    // Position the control bar above the view
    view.controlBar.setBounds({ 
      x, 
      y: Math.max(this.totalControlBarHeight, y), 
      width: this.viewWidth, 
      height: controlBarHeight 
    });
  }

  positionView(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculate the x position considering the margins
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculate the y position considering the margins between views and the scrolling
    let y = this.totalControlBarHeight + this.extraViewSpacing + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // Height of the view control bar
    const viewControlBarHeight = 28;
    
    // Ensure that the views do not exceed the control bars
    // If y is negative, it means that the view is above the control bars
    if (y < this.totalControlBarHeight) {
      // Cut the part that exceeds in the control bars
      const visibleHeight = this.viewHeight - (this.totalControlBarHeight - y);
      
      // Only show the visible part of the view below the control bars
      if (visibleHeight > 0) {
        view.setBounds({ 
          x, 
          y: this.totalControlBarHeight + viewControlBarHeight, 
          width: this.viewWidth, 
          height: visibleHeight - viewControlBarHeight 
        });
      } else {
        // If the view is completely hidden, place it off screen
        view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
      }
    } else {
      // Normal position if the view is completely below the control bars
      view.setBounds({ 
        x, 
        y: y + viewControlBarHeight, 
        width: this.viewWidth, 
        height: this.viewHeight - viewControlBarHeight 
      });
    }
    
    // Position also the control bar of the view
    this.positionViewControlBar(view, index);
  }

  resizeViews() {
    // Recalculate the dimensions
    this.calculateViewDimensions(this.viewsPerRow, this.views.length);
    
    // Update the container size
    this.updateContainerSize();
    
    // Adjust the current scrolling if necessary
    const maxScroll = this.calculateMaxScrollOffset();
    if (this.scrollPosition.y > maxScroll) {
      this.scrollPosition.y = maxScroll;
    }
    
    // Reposition all views
    this.updateViewPositions();
  }

  // Function to inject the "Always Active Window" functionality
  injectAlwaysActiveWindow(view, index) {
    view.webContents.executeJavaScript(AlwaysActiveWindowScript)
      .then(() => {
        console.log(`AlwaysActiveWindow injected in view ${index}`);
      })
      .catch(err => {
        console.error(`Error while injecting the AlwaysActiveWindow in view ${index}:`, err);
      });
  }

  // Add the setupContextMenu method
  setupContextMenu() {
    const { Menu } = require('electron');
    
    // Define the context menu template
    this.contextMenuTemplate = [
      {
        label: 'Reload all views',
        click: () => {
          this.views.forEach(view => {
            if (view.webContents) {
              view.webContents.reload();
            }
          });
        }
      },
      {
        label: 'Refresh the layout',
        click: () => {
          this.resizeViews();
        }
      },
      { type: 'separator' },
      {
        label: 'Synchronization panel',
        click: () => {
          this.openSyncPanel();
        }
      },
      {
        label: 'Macro panel',
        click: () => {
          this.openMacroPanel();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.openSettings();
        }
      }
    ];
    
    // Create the context menu
    const contextMenu = Menu.buildFromTemplate(this.contextMenuTemplate);
    
    // Attach the context menu to the main window
    this.window.webContents.on('context-menu', (_, params) => {
      contextMenu.popup({ window: this.window });
    });
  }

  // Method to propagate the movement state to other views
  propagateMovementState(state, excludeView) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      // Do not send the state to the view that generated it
      if (view !== excludeView && view.webContents && !view.webContents.isDestroyed()) {
        try {
          view.webContents.send('movement-state-update', state);
        } catch (e) {
          console.error(`Error while propagating the state to view ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Gestionnaire d'événements clavier
  handleKeyboardEvent(keyEvent) {
    // Get all synchronized views
    const synchronizedViews = this.getAllSynchronizedViews();
    
    if (synchronizedViews.length === 0) {
      console.log('No synchronized views to transmit the keyboard events');
      return;
    }
    
    console.log(`Transmission of a keyboard event ${keyEvent.type} (key: ${keyEvent.key})`);
    
    // Function to get the correct code for a key
    const getKeyCode = (key) => {
      if (key === ' ') return 'Space';
      if (key === 'Escape') return 'Escape';
      if (key === 'Shift') return 'ShiftLeft';
      if (key === 'Control') return 'ControlLeft';
      if (key === 'Alt') return 'AltLeft';
      if (key === 'Tab') return 'Tab';
      if (key === 'Enter') return 'Enter';
      if (key === 'Backspace') return 'Backspace';
      return 'Key' + key.toUpperCase();
    };
    
    // Direct approach - simulate the execution of a macro
    if (keyEvent.type === 'keydown') {
      // For all keys, use the approach with executeJavaScript
      const script = `
        (function() {
          try {
            // Try to use the pressKey function already injected by the macros
            if (typeof window.pressKey === 'function') {
              window.pressKey('${keyEvent.key}');
              return "Key pressed via window.pressKey: ${keyEvent.key}";
            } else {
              // Fallback if the function does not exist
              const element = document.documentElement;
              const event = new KeyboardEvent('keydown', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Key pressed via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Error: " + e.message;
          }
        })();
      `;
      
      // Execute the script in all synchronized views
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber} keydown:`, result))
            .catch(err => console.error(`Error view ${view.viewNumber}:`, err));
        }
      });
    } else if (keyEvent.type === 'keyup') {
      // For the keyup events
      const script = `
        (function() {
          try {
            // Ensure that all released keys are correctly handled
            // Try to use the releaseKey function already injected by the macros
            if (typeof window.releaseKey === 'function') {
              window.releaseKey('${keyEvent.key}');
              return "Key released via window.releaseKey: ${keyEvent.key}";
            } else {
              // Fallback if the function does not exist
              const element = document.documentElement;
              const event = new KeyboardEvent('keyup', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Touche relâchée via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Error: " + e.message;
          }
        })();
      `;
      
      // Execute the script in all synchronized views
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber} keyup:`, result))
            .catch(err => console.error(`Error view ${view.viewNumber}:`, err));
        }
      });
    }
  }

  // Add the method to handle the fullscreen
  toggleViewFullscreen(view) {
    if (!view) return;
    
    console.log(`Toggle the fullscreen for view ${view.viewIndex}`);

    if (this.fullscreenView === view) {
      // If the view is already in fullscreen, return to the normal view
      console.log(`View ${view.viewIndex} exits fullscreen`);
      this.exitFullscreen();
    } else {
      // If another view is in fullscreen, exit it first
      if (this.fullscreenView) {
        console.log(`Exit fullscreen for the previous view ${this.fullscreenView.viewIndex}`);
        this.exitFullscreen();
      }
      // Put the new view in fullscreen
      console.log(`View ${view.viewIndex} enters fullscreen`);
      this.enterFullscreen(view);
    }
  }

  // Method to enter fullscreen
  enterFullscreen(view) {
    const { width, height } = this.window.getContentBounds();
    
    // Save the fullscreen view
    this.fullscreenView = view;
    
    // Hide all other views
    this.views.forEach(v => {
      if (v !== view) {
        v.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
        if (v.controlBar) {
          v.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
        }
      }
    });
    
    // Position the control bar of the view above the other elements
    const controlBarHeight = 28;
    
    // Get the game control bar and make it visible above the other elements
    if (this.gameControlBar) {
      this.window.setTopBrowserView(this.gameControlBar); // Put the game control bar above
    }
    
    // Position the control bar of the view above the other elements
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar); // Ensure that the control bar is above
      view.controlBar.setBounds({
        x: 0,
        y: this.titleBarHeight, // Position the control bar below the custom title bar
        width: width,
        height: controlBarHeight
      });
    }
    
    // Put the selected view in fullscreen
    view.setBounds({
      x: 0,
      y: this.titleBarHeight + controlBarHeight, // Position the view below its control bar
      width: width,
      height: height - (this.titleBarHeight + controlBarHeight) // Adjust height
    });
    
    // Place the selected view below the control bar but above the other elements
    this.window.setTopBrowserView(view); 
    
    // Ensure that the control bar of the view remains above all
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar);
      
      // Update the icon of the fullscreen button
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⮌</span>';
      `);
    }

    // In enterFullscreen, after hiding other views, add:
    if (this.mainBarView) {
      this.mainBarView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
    }
    // In enterFullscreen, after putting the view in fullscreen, add:
    this.window.webContents.executeJavaScript(`
      (function() {
        let style = document.getElementById('hide-main-bar-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'hide-main-bar-style';
          style.textContent = '#app > .control-bar:first-child { display: none !important; }';
          document.head.appendChild(style);
        }
      })();
    `).catch(() => {});
  }

  // Method to exit fullscreen
  exitFullscreen() {
    if (!this.fullscreenView) return;
    
    // Reset the fullscreen view
    const view = this.fullscreenView;
    this.fullscreenView = null;
    
    // Reposition all views
    this.updateViewPositions();
    
    // Update the icon of the fullscreen button
    if (view.controlBar) {
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⛶</span>';
      `);
    }

    // In exitFullscreen, restore the main bar:
    if (this.mainBarView) {
      this.mainBarView.setBounds({ x: 0, y: 0, width: this.window.getContentBounds().width, height: this.controlBarHeight });
    }
    // In exitFullscreen, after restoring the main bar, add:
    this.window.webContents.executeJavaScript(`
      (function() {
        let style = document.getElementById('hide-main-bar-style');
        if (style) style.remove();
      })();
    `).catch(() => {});
  }

  // Method to reload the settings and update the views
  reloadSettingsAndUpdateViews() {
    console.log('Reloading the settings and updating the views');
    // Execute a script in the main window to get the settings
    this.window.webContents.executeJavaScript(`
      (function() {
        try {
          const betterXcloudSettings = localStorage.getItem('BetterXcloud');
          if (betterXcloudSettings) {
            console.log('Reloaded BetterXcloud settings:', betterXcloudSettings);
            return betterXcloudSettings;
          }
          return null;
        } catch(err) {
          console.error('Error while getting the settings:', err);
          return null;
        }
      })()
    `).then(result => {
      if (result) {
        try {
          const settings = JSON.parse(result);
          console.log('Loaded settings:', settings);
          
          // Update the server configuration
          if (settings["server.region"]) {
            global.serverConfig.region = settings["server.region"];
          }
          
          if (settings["server.bypassRestriction"]) {
            global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
          }
          
          // Get the video resolution
          if (settings["stream.video.resolution"]) {
            global.serverConfig.resolution = settings["stream.video.resolution"];
          }
          
          // Get the bitrate values
          if (settings["host.bitrate"]) {
            global.serverConfig.hostBitrate = settings["host.bitrate"];
          }
          
          if (settings["player.bitrate"]) {
            global.serverConfig.playerBitrate = settings["player.bitrate"];
          }
          
          console.log('Updated server configuration:', global.serverConfig);
          
          // Update all views with the new configuration
          this.updateServerConfigInViews();
        } catch (error) {
          console.error('Error while parsing the parameters:', error);
        }
      }
    }).catch(err => {
      console.error('Error while executing the script to get the parameters:', err);
    });
  }
  
  // Mettre à jour la configuration du serveur dans toutes les vues
  updateServerConfigInViews() {
    console.log('Updating the server configuration in all views');
    
    // Get the current configuration
    const serverConfig = global.serverConfig || {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000
    };
    
    // Update all existing views
    this.views.forEach(view => {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Determine the bitrate depending on the type of view
          const bitrate = view.viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
          
          // Send the configuration to the view via IPC
          view.webContents.send('server-config', {
            region: serverConfig.region,
            bitrate: bitrate,
            bypassRestriction: serverConfig.bypassRestriction,
            resolution: serverConfig.resolution
          });
          
          // Inject directly a script that applies the parameters in the localStorage
          const injectionScript = `
            (function() {
              try {
                console.log("Direct injection of server parameters");
                
                // Get the current parameters
                let settings = {};
                try {
                  const existingSettings = localStorage.getItem("BetterXcloud");
                  if (existingSettings) {
                    settings = JSON.parse(existingSettings);
                  }
                } catch (e) {
                  console.error("Error while getting the existing parameters:", e);
                }
                
                // Update the parameters with the new configuration
                settings["server.region"] = "${serverConfig.region}";
                settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
                
                // Apply the bitrate depending on the type of view
                settings["stream.video.maxBitrate"] = ${bitrate};
                console.log("Bitrate injected for view ${view.viewType}:", ${bitrate});
                
                // Stocker les valeurs de référence pour les paramètres
                settings["host.bitrate"] = ${serverConfig.hostBitrate};
                settings["player.bitrate"] = ${serverConfig.playerBitrate};
                
                // Appliquer la résolution depuis la configuration du serveur
                settings["stream.video.resolution"] = "${serverConfig.resolution}";
                console.log("Résolution appliquée:", "${serverConfig.resolution}");
                
                // Sauvegarder les paramètres mis à jour
                localStorage.setItem("BetterXcloud", JSON.stringify(settings));
                
                console.log("Paramètres serveur mis à jour dans le localStorage:", 
                  { 
                    region: "${serverConfig.region}", 
                    bypassRestriction: "${serverConfig.bypassRestriction}", 
                    bitrate: ${bitrate},
                    resolution: settings["stream.video.resolution"]
                  });
                
                return true;
              } catch (error) {
                console.error("Erreur lors de l'injection directe des paramètres serveur:", error);
                return false;
              }
            })();
          `;
          
          // Exécuter le script dans la vue
          view.webContents.executeJavaScript(injectionScript)
            .then(result => {
              console.log(`Vue ${view.viewNumber} (${view.viewType}) - Injection directe des paramètres: ${result ? 'réussie' : 'échouée'}`);
              
              // Recharger la page pour appliquer les nouveaux paramètres
              view.webContents.reload();
            })
            .catch(error => {
              console.error(`Erreur lors de l'exécution du script d'injection dans la vue ${view.viewNumber}:`, error);
            });
          
          console.log(`Vue ${view.viewNumber} (${view.viewType}) - Configuration mise à jour: region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, bitrate=${bitrate}`);
        } catch (error) {
          console.error(`Erreur lors de la mise à jour de la vue ${view.viewNumber}:`, error);
        }
      }
    });
  }
}

// Fonction pour créer une nouvelle instance de MainViewWindow
function createMainViewWindow(config) {
  return new MainViewWindow(config);
}

// Exporter la classe et la fonction
module.exports = {
  MainViewWindow,
  createMainViewWindow
};


