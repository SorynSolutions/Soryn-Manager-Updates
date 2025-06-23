const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs for all application features
contextBridge.exposeInMainWorld('electronAPI', {
  // API for the selection window
  startSession: (config) => ipcRenderer.send('start-session', config),
  
  // API for the main window and views
  onUpdateViewCount: (callback) => ipcRenderer.on('update-view-count', callback),
  notifyScroll: (scrollPos) => ipcRenderer.send('sync-scroll', scrollPos),
  
  // API for the key simulation macro
  toggleMacro: (enabled) => ipcRenderer.send('toggle-macro', enabled),
  onMacroStatusChange: (callback) => ipcRenderer.on('macro-status-change', callback),
  
  // API for the scrolling system
  sendScrollPosition: (position) => ipcRenderer.send('container-scrolled', position),
  sendWheelScroll: (delta) => ipcRenderer.send('wheel-scrolled', delta),
  sendKeyboardScroll: (data) => ipcRenderer.send('keyboard-scroll', data),
  onSetContainerSize: (callback) => ipcRenderer.on('set-container-size', (event, data) => callback(data)),
  
  // API to open the sync panel
  openSyncPanel: () => ipcRenderer.send('open-sync-panel'),
  
  // API to send bitrate settings
  sendBitrateSettings: (settings) => ipcRenderer.send('update-bitrate-settings', settings),
  
  // API to reload all views
  reloadAllViews: () => ipcRenderer.send('reload-all-views'),
  
  // API to get current settings
  getCurrentSettings: (callback) => {
    ipcRenderer.once('current-settings', (event, settings) => callback(settings));
    ipcRenderer.send('get-current-settings');
  },
  
  // API to close the current window
  closeWindow: () => ipcRenderer.send('close-current-window'),
  
  // API for the new buttons
  openSettings: () => ipcRenderer.send('open-settings'),
  toggleRandomMovements: (enable) => ipcRenderer.send('toggle-random-movements', enable),
  toggleMute: (isMuted) => ipcRenderer.send('toggle-mute', isMuted),
  closeView: (viewId) => ipcRenderer.send('close-view', viewId),
  
  // API to toggle mute for the entire application
  toggleAppMute: () => ipcRenderer.send('toggle-app-mute'),
  onAppMuteState: (callback) => ipcRenderer.on('app-mute-state', (event, isMuted) => callback(isMuted)),
  
  // API to add a new bot
  addBot: () => ipcRenderer.send('add-bot'),
  
  // API for auto-updates
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
}); 