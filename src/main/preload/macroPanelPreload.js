const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to interact with the main process
contextBridge.exposeInMainWorld('macroAPI', {
  // Retrieve available macros for a specific game mode
  requestMacros: (gameMode) => {
    ipcRenderer.send('request-macros', gameMode);
  },
  
  // Listen for updates on available macros
  onMacrosLoaded: (callback) => {
    ipcRenderer.on('macros-loaded', (_, data) => {
      callback(data);
    });
  },
  
  // Execute a macro
  executeMacro: (macroId, gameMode) => {
    ipcRenderer.send('execute-macro', { macroId, gameMode });
  },
  
  // Listen for macro status updates
  onMacroStatus: (callback) => {
    ipcRenderer.on('macro-status', (_, data) => {
      callback(data);
    });
  }
}); 