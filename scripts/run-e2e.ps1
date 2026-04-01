<#
.SYNOPSIS
    E2E Test Runner for Windows PowerShell

.DESCRIPTION
    Starts API (H2 in-memory) + UI dev server, runs Playwright, then cleans up.

.PARAMETER Module
    Specific module to test (master-data, costing, orders, bom, po, admin, validation).
    If omitted, runs all modules.

.PARAMETER Headed
    Run tests in headed mode (visible browser).

.EXAMPLE
    .\scripts\run-e2e.ps1
    .\scripts\run-e2e.ps1 -Module costing
    .\scripts\run-e2e.ps1 -Module validation -Headed
#>

param(
    [string]$Module = "",
    [switch]$Headed
)

$ErrorActionPreference = "Stop"

$ApiRepoPath = if ($env:API_REPO_PATH) { $env:API_REPO_PATH } else { Join-Path $PSScriptRoot "..\..\erp-purchase" }
$ApiPort = if ($env:SERVER_PORT) { $env:SERVER_PORT } else { "8088" }
$UiPort = "3000"
$ApiJob = $null
$UiJob = $null

function Cleanup {
    Write-Host "`nCleaning up..." -ForegroundColor Yellow
    if ($ApiJob) { Stop-Job $ApiJob -ErrorAction SilentlyContinue; Remove-Job $ApiJob -ErrorAction SilentlyContinue }
    if ($UiJob) { Stop-Job $UiJob -ErrorAction SilentlyContinue; Remove-Job $UiJob -ErrorAction SilentlyContinue }
    # Kill any lingering java/node processes on our ports
    Get-NetTCPConnection -LocalPort $ApiPort -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Get-NetTCPConnection -LocalPort $UiPort -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "Cleanup complete." -ForegroundColor Green
}

try {
    # ── 1. Start API with H2 ──────────────────────────────────
    Write-Host "Starting API server with H2 database..." -ForegroundColor Yellow
    if (-not (Test-Path $ApiRepoPath)) {
        Write-Host "Error: API repo not found at $ApiRepoPath" -ForegroundColor Red
        Write-Host "Set API_REPO_PATH environment variable." -ForegroundColor Red
        exit 1
    }

    $ApiJob = Start-Job -ScriptBlock {
        param($Path, $Port)
        Set-Location $Path
        $env:SPRING_PROFILES_ACTIVE = "e2e"
        $env:SERVER_PORT = $Port
        & .\gradlew.bat bootRun --quiet
    } -ArgumentList (Resolve-Path $ApiRepoPath), $ApiPort

    # ── 2. Wait for API ────────────────────────────────────────
    Write-Host "Waiting for API on port $ApiPort..." -ForegroundColor Yellow
    $maxWait = 90
    for ($i = 0; $i -lt $maxWait; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$ApiPort/api/v1/categories" -TimeoutSec 2 -ErrorAction Stop
            Write-Host "API is ready!" -ForegroundColor Green
            break
        } catch {
            if ($i -eq ($maxWait - 1)) {
                Write-Host "API failed to start within 3 minutes." -ForegroundColor Red
                Cleanup
                exit 1
            }
            Start-Sleep -Seconds 2
        }
    }

    # ── 3. Start UI ────────────────────────────────────────────
    Write-Host "Starting UI dev server..." -ForegroundColor Yellow
    $UiJob = Start-Job -ScriptBlock {
        param($Path, $ApiUrl)
        Set-Location $Path
        $env:VITE_API_BASE_URL = $ApiUrl
        npm run dev
    } -ArgumentList (Get-Location), "http://localhost:$ApiPort/api/v1"

    # ── 4. Wait for UI ────────────────────────────────────────
    Write-Host "Waiting for UI on port $UiPort..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$UiPort" -TimeoutSec 2 -ErrorAction Stop
            Write-Host "UI is ready!" -ForegroundColor Green
            break
        } catch {
            if ($i -eq 29) {
                Write-Host "UI failed to start within 1 minute." -ForegroundColor Red
                Cleanup
                exit 1
            }
            Start-Sleep -Seconds 2
        }
    }

    # ── 5. Run Playwright ──────────────────────────────────────
    Write-Host "Running E2E tests..." -ForegroundColor Yellow
    $playwrightArgs = @()
    if ($Module) {
        Write-Host "Module: $Module" -ForegroundColor Green
        $playwrightArgs += "--project=$Module"
    } else {
        Write-Host "Module: all" -ForegroundColor Green
    }
    if ($Headed) {
        $env:E2E_HEADED = "true"
        $playwrightArgs += "--headed"
    }

    $testResult = & npx playwright test @playwrightArgs
    $testExit = $LASTEXITCODE

    # ── 6. Report ──────────────────────────────────────────────
    if ($testExit -eq 0) {
        Write-Host "`nAll E2E tests passed!" -ForegroundColor Green
    } else {
        Write-Host "`nSome E2E tests failed. See report: e2e-report\index.html" -ForegroundColor Red
        Write-Host "Run: npx playwright show-report e2e-report" -ForegroundColor Yellow
    }

    exit $testExit
}
finally {
    Cleanup
}
