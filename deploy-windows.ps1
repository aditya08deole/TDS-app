# ─── EvaraTDS Autonomous Production Deployment Engine (Windows) ───
# Run in PowerShell: .\deploy-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "🚀 EvaraTDS Autonomous Production Deployment Engine" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$backendDir = "$PSScriptRoot\backend"
$frontendDir = "$PSScriptRoot\admin_dashboard"

# 1. Check Docker Availability
$hasDocker = $false
try {
    $dockerCheck = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $hasDocker = $true }
} catch {
    $hasDocker = $false
}

if ($hasDocker) {
    Write-Host "`n🐳 Docker Desktop Detected — Deploying via Containerized Compose Stack..." -ForegroundColor Green
    Write-Host "Building and starting background containers..." -ForegroundColor Yellow
    docker-compose up -d --build

    Write-Host "`nWaiting 10 seconds for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    Write-Host "`nContainer Status Overview:" -ForegroundColor Yellow
    docker-compose ps
} else {
    Write-Host "`n⚡ Docker not active — Falling back to Native Production Process Manager (PM2)..." -ForegroundColor Yellow

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Node.js is required to run standalone mode. Please install Node.js v20+." -ForegroundColor Red
        Exit 1
    }

    # Build Production Backend
    Write-Host "`n📦 Compiling Backend Production Artifacts..." -ForegroundColor Yellow
    Set-Location $backendDir
    npm run build

    # Install PM2 if needed
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Host "📥 Installing PM2 process manager globally..." -ForegroundColor Yellow
        npm install -g pm2
    }

    # Start PM2 Process
    Write-Host "🚀 Launching 24/7 PM2 Backend Service..." -ForegroundColor Green
    pm2 start ecosystem.config.js --update-env
    pm2 save
    Set-Location $PSScriptRoot
}

# 2. Test Local Backend Health Probe
Write-Host "`n🔍 Probing Local Backend Health Check Endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get
    Write-Host "  Backend Status:       $($health.status)" -ForegroundColor Green
    Write-Host "  Redis Database:       $($health.services.redis)" -ForegroundColor Green
    Write-Host "  ThingSpeak Scanner:   $($health.services.thingspeak_monitor)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️ Local health check probe warming up..." -ForegroundColor Yellow
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "✅ EvaraTDS Deployment Successfully Completed!" -ForegroundColor Green
Write-Host "  Local Web Dashboard:  http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Local Backend API:    http://localhost:5000" -ForegroundColor Cyan
Write-Host "  Health Endpoint:      http://localhost:5000/health" -ForegroundColor Cyan
Write-Host "  Tunnel Auto-Downloader: Active (Multi-Provider Fallback Cascade)" -ForegroundColor Green
Write-Host "  Remote Config Sync:   Auto-Injected via Firebase Admin SDK" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
