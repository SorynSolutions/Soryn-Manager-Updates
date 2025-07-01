const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to interact with the main process
contextBridge.exposeInMainWorld('syncAPI', {
  // Retrieve the current state of views
  requestViewsState: () => {
    ipcRenderer.send('request-views-state');
  },
  
  // Listen for updates on the state of views
  onViewsUpdate: (callback) => {
    ipcRenderer.on('views-update', (_, data) => {
      callback(data);
    });
  },
  
  // Synchronize selected views
  synchronizeViews: (selectedIndices) => {
    ipcRenderer.send('synchronize-views', selectedIndices);
  },
  
  // Send a keyboard event to the main process
  sendKeyboardEvent: (keyEvent) => {
    // Send the event to the main process as is, without transformation
    ipcRenderer.send('keyboard-event', keyEvent);
  }
}); 