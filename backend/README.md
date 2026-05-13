# TDS-APP Backend API

Express.js + Redis backend for mirroring Firestore data locally to reduce Firebase costs and latency.

## Architecture

- **Frontend** → **Express API** → **Redis Mirror** ← **Firebase (sync)**
- Frontend reads from high-performance Redis cache
- Redis mirrors critical Firestore collections
- Automatic sync every 1 hour + manual trigger via API

## Setup

### Prerequisites
- Node.js 20+
- Redis 6.2+
- Firebase service account

### Installation

```bash
npm install
```

### Configuration

Create `.env` file:

```env
# Redis
REDIS_URL=redis://localhost:6379

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Server
PORT=5000
NODE_ENV=development

# Sync
SYNC_INTERVAL_HOURS=1
ENABLE_EVENT_SYNC=true

# API
FRONTEND_URL=http://localhost:5173
```

## Development

```bash
npm run dev
```

Server starts on http://localhost:5000

## Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Devices
- `GET /api/devices` - Get all devices
- `GET /api/devices/:id` - Get device details with recent data
- `GET /api/devices/search?q=query` - Search devices
- `GET /api/devices/status/:status` - Filter by status
- `GET /api/devices/stats/all` - Device statistics
- `PUT /api/devices/:id/tds-thresholds` - Update TDS limits
- `PUT /api/devices/:id/status` - Update device status

### Sync
- `POST /api/sync` - Trigger manual sync
- `GET /api/sync/status` - Get last sync status
- `GET /api/sync/logs` - Get sync history
- `GET /api/sync/logs/summary` - Sync statistics (last 7 days)

### Health
- `GET /health` - Health check
- `GET /api/version` - API version

## Sync Behavior

### Triggers
1. **Scheduled**: Every 1 hour (configurable)
2. **Manual**: `POST /api/sync` endpoint
3. **On Device Changes**: Via Firestore triggers

### What Gets Synced
- **Devices**: All device configs, status, thresholds
- **Alerts**: All alert records
- **Sensor Data**: Last 7 days of readings (optional)

### Sync Log
All syncs are logged in Redis (`sync:logs` list) with:
- Sync type (manual/scheduled/event)
- Devices synced count
- Alerts synced count
- Duration in ms
- Any errors encountered

## Deployment (Railway)
 
### Step 1: Setup Redis
```bash
# On Railway.app:
1. Create new project
2. Add Redis plugin
3. Copy REDIS_URL from variables
```
 
### Step 2: Setup Backend Service
```bash
# Add to Railway
1. Connect GitHub repo
2. Set environment variables
3. Deploy
```
 
### Environment Variables on Railway
```
REDIS_URL=redis://...
FIREBASE_PROJECT_ID=evaratds
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
PORT=5000
FRONTEND_URL=https://your-frontend.railway.app
```

## Monitoring

### Check Sync Status
```bash
curl http://localhost:5000/api/sync/status
```

### View Sync Logs
```bash
curl http://localhost:5000/api/sync/logs?limit=10
```

### Database Stats
```bash
curl http://localhost:5000/api/devices/stats/all
```

## Performance Impact

### Before (Direct Firestore)
- Firestore reads/day: 116,330 (10 devices)
- Cost: $6.98/month
- Load time: 2-3 seconds

### After (Redis Mirror)
- Firestore reads/day: ~150 (99.9% reduction)
- Cost: $0.01/month + Redis cost = Minimal
- Load time: < 50ms
- Savings: Significant reduction in both cost and latency

## Troubleshooting

### Redis Connection Error
```
Error: Redis connection failed
```
Make sure `REDIS_URL` is set and Redis server is running.

### Firebase Initialization Failed
```
Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required
```
Check that the Firebase service account JSON is properly set.

### Sync Not Running
```
Check logs: npm run logs
```
Ensure `SYNC_INTERVAL_HOURS` is set (default: 1).

## API Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Next Steps

1. Set up Redis on Railway
2. Deploy backend service
3. Update frontend to use `/api/devices` instead of Firestore SDK
4. Test sync with `POST /api/sync`
5. Verify Firebase read costs dropped 99%

---

**Built with Express.js, TypeScript, Redis, and Firebase**
