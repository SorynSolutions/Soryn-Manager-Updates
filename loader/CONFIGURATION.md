# Soryn Loader Configuration Guide

## 🔧 Configuration Fields

### 1. **BACKEND_URL** ✅ Already Set
```cpp
#define BACKEND_URL "https://backend-server-trhh.onrender.com"
```
**Status**: ✅ Already configured correctly

### 2. **LICENSE_KEY** ✅ Auto-Read from Config
```cpp
// LICENSE_KEY will be read from config file
```
**Status**: ✅ Automatically reads from `C:\Users\[Username]\AppData\Roaming\soryns-lobby-manager\config.json`

**Config File Location**: `C:\Users\[Username]\AppData\Roaming\soryns-lobby-manager\config.json`

**Expected Format**:
```json
{
  "licenseKey": "your-actual-license-key-here"
}
```

### 3. **PAYLOAD_ENCRYPTION_KEY** ✅ Already Set
```cpp
#define PAYLOAD_ENCRYPTION_KEY "bc63c63ba3a16a50edd5cfc3ca0aff5fb6a9d01d6fae9122e869aba85b435360"
```
**Status**: ✅ Already configured correctly

**What it is**: 32-byte AES-256 encryption key for decrypting payloads

### 4. **EXPECTED_HASH** ⚠️ Needs Configuration
```cpp
#define EXPECTED_HASH "YOUR_EXPECTED_SHA256_HASH_HERE"
```
**Status**: ⚠️ **NEEDS TO BE CONFIGURED**

## 🔍 How to Get the EXPECTED_HASH

### Step 1: Create Your Payload
1. **Build your real application** (the bot lobby manager)
2. **Save it as an executable** (e.g., `SorynApp.exe`)

### Step 2: Calculate SHA-256 Hash
You can calculate the hash using PowerShell:

```powershell
# Calculate SHA-256 hash of your payload
$filePath = "C:\path\to\your\SorynApp.exe"
$hash = Get-FileHash -Path $filePath -Algorithm SHA256
Write-Host "SHA-256 Hash: $($hash.Hash)"
```

### Step 3: Update the Loader
Replace `YOUR_EXPECTED_SHA256_HASH_HERE` with the actual hash:

```cpp
#define EXPECTED_HASH "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

## 📁 File Structure Setup

### 1. Config File Location
Ensure your config file exists at:
```
C:\Users\[Username]\AppData\Roaming\soryns-lobby-manager\config.json
```

### 2. Config File Format
```json
{
  "licenseKey": "your-actual-license-key-here",
  "version": "1.0.0",
  "autoUpdate": true
}
```

### 3. Backend Payload Directory
Place your real application in:
```
backend/payloads/
├── win32-x64.exe    # Your Windows 64-bit application
├── win32-ia32.exe   # Your Windows 32-bit application
├── darwin-x64.exe   # Your macOS application
└── linux-x64.exe    # Your Linux application
```

## 🔧 Configuration Steps

### Step 1: Update EXPECTED_HASH
1. **Calculate hash** of your payload executable
2. **Update the loader** with the correct hash
3. **Rebuild the loader**

### Step 2: Verify Config File
1. **Check config file exists** at the correct location
2. **Verify license key** is in the config file
3. **Test config file reading**

### Step 3: Test Configuration
1. **Run the loader** to test license reading
2. **Verify backend connectivity**
3. **Test payload delivery**

## 🧪 Testing Your Configuration

### Test 1: Config File Reading
```powershell
# Test if config file exists and is readable
$configPath = "$env:APPDATA\soryns-lobby-manager\config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    Write-Host "License Key: $($config.licenseKey)"
} else {
    Write-Host "Config file not found!"
}
```

### Test 2: Hash Calculation
```powershell
# Calculate hash of your payload
$payloadPath = "C:\path\to\your\payload.exe"
$hash = Get-FileHash -Path $payloadPath -Algorithm SHA256
Write-Host "Expected Hash: $($hash.Hash)"
```

### Test 3: Backend Connectivity
```powershell
# Test backend connection
$response = Invoke-WebRequest -Uri "https://backend-server-trhh.onrender.com/api/health"
Write-Host "Backend Status: $($response.StatusCode)"
```

## ⚠️ Important Notes

### Security Considerations:
- **Never commit** the encryption key to version control
- **Keep the hash secret** - it's used for integrity verification
- **Rotate keys regularly** for better security
- **Monitor for unauthorized access**

### Production Deployment:
- **Test thoroughly** before deployment
- **Verify all paths** are correct
- **Check permissions** for config file access
- **Monitor logs** for configuration errors

## 🔄 Update Process

### When You Update Your Payload:
1. **Build new payload** executable
2. **Calculate new hash** of the payload
3. **Update EXPECTED_HASH** in the loader
4. **Rebuild the loader**
5. **Deploy updated loader**

### When You Change License Keys:
1. **Update config.json** with new license key
2. **No need to rebuild** the loader
3. **Test license validation**

## 🚨 Troubleshooting

### Common Issues:

1. **Config File Not Found**
   - Check path: `%APPDATA%\soryns-lobby-manager\config.json`
   - Ensure file exists and is readable
   - Check JSON format is valid

2. **Invalid Hash**
   - Recalculate hash of your payload
   - Ensure no extra characters in hash string
   - Verify hash is 64 characters long

3. **Backend Connection Failed**
   - Check internet connectivity
   - Verify backend URL is correct
   - Check firewall settings

4. **License Validation Failed**
   - Verify license key in config file
   - Check if license is valid in KeyAuth
   - Ensure HWID is not blacklisted

## 📞 Support

If you encounter issues:
1. **Check the logs** for error messages
2. **Verify configuration** using the test scripts
3. **Test each component** individually
4. **Contact support** with specific error details 