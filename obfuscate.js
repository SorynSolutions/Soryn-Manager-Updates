const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration for obfuscation
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Get all JavaScript files in the project
const files = glob.sync('**/*.js', { ignore: ['node_modules/**', 'dist/**'] });

// Process each file
files.forEach(file => {
    if (fs.statSync(file).isFile() && file.endsWith('.js')) {
        const content = fs.readFileSync(file, 'utf8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(content, obfuscationOptions).getObfuscatedCode();
        
        // Create dist directory if it doesn't exist
        const distDir = path.join('dist', path.dirname(file));
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }
        
        // Write obfuscated code to dist directory
        fs.writeFileSync(path.join('dist', file), obfuscatedCode);
        console.log(`Obfuscated: ${file}`);
    }
});

console.log('Obfuscation complete!'); 