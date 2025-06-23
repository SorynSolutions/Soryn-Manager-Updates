const fs = require('fs');
const path = require('path');

// Copy the existing logo.ico to build directory
const sourcePath = path.join('src', 'main', 'logo.ico');
const targetPath = path.join('build', 'icon.ico');

// Ensure build directory exists
if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
}

// Copy the file
fs.copyFileSync(sourcePath, targetPath);
console.log('Icon copied successfully!'); 