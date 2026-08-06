# Cloudflare Tunnel Launcher for EvaraTDS Backend
# Automatically fetches cloudflared.exe and creates an encrypted outbound HTTPS tunnel to localhost:5000

$tunnelDir = "$PSScriptRoot\tools"
$cloudflaredPath = "$tunnelDir\cloudflared.exe"

if (-not (Test-Path $tunnelDir)) {
    New-Item -ItemType Directory -Path $tunnelDir | Out-Null
}

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Downloading Cloudflare Tunnel binary (cloudflared.exe)..."
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $cloudflaredPath
    Write-Host "cloudflared.exe downloaded successfully!"
}

Write-Host "Launching Cloudflare Tunnel to http://localhost:5000..."
& $cloudflaredPath tunnel --url http://localhost:5000
