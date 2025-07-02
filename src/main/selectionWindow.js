const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

class SelectionWindow {
  constructor() {
    // URL of the icon in your GitHub repository (raw link)
    const iconUrl = 'https://raw.githubusercontent.com/KillaMonjaro420/logo/refs/heads/main/logo.ico';
    const iconPath = path.join(__dirname, 'logo.ico');

    // Download icon if it doesn't exist
    if (!fs.existsSync(iconPath)) {
      const file = fs.createWriteStream(iconPath);
      https.get(iconUrl, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          this.createWindow(iconPath);
        });
      });
    } else {
      this.createWindow(iconPath);
    }
  }

  createWindow(iconPath) {
    this.window = new BrowserWindow({
      width: 800,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Session Configuration',
      show: false,
      backgroundColor: '#1e1e2e',
      icon: iconPath
    });

    this.window.loadFile(path.join(__dirname, '../renderer/selection.html'));
    
    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    // Uncomment to open DevTools
    // this.window.webContents.openDevTools();
  }
}

module.exports = SelectionWindow; 