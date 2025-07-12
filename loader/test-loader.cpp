#include <windows.h>
#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <thread>

// Test version of security checker (without aggressive measures)
class TestSecurityChecker {
private:
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

    bool CheckForVM() {
        HKEY hKey;
        if (RegOpenKeyExA(HKEY_LOCAL_MACHINE, "SYSTEM\\CurrentControlSet\\Control\\SystemInformation", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            char manufacturer[256] = {0};
            DWORD size = sizeof(manufacturer);

            if (RegQueryValueExA(hKey, "SystemManufacturer", NULL, NULL, (LPBYTE)manufacturer, &size) == ERROR_SUCCESS) {
                std::string manuStr = std::string(manufacturer);
                std::transform(manuStr.begin(), manuStr.end(), manuStr.begin(), ::tolower);
                
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
                // TODO: Implement registry key checks for VM indicators
                // System files (stub)
                // TODO: Implement system file checks for VM indicators
                // MAC addresses (stub)
                // TODO: Implement MAC address checks for VM indicators
                
                for (const auto& indicator : vmIndicators) {
                    if (manuStr.find(indicator) != std::string::npos) {
                        RegCloseKey(hKey);
                        return true;
                    }
                }
            }
            RegCloseKey(hKey);
        }
        return false;
    }

    bool CheckTimingAnomalies() {
        auto start = std::chrono::high_resolution_clock::now();
        
        for (int i = 0; i < 100000; i++) {
            __asm {
                nop
                nop
                nop
            }
        }
        
        auto end = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
        
        return duration.count() > 50; // More than 50ms is suspicious
    }

public:
    void RunSecurityTests() {
        std::cout << "=== Security Test Results ===" << std::endl;
        
        // Test 1: Debugger Detection
        std::cout << "1. Debugger Detection: ";
        if (CheckForDebuggers()) {
            std::cout << "FAILED - Debugger detected!" << std::endl;
        } else {
            std::cout << "PASSED - No debuggers found" << std::endl;
        }
        
        // Test 2: VM Detection
        std::cout << "2. VM Detection: ";
        if (CheckForVM()) {
            std::cout << "FAILED - Virtual machine detected!" << std::endl;
        } else {
            std::cout << "PASSED - No VM detected" << std::endl;
        }
        
        // Test 3: Timing Anomalies
        std::cout << "3. Timing Anomalies: ";
        if (CheckTimingAnomalies()) {
            std::cout << "FAILED - Timing anomalies detected!" << std::endl;
        } else {
            std::cout << "PASSED - No timing anomalies" << std::endl;
        }
        
        // Test 4: IsDebuggerPresent
        std::cout << "4. IsDebuggerPresent: ";
        if (IsDebuggerPresent()) {
            std::cout << "FAILED - Debugger present!" << std::endl;
        } else {
            std::cout << "PASSED - No debugger present" << std::endl;
        }
        
        std::cout << "=============================" << std::endl;
    }
};

// Test HWID generation
class TestHWIDGenerator {
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

public:
    void TestHWIDGeneration() {
        std::cout << "\n=== HWID Generation Test ===" << std::endl;
        
        std::string machineGUID = GetMachineGUID();
        if (!machineGUID.empty()) {
            std::cout << "Machine GUID: " << machineGUID << std::endl;
            std::cout << "HWID Test: PASSED" << std::endl;
        } else {
            std::cout << "HWID Test: FAILED - Could not retrieve Machine GUID" << std::endl;
        }
        
        std::cout << "============================" << std::endl;
    }
};

// Test network connectivity
class TestNetworkConnectivity {
public:
    void TestBackendConnection() {
        std::cout << "\n=== Network Connectivity Test ===" << std::endl;
        
        HINTERNET hInternet = InternetOpenA("TestLoader", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
        if (!hInternet) {
            std::cout << "Network Test: FAILED - Could not initialize WinINet" << std::endl;
            return;
        }

        HINTERNET hConnect = InternetOpenUrlA(hInternet, "https://backend-server-trhh.onrender.com/api/health", 
                                            NULL, 0, INTERNET_FLAG_RELOAD, 0);
        if (!hConnect) {
            std::cout << "Network Test: FAILED - Could not connect to backend" << std::endl;
        } else {
            std::cout << "Network Test: PASSED - Backend connection successful" << std::endl;
            InternetCloseHandle(hConnect);
        }

        InternetCloseHandle(hInternet);
        std::cout << "=================================" << std::endl;
    }
};

int main() {
    std::cout << "Soryn Loader Test Program" << std::endl;
    std::cout << "This program tests the security features without aggressive measures." << std::endl;
    std::cout << std::endl;

    // Run security tests
    TestSecurityChecker securityChecker;
    securityChecker.RunSecurityTests();

    // Test HWID generation
    TestHWIDGenerator hwidGenerator;
    hwidGenerator.TestHWIDGeneration();

    // Test network connectivity
    TestNetworkConnectivity networkTest;
    networkTest.TestBackendConnection();

    std::cout << "\nTest completed. Press any key to exit..." << std::endl;
    std::cin.get();

    return 0;
} 