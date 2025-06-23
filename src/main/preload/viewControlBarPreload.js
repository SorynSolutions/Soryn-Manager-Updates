const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullscreen: () => {
    // Retrieve the view ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('viewId');
    
    if (viewId !== null) {
      // Send the event to the main process with the view ID
      ipcRenderer.send('toggle-view-fullscreen', parseInt(viewId));
    }
  },
  
  openDevTools: (viewId) => {
    if (viewId !== null) {
      // Send the event to the main process with the view ID
      ipcRenderer.send('open-view-devtools', parseInt(viewId));
    }
  },
  
  reloadView: (viewId) => {
    if (viewId !== null) {
      // Send the event to the main process with the view ID
      ipcRenderer.send('reload-view', parseInt(viewId));
    }
  },
  
  closeView: (viewId) => {
    if (viewId !== null) {
      ipcRenderer.send('close-view', parseInt(viewId, 10));
    }
  }
}); 