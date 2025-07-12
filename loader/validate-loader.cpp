#include <windows.h>
#include <iostream>
#include <string>
#include <fstream>
#include <vector>

// Test the actual compiled loader binary
class LoaderValidator {
private:
    std::string loaderPath;
    
    // Check if loader file exists and is executable
    bool ValidateLoaderFile() {
        std::cout << "1. Checking loader file existence..." << std::endl;
        
        if (!std::ifstream(loaderPath)) {
            std::cout << "   FAILED: Loader file not found: " << loaderPath << std::endl;
            return false;
        }
        
        // Check if it's a valid PE executable
        std::ifstream file(loaderPath, std::ios::binary);
        if (!file) {
            std::cout << "   FAILED: Cannot open loader file" << std::endl;
            return false;
        }
        
        // Read DOS header
        char dosHeader[2];
        file.read(dosHeader, 2);
        
        if (dosHeader[0] != 'M' || dosHeader[1] != 'Z') {
            std::cout << "   FAILED: Not a valid PE executable" << std::endl;
            return false;
        }
        
        std::cout << "   PASSED: Valid PE executable found" << std::endl;
        return true;
    }
    
    // Check for security-related strings in the binary
    bool ValidateSecurityStrings() {
        std::cout << "2. Checking for security features in binary..." << std::endl;
        
        std::ifstream file(loaderPath, std::ios::binary);
        if (!file) return false;
        
        // Read entire file
        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<char> buffer(size);
        file.read(buffer.data(), size);
        std::string content(buffer.begin(), buffer.end());
        
        // Check for security-related strings
        std::vector<std::string> securityStrings = {
            "IsDebuggerPresent",
            "CreateToolhelp32Snapshot",
            "Process32First",
            "Process32Next",
            "RegOpenKeyEx",
            "RegQueryValueEx",
            "InternetOpenUrl",
            "CreateProcess",
            "ShellExecute",
            "shutdown",
            "exit",
            "SECURITY",
            "COMPROMISE",
            "HWID",
            "KeyAuth"
        };
        
        int foundCount = 0;
        for (const auto& str : securityStrings) {
            if (content.find(str) != std::string::npos) {
                foundCount++;
                std::cout << "   Found: " << str << std::endl;
            }
        }
        
        if (foundCount >= 5) {
            std::cout << "   PASSED: Found " << foundCount << " security features" << std::endl;
            return true;
        } else {
            std::cout << "   FAILED: Only found " << foundCount << " security features" << std::endl;
            return false;
        }
    }
    
    // Check if loader requires admin privileges
    bool ValidateAdminRequirement() {
        std::cout << "3. Checking admin requirement..." << std::endl;
        
        std::ifstream file(loaderPath, std::ios::binary);
        if (!file) return false;
        
        // Read manifest section to check for admin requirement
        file.seekg(0, std::ios::end);
        size_t size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        std::vector<char> buffer(size);
        file.read(buffer.data(), size);
        std::string content(buffer.begin(), buffer.end());
        
        // Look for manifest strings
        if (content.find("requireAdministrator") != std::string::npos ||
            content.find("level='requireAdministrator'") != std::string::npos) {
            std::cout << "   PASSED: Requires administrator privileges" << std::endl;
            return true;
        } else {
            std::cout << "   WARNING: May not require admin privileges" << std::endl;
            return false;
        }
    }
    
    // Test actual loader execution (safe mode)
    bool TestLoaderExecution() {
        std::cout << "4. Testing loader execution (safe mode)..." << std::endl;
        
        // Create a test environment
        STARTUPINFOA si = {0};
        PROCESS_INFORMATION pi = {0};
        si.cb = sizeof(si);
        
        // Try to run loader with test flag (if implemented)
        std::string command = "\"" + loaderPath + "\" /test";
        
        if (CreateProcessA(NULL, (LPSTR)command.c_str(), NULL, NULL, FALSE, 
                          CREATE_SUSPENDED, NULL, NULL, &si, &pi)) {
            std::cout << "   PASSED: Loader can be executed" << std::endl;
            
            // Terminate immediately for safety
            TerminateProcess(pi.hProcess, 0);
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            return true;
        } else {
            DWORD error = GetLastError();
            if (error == ERROR_ELEVATION_REQUIRED) {
                std::cout << "   PASSED: Loader requires elevation (admin rights)" << std::endl;
                return true;
            } else {
                std::cout << "   FAILED: Cannot execute loader (Error: " << error << ")" << std::endl;
                return false;
            }
        }
    }

public:
    LoaderValidator(const std::string& path) : loaderPath(path) {}
    
    bool ValidateLoader() {
        std::cout << "=== Loader Validation Test ===" << std::endl;
        std::cout << "Testing: " << loaderPath << std::endl;
        std::cout << std::endl;
        
        bool allPassed = true;
        
        allPassed &= ValidateLoaderFile();
        allPassed &= ValidateSecurityStrings();
        allPassed &= ValidateAdminRequirement();
        allPassed &= TestLoaderExecution();
        
        std::cout << std::endl;
        if (allPassed) {
            std::cout << "✅ All validation tests PASSED" << std::endl;
        } else {
            std::cout << "❌ Some validation tests FAILED" << std::endl;
        }
        
        return allPassed;
    }
};

int main() {
    std::string loaderPath = "SorynLoader.exe";
    
    LoaderValidator validator(loaderPath);
    bool result = validator.ValidateLoader();
    
    std::cout << std::endl;
    std::cout << "Press any key to exit..." << std::endl;
    std::cin.get();
    
    return result ? 0 : 1;
} 