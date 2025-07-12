# Secure License Key Storage System

## Overview

The Soryn's Lobby Manager now includes a secure system for storing and automatically validating license keys from a config file. This system maintains the backend-only validation architecture while providing convenience for users.

## Security Architecture

### Why This Is Secure

1. **Backend-Only Validation**: All license validation still goes through the backend server
2. **Hardware Binding**: The backend validates against the current hardware configuration
3. **No Client-Side Bypassing**: The stored key cannot be used to bypass validation
4. **Secure File Reading**: Multiple security checks prevent file tampering
5. **Session Management**: Sessions are only created after successful backend validation

### Security Measures

#### File Security
- **Path Validation**: Only reads from `C:\Users\[Username]\AppData\Roaming\soryns-lobby-manager\config.json`
- **File Size Limits**: Config files larger than 10KB are rejected
- **JSON Validation**: Invalid JSON files are rejected
- **Structure Validation**: Config must be a valid object with proper license key format

#### Key Validation
- **Format Validation**: License keys must be 10-100 characters
- **Backend Validation**: Every stored key is validated with the backend server
- **Hardware Binding**: Backend validates against current hardware configuration
- **No Caching**: Keys are not stored in memory for bypassing

## Implementation Details

### File Structure

The config file is stored at:
```
C:\Users\[Username]\AppData\Roaming\soryns-lobby-manager\config.json
```

Example config file:
```json
{
  "licenseKey": "your-license-key-here",
  "lastSaved": "2024-01-15T10:30:00.000Z"
}
```

### Functions

#### `attemptStoredLicenseValidation()`
- Reads the stored license key from config file
- Performs security checks on the file
- Validates the key with the backend server
- Returns validation result

#### `saveLicenseKeyToConfig(licenseKey)`
- Saves a license key to the config file
- Only called after successful backend validation
- Creates the config directory if it doesn't exist
- Adds timestamp for tracking

### User Interface

#### Login Form
- Added "Remember License Key" checkbox (checked by default)
- Users can choose whether to save their license key
- The checkbox state is sent with login attempts

#### Automatic Login
- App attempts to validate stored license key on startup
- If successful, proceeds directly to main window
- If failed, shows login window for manual entry

## Usage Flow

### First Time User
1. User enters license key in login form
2. Checks "Remember License Key" (default)
3. Backend validates the key
4. If valid, key is saved to config file
5. User proceeds to main window

### Returning User
1. App starts and reads stored license key
2. App validates key with backend server
3. If valid, user proceeds directly to main window
4. If invalid, login window is shown

### Key Expiration/Invalidation
1. If stored key becomes invalid, backend validation fails
2. App shows login window for new key entry
3. User can enter new key and choose to save it

## Security Considerations

### What This Prevents
- **Key Sharing**: Hardware binding prevents sharing between machines
- **File Tampering**: Multiple validation layers prevent config file manipulation
- **Bypass Attempts**: No client-side validation logic to bypass
- **Memory Attacks**: Keys are not stored in memory for long periods

### What This Doesn't Prevent
- **Physical Access**: Someone with physical access can still read the config file
- **Backend Compromise**: If backend is compromised, all validation fails
- **Network Attacks**: Man-in-the-middle attacks on backend communication

## Configuration

### Environment Variables
No additional environment variables are required. The system uses the existing backend URL configuration.

### File Permissions
The config file uses standard Windows file permissions. Users should ensure their AppData directory is secure.

## Testing

### Test Script
Run `node test-stored-license.js` to test the functionality:
- Tests file reading with various scenarios
- Validates security measures
- Checks error handling

### Manual Testing
1. Start the app with no stored key
2. Enter a valid license key and check "Remember License Key"
3. Restart the app - should auto-login
4. Test with invalid stored key - should show login window

## Troubleshooting

### Common Issues

#### "No stored config file found"
- Normal for first-time users
- User must enter license key manually

#### "Config file too large"
- Config file has been corrupted or tampered with
- Delete the config file and re-enter license key

#### "Invalid JSON in config file"
- Config file is corrupted
- Delete the config file and re-enter license key

#### "Backend validation failed"
- Stored key is no longer valid
- User must enter new license key

### Debug Logging
The system provides detailed console logging:
- `[License]` prefix for all license-related operations
- `[Startup]` prefix for startup sequence
- Error details for troubleshooting

## Migration from Previous Versions

### Existing Users
- No migration required
- Users will need to enter their license key once
- Can choose to save it for future use

### Config File Location
- Previous versions may have used different locations
- New system uses standardized AppData location
- Old config files are ignored

## Future Enhancements

### Potential Improvements
- **Encryption**: Encrypt stored license keys (requires key management)
- **Multiple Keys**: Support for multiple license keys
- **Auto-Rotation**: Automatic key rotation for security
- **Backup/Restore**: Backup and restore license configurations

### Security Enhancements
- **File Integrity**: Add checksums to config files
- **Access Logging**: Log access to stored license keys
- **Time-based Expiration**: Automatic key expiration
- **Multi-factor**: Additional authentication factors

## Conclusion

The secure license key storage system provides convenience for users while maintaining the robust security architecture. All validation still goes through the backend server, ensuring that license keys cannot be bypassed or shared between machines. The system is designed to be secure by default while providing a smooth user experience. 