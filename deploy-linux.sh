#!/usr/bin/env bash
# ─── EvaraTDS Unified Automated Deployment & Public Tunnel Script (Linux/macOS) ───
set -e

echo "======================================================================"
echo "🚀 EvaraTDS Autonomous Production Deployment Engine (Linux/macOS)"
echo "======================================================================"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo -e "\n🐳 Docker Engine Detected — Deploying via Docker Compose..."
    docker-compose up -d --build
    echo "Waiting 10s for container initialization..."
    sleep 10
    docker-compose ps
else
    echo -e "\n⚡ Deploying via Native Process Manager (PM2)..."
    cd "$SCRIPT_DIR/backend"
    npm run build

    if ! command -v pm2 &> /dev/null; then
        echo "📥 Installing PM2 globally..."
        npm install -g pm2
    fi

    pm2 start ecosystem.config.js --update-env
    pm2 save
    cd "$SCRIPT_DIR"
fi

echo -e "\n======================================================================"
echo "✅ EvaraTDS Deployment Complete!"
echo "  Local Web Dashboard:  http://localhost:8080"
echo "  Local Backend API:    http://localhost:5000"
echo "  Health Endpoint:      http://localhost:5000/health"
echo "======================================================================"
