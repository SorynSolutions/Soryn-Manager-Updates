const { contextBridge, ipcRenderer } = require('electron');

// Expose the sync API to the panel
contextBridge.exposeInMainWorld('syncAPI', {
  // Request the initial state of the views
  requestViewsState: () => {
    ipcRenderer.send('request-views-state');
  },

  // Synchronize the selected views
  synchronizeViews: (selectedIndices) => {
    ipcRenderer.send('synchronize-views', selectedIndices);
  },

  // Listen for updates to the views' state
  onViewsUpdate: (callback) => {
    ipcRenderer.on('views-state-update', (event, viewsData) => {
      callback(viewsData);
    });
  },

  // Send a keyboard event to the main process
  sendKeyboardEvent: (keyEvent) => {
    // Send the event to the main process as is, without transformation
    ipcRenderer.send('keyboard-event', keyEvent);
  }
}); 