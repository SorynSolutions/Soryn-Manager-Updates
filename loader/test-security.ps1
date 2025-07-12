# Soryn Security Loader Test - PowerShell Version
# This script tests the security features without aggressive measures

Write-Host "Soryn Loader Security Test - PowerShell Version" -ForegroundColor Green
Write-Host "Testing security features without aggressive measures..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Debugger Detection
Write-Host "=== Security Test Results ===" -ForegroundColor Cyan

Write-Host "1. Debugger Detection: " -NoNewline
$debuggers = @(
    "ollydbg.exe", "x64dbg.exe", "x32dbg.exe", "ida.exe", "ida64.exe",
    "idaq.exe", "idaq64.exe", "ghidra.exe", "cutter.exe", "radare2.exe",
    "windbg.exe", "immunity debugger.exe", "cheat engine.exe", "artmoney.exe", "gamehack.exe",
    "wireshark.exe", "fiddler.exe", "charles.exe", "httpdebugger.exe", "burpsuite.exe",
    "process hacker.exe", "processhacker.exe", "process explorer.exe", "procmon.exe", "procexp.exe",
    "dnspy.exe", "dnspy-netcore.exe", "de4dot.exe", "ilspy.exe", "dotpeek.exe",
    "justdecompile.exe", "reflexil.exe", "reshacker.exe", "extremedumper.exe", "scylla.exe",
    "pe-bear.exe", "reclass.net.exe", "megadumper.exe", "xenos.exe", "GH Injector.exe"
)
$runningProcesses = Get-Process | Select-Object -ExpandProperty ProcessName | ForEach-Object { $_.ToLower() }
$debuggerFound = $false

foreach ($debugger in $debuggers) {
    if ($runningProcesses -contains $debugger) {
        $debuggerFound = $true
        break
    }
}

if ($debuggerFound) {
    Write-Host "FAILED - Debugger detected!" -ForegroundColor Red
} else {
    Write-Host "PASSED - No debuggers found" -ForegroundColor Green
}

# Test 2: VM Detection
Write-Host "2. VM Detection: " -NoNewline
$vmIndicators = @(
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
)
# Manufacturer, product name, BIOS info
# ... existing code ...
# Registry keys (stub)
# TODO: Implement registry key checks for VM indicators
# System files (stub)
# TODO: Implement system file checks for VM indicators
# MAC addresses (stub)
# TODO: Implement MAC address checks for VM indicators

try {
    $manufacturer = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SystemInformation" -Name "SystemManufacturer" -ErrorAction SilentlyContinue
    $model = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SystemInformation" -Name "SystemProductName" -ErrorAction SilentlyContinue
    
    $systemInfo = ($manufacturer.SystemManufacturer + " " + $model.SystemProductName).ToLower()
    $vmFound = $false
    
    foreach ($indicator in $vmIndicators) {
        if ($systemInfo -like "*$($indicator.ToLower())*") {
            $vmFound = $true
            break
        }
    }
    
    if ($vmFound) {
        Write-Host "FAILED - Virtual machine detected!" -ForegroundColor Red
    } else {
        Write-Host "PASSED - No VM detected" -ForegroundColor Green
    }
} catch {
    Write-Host "SKIPPED - Could not access system information" -ForegroundColor Yellow
}

# Test 3: IsDebuggerPresent
Write-Host "3. IsDebuggerPresent: " -NoNewline
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class DebuggerCheck {
    [DllImport("kernel32.dll")]
    public static extern bool IsDebuggerPresent();
}
"@

if ([DebuggerCheck]::IsDebuggerPresent()) {
    Write-Host "FAILED - Debugger present!" -ForegroundColor Red
} else {
    Write-Host "PASSED - No debugger present" -ForegroundColor Green
}

# Test 4: Timing Anomalies
Write-Host "4. Timing Anomalies: " -NoNewline
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Perform some operations that would be slowed by a debugger
for ($i = 0; $i -lt 100000; $i++) {
    $null = [System.Math]::Sin($i)
}

$stopwatch.Stop()
$elapsedMs = $stopwatch.ElapsedMilliseconds

if ($elapsedMs -gt 100) {
    Write-Host "FAILED - Timing anomalies detected! ($elapsedMs ms)" -ForegroundColor Red
} else {
    Write-Host "PASSED - No timing anomalies ($elapsedMs ms)" -ForegroundColor Green
}

Write-Host "=============================" -ForegroundColor Cyan

# Test 5: HWID Generation
Write-Host ""
Write-Host "=== HWID Generation Test ===" -ForegroundColor Cyan

try {
    $machineGuid = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -ErrorAction SilentlyContinue
    if ($machineGuid.MachineGuid) {
        Write-Host "Machine GUID: $($machineGuid.MachineGuid)" -ForegroundColor White
        Write-Host "HWID Test: PASSED" -ForegroundColor Green
    } else {
        Write-Host "HWID Test: FAILED - Could not retrieve Machine GUID" -ForegroundColor Red
    }
} catch {
    Write-Host "HWID Test: FAILED - Registry access denied" -ForegroundColor Red
}

Write-Host "============================" -ForegroundColor Cyan

# Test 6: Network Connectivity
Write-Host ""
Write-Host "=== Network Connectivity Test ===" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "https://backend-server-trhh.onrender.com/api/health" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "Network Test: PASSED - Backend connection successful" -ForegroundColor Green
    } else {
        Write-Host "Network Test: FAILED - Backend returned status $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "Network Test: FAILED - Could not connect to backend" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "=================================" -ForegroundColor Cyan

# Test 7: Registry Access
Write-Host ""
Write-Host "=== Registry Access Test ===" -ForegroundColor Cyan

try {
    [void](Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion" -Name "ProgramFilesDir" -ErrorAction Stop)
    Write-Host "Registry Test: PASSED - Can access registry" -ForegroundColor Green
} catch {
    Write-Host "Registry Test: FAILED - Cannot access registry" -ForegroundColor Red
}

Write-Host "============================" -ForegroundColor Cyan

# Test 8: Process Information Access
Write-Host ""
Write-Host "=== Process Information Test ===" -ForegroundColor Cyan

try {
    $processCount = (Get-Process).Count
    Write-Host "Process Test: PASSED - Can enumerate $processCount processes" -ForegroundColor Green
} catch {
    Write-Host "Process Test: FAILED - Cannot enumerate processes" -ForegroundColor Red
}

Write-Host "================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Test completed successfully!" -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 