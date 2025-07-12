# Test KeyAuth HWID Validation
# This script actually tests the license validation against your backend

Write-Host "KeyAuth HWID Validation Test" -ForegroundColor Green
Write-Host "Testing actual license validation with backend..." -ForegroundColor Yellow
Write-Host ""

# Get Machine GUID (part of HWID)
try {
    $machineGuid = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid" -ErrorAction Stop
    Write-Host "Machine GUID: $($machineGuid.MachineGuid)" -ForegroundColor White
} catch {
    Write-Host "ERROR: Could not retrieve Machine GUID" -ForegroundColor Red
    exit 1
}

# Generate a simple HWID (in production, this would be more complex)
$hwid = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($machineGuid.MachineGuid))
$hwidHex = -join ($hwid | ForEach-Object { $_.ToString("x2") })

Write-Host "Generated HWID: $hwidHex" -ForegroundColor White
Write-Host ""

# Test license validation
Write-Host "=== License Validation Test ===" -ForegroundColor Cyan

# You'll need to replace this with your actual license key
$licenseKey = "YOUR_LICENSE_KEY_HERE"
$backendUrl = "https://backend-server-trhh.onrender.com"

if ($licenseKey -eq "YOUR_LICENSE_KEY_HERE") {
    Write-Host "WARNING: Please set your actual license key in the script" -ForegroundColor Yellow
    Write-Host "Skipping validation test..." -ForegroundColor Yellow
} else {
    try {
        $body = @{
            key = $licenseKey
            hwid = $hwidHex
            displayName = $env:USERNAME
        } | ConvertTo-Json

        $headers = @{
            "Content-Type" = "application/json"
        }

        Write-Host "Sending validation request to: $backendUrl/api/validate-key" -ForegroundColor White
        Write-Host "License Key: $licenseKey" -ForegroundColor White
        Write-Host "HWID: $hwidHex" -ForegroundColor White
        Write-Host "Display Name: $($env:USERNAME)" -ForegroundColor White
        Write-Host ""

        $response = Invoke-RestMethod -Uri "$backendUrl/api/validate-key" -Method POST -Body $body -Headers $headers -TimeoutSec 30

        Write-Host "Response received:" -ForegroundColor Green
        $response | ConvertTo-Json -Depth 3 | Write-Host

        if ($response.success) {
            Write-Host "✅ License validation: PASSED" -ForegroundColor Green
            Write-Host "Token: $($response.token)" -ForegroundColor White
            Write-Host "Session ID: $($response.sessionId)" -ForegroundColor White
        } else {
            Write-Host "❌ License validation: FAILED" -ForegroundColor Red
            Write-Host "Error: $($response.error)" -ForegroundColor Red
        }

    } catch {
        Write-Host "❌ License validation: FAILED" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode
            Write-Host "HTTP Status: $statusCode" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== HWID Storage Check ===" -ForegroundColor Cyan
Write-Host "Note: This HWID will be stored in KeyAuth when first validated" -ForegroundColor Yellow
Write-Host "If this is a new license, it will be bound to this hardware" -ForegroundColor Yellow
Write-Host "If this license is already bound to different hardware, validation will fail" -ForegroundColor Yellow

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 