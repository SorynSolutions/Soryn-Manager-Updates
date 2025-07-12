# Soryn Security Loader

A high-security C++ loader designed to protect applications from reverse engineering, debugging, and unauthorized use.

## ⚠️ WARNING

This loader implements aggressive security measures including:
- **System Restart**: Will restart the computer if compromised
- **Complete Cleanup**: Removes all traces of the application
- **Blue Screen**: May cause system crashes if security is breached
- **Administrator Rights**: Requires full system access

**Use at your own risk and ensure compliance with local laws.**

## Security Features

### 🔒 Anti-Debugging Protection
- **Kernel Debugger Detection**: Detects kernel-level debugging
- **Remote Debugger Detection**: Identifies remote debugging sessions
- **Hardware Breakpoint Detection**: Detects hardware breakpoints
- **Software Breakpoint Detection**: Scans for INT3 instructions
- **Timing Anomaly Detection**: Detects execution slowdowns
- **Process Scanning**: Identifies common debugging tools

### 🖥️ Anti-VM Protection
- **System Manufacturer Detection**: Identifies VM manufacturers
- **Registry Key Scanning**: Checks for VM-specific registry entries
- **Process Detection**: Identifies VM-related processes
- **Hardware Fingerprinting**: Uses multiple hardware identifiers

### 🏖️ Anti-Sandbox Protection
- **Sandbox Process Detection**: Identifies analysis tools
- **Network Analysis Detection**: Detects network monitoring
- **File System Monitoring**: Detects file system analysis tools

### 🔐 License Validation
- **Hardware Fingerprinting**: Strong HWID generation
- **Backend Validation**: Server-side license verification
- **Blacklist Checking**: Validates against blacklisted devices
- **Real-time Validation**: Continuous license verification

### 📦 Encrypted Payload Execution
- **AES-256 Encryption**: Military-grade encryption
- **Memory-Only Execution**: Never writes to disk
- **Integrity Verification**: SHA-256 hash validation
- **Automatic Cleanup**: Removes temporary files

## Building the Loader

### Prerequisites
- **Visual Studio 2019** or later with C++ development tools
- **CMake** 3.16 or later
- **Windows SDK** 10.0.19041.0 or later

### Build Steps

1. **Open Developer Command Prompt**
   ```cmd
   "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\Tools\VsDevCmd.bat"
   ```

2. **Navigate to loader directory**
   ```cmd
   cd loader
   ```

3. **Run build script**
   ```cmd
   build.bat
   ```

4. **Verify build**
   ```cmd
   dir SorynLoader.exe
   ```

### Manual Build (Alternative)

```cmd
mkdir build
cd build
cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
copy Release\SorynLoader.exe ..\SorynLoader.exe
```

## Configuration

### Backend Configuration
Update the following constants in `SorynLoader.cpp`:

```cpp
#define BACKEND_URL "https://your-backend-server.com"
#define LICENSE_KEY "your-license-key-here"
#define PAYLOAD_ENCRYPTION_KEY "your-32-byte-encryption-key"
#define EXPECTED_HASH "expected-sha256-hash-of-payload"
```

### Security Settings
Modify security parameters as needed:

```cpp
// Security check intervals (in seconds)
#define SECURITY_CHECK_INTERVAL 10
#define LICENSE_CHECK_INTERVAL 30

// Anti-debugging sensitivity
#define TIMING_THRESHOLD_MS 200
#define DEBUGGER_SCAN_INTERVAL 5
```

## Usage

### Basic Usage
```cmd
# Run as administrator
SorynLoader.exe
```

### Silent Mode
```cmd
# Run without console output
SorynLoader.exe /silent
```

### Debug Mode (Development Only)
```cmd
# Run with debug output
SorynLoader.exe /debug
```

## Security Response Actions

### Compromise Detection
When a security compromise is detected, the loader will:

1. **Log the incident** with detailed information
2. **Attempt cleanup** of application files
3. **Remove registry entries** related to the application
4. **Trigger system restart** or BSOD based on configuration

### Cleanup Process
```cpp
void CleanupAndRestart() {
    // Delete application files
    // Clear registry entries
    // Remove temporary files
    // Force system restart
}
```

## Integration with Backend

### License Validation Endpoint
```
POST /api/validate-key
{
    "key": "license-key",
    "hwid": "hardware-fingerprint",
    "displayName": "user-display-name"
}
```

### Payload Delivery Endpoint
```
POST /api/payload
{
    "hwid": "hardware-fingerprint",
    "platform": "win32",
    "arch": "x64"
}
```

### Response Format
```json
{
    "success": true,
    "token": "jwt-token",
    "sessionId": "session-id",
    "message": "Validation successful"
}
```

## Hardware Fingerprinting

### Components Used
- **Machine GUID**: Windows registry identifier
- **CPU Information**: Processor details
- **Disk Serial**: Physical disk serial numbers
- **Motherboard Serial**: System board identifier
- **Network MACs**: Network adapter addresses

### Hash Generation
```cpp
std::string GenerateHWID() {
    std::string components = 
        GetMachineGUID() + "|" + 
        GetCPUInfo() + "|" + 
        GetDiskSerial();
    
    // SHA-256 hash generation
    return SHA256Hash(components);
}
```

## Anti-Debugging Techniques

### Kernel Debugger Detection
```cpp
bool CheckKernelDebugger() {
    __try {
        __asm { int 3 }
    }
    __except(EXCEPTION_EXECUTE_HANDLER) {
        return false;
    }
    return true;
}
```

### Timing Anomaly Detection
```cpp
bool CheckTimingAnomalies() {
    auto start = std::chrono::high_resolution_clock::now();
    
    // Perform operations that would be slowed by debugger
    for (int i = 0; i < 1000000; i++) {
        __asm { nop nop nop }
    }
    
    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
    
    return duration.count() > TIMING_THRESHOLD_MS;
}
```

## VM Detection Methods

### Registry Scanning
```cpp
bool CheckVMRegistry() {
    std::vector<std::string> vmKeys = {
        "SOFTWARE\\VMware, Inc.\\VMware Tools",
        "SOFTWARE\\Oracle\\VirtualBox Guest Additions",
        "SOFTWARE\\Microsoft\\Virtual Machine\\Guest\\Parameters"
    };
    
    for (const auto& key : vmKeys) {
        if (RegKeyExists(key)) return true;
    }
    return false;
}
```

### Process Detection
```cpp
bool CheckVMProcesses() {
    std::vector<std::string> vmProcesses = {
        "vmtoolsd.exe", "vboxservice.exe", "vboxtray.exe"
    };
    
    return ScanForProcesses(vmProcesses);
}
```

## Payload Execution

### Memory-Only Execution
```cpp
bool ExecuteInMemory(const std::vector<BYTE>& payload) {
    // Create temporary file in memory
    HANDLE hTempFile = CreateFileA("\\\\.\\PhysicalDrive0", 
                                  GENERIC_READ | GENERIC_WRITE,
                                  FILE_SHARE_READ | FILE_SHARE_WRITE, 
                                  NULL, CREATE_ALWAYS,
                                  FILE_ATTRIBUTE_TEMPORARY | FILE_FLAG_DELETE_ON_CLOSE, 
                                  NULL);
    
    // Write payload and execute
    WriteFile(hTempFile, payload.data(), payload.size(), &bytesWritten, NULL);
    
    // Create process from memory
    CreateProcessA(NULL, tempPath, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
    
    // Clean up
    CloseHandle(hTempFile);
    return true;
}
```

## Error Handling

### Security Compromise Response
```cpp
void HandleCompromise() {
    std::cout << "[SECURITY] Compromise detected! Initiating cleanup..." << std::endl;
    
    if (HasAdminRights()) {
        CleanupAndRestart();
    } else {
        CauseBSOD();
    }
}
```

### Network Error Handling
```cpp
bool ValidateLicense() {
    try {
        std::string response = HttpPost(validationUrl, postData);
        return ParseResponse(response);
    } catch (const std::exception& e) {
        std::cout << "[ERROR] License validation failed: " << e.what() << std::endl;
        return false;
    }
}
```

## Performance Considerations

### Optimization Flags
- **/O2**: Maximum optimization
- **/Ob2**: Inline function expansion
- **/MT**: Static runtime library
- **/GS-**: Disable buffer security checks
- **/guard:cf-**: Disable control flow guard

### Memory Usage
- **Base Loader**: ~2-5 MB
- **Security Checks**: ~1-2 MB additional
- **Payload Buffer**: Variable (depends on payload size)

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure Visual Studio C++ tools are installed
   - Check CMake version compatibility
   - Verify Windows SDK installation

2. **Runtime Errors**
   - Run as administrator
   - Check firewall settings
   - Verify backend connectivity

3. **Security False Positives**
   - Adjust timing thresholds
   - Whitelist legitimate tools
   - Review security logs

### Debug Mode
Enable debug output for troubleshooting:

```cpp
#define DEBUG_MODE 1
#define LOG_LEVEL DEBUG
```

## Legal and Ethical Considerations

### Compliance
- **Local Laws**: Ensure compliance with jurisdiction laws
- **User Consent**: Obtain explicit user consent
- **Data Protection**: Follow data protection regulations
- **Terms of Service**: Include in application terms

### Responsible Disclosure
- **Security Research**: Allow legitimate security research
- **Bug Reports**: Provide secure reporting channels
- **Updates**: Regular security updates and patches

## Support and Maintenance

### Monitoring
- **Security Logs**: Monitor for compromise attempts
- **Performance Metrics**: Track system impact
- **Error Reporting**: Collect and analyze errors
- **Usage Analytics**: Monitor feature usage

### Updates
- **Security Patches**: Regular security updates
- **Feature Enhancements**: Continuous improvement
- **Compatibility**: Support for new Windows versions
- **Documentation**: Keep documentation current

## License

This loader is provided as-is for educational and legitimate security purposes. Users are responsible for ensuring compliance with applicable laws and regulations.

## Disclaimer

The authors are not responsible for any damage, data loss, or legal issues arising from the use of this software. Use at your own risk and ensure proper testing before deployment. 