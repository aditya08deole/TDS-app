# ─── Windows 24/7 Automated Docker Deployment Script ───
# Run in PowerShell: .\deploy-windows.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "TDS-APP Continuous Windows Deployment & Health Check" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Docker CLI & Engine Status
Write-Host "`nChecking Docker Engine availability..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    Write-Host "Docker Engine is running on Windows!" -ForegroundColor Green
} catch {
    Write-Host "Docker Engine is NOT running or Docker Desktop is closed." -ForegroundColor Red
    Write-Host "Please launch Docker Desktop on Windows and try again." -ForegroundColor Red
    Exit 1
}

# 2. Build and Launch Background Containers
Write-Host "`nBuilding and launching containerized services in background daemon mode..." -ForegroundColor Yellow
docker-compose up -d --build

# 3. Wait for Containers to Initialize
Write-Host "`nWaiting 10 seconds for backend and Redis services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. Display Container Status
Write-Host "`nContainer Status Overview:" -ForegroundColor Yellow
docker-compose ps

# 5. Execute Automated Seeding Script inside Backend Container
Write-Host "`nExecuting automated Firestore admin seeding inside container..." -ForegroundColor Yellow
try {
    docker exec tds-backend npm run setup:admin
} catch {
    Write-Host "Warning: Admin setup seeding inside container produced an error." -ForegroundColor Red
}

# 6. Verify Backend Health Check Endpoint
Write-Host "`nTesting Backend Health Check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get
    Write-Host "Health Check Status: $($healthResponse.status)" -ForegroundColor Green
    Write-Host "Redis Service:       $($healthResponse.services.redis)" -ForegroundColor Green
    Write-Host "ThingSpeak Monitor:  $($healthResponse.services.thingspeak_monitor)" -ForegroundColor Green
} catch {
    Write-Host "Health Check probe failed or timed out." -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "Continuous Windows Deployment Complete!" -ForegroundColor Green
Write-Host "  Dashboard:    http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "  Health Check: http://localhost:5000/health" -ForegroundColor Cyan
Write-Host "  Restart:      unless-stopped 24/7 Auto-Recovery" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
