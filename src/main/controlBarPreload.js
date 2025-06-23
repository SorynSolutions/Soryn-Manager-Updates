const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macroAPI', {
  // Function to execute a macro
  executeMacro: (macroId, gameMode) => {
    ipcRenderer.send('execute-macro', { macroId, gameMode });
  },
  
  // Function to receive macro status updates
  onMacroStatus: (callback) => {
    ipcRenderer.on('macro-status', (event, data) => {
      callback(data);
    });
  },
  
  // Method to open the sync panel
  openSyncPanel: () => {
    ipcRenderer.send('open-sync-panel');
  },
  
  // Method to open the macro panel
  openMacroPanel: (gameMode) => {
    ipcRenderer.send('open-macro-panel', gameMode);
  },
  
  // Method to open the settings page
  openSettings: () => {
    ipcRenderer.send('open-settings');
  }
});

// Notify that the preload has been loaded
console.log('Control Bar Preload loaded'); 