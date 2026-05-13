# 🚀 COMPLETE SETUP GUIDE - Redis + L1 Cache Backend Integration

**Total Time: ~45 minutes | High-Performance Multi-Layer Caching**

---

## ⏱️ PHASE 1: Local Setup (10 minutes)

### Step 1: Setup Redis (L2 Cache) (2 minutes)

**Option A: Docker (Easiest)**
```bash
docker run --name tds-redis -p 6379:6379 -d redis:alpine

# Verify it's running
docker ps
```

**Option B: Manual Install**
- [Download Redis](https://redis.io/download/)
- Start redis-server

### Step 2: Initialize Backend (5 minutes)

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with these values:
cat > .env << 'EOF'
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=evaratds
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"evaratds",...}
PORT=5000
NODE_ENV=development
SYNC_INTERVAL_HOURS=1
ENABLE_EVENT_SYNC=true
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:5000
EOF
```

### Step 3: Start Backend Server (2 minutes)

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Expected output:
# ✅ Firebase initialized
# ✅ Redis connection initialized
# ✅ L1 Local Cache initialized
# ✅ Sync scheduler started - running every 1 hour
# 📡 Running initial sync...
# ✅ Initial sync complete: X devices
# ✅ Server running on port 5000
```

### Step 4: Test Backend API (1 minute)

```bash
# Terminal 2: Test endpoints

# Health check
curl http://localhost:5000/health

# Get devices (from Multi-Layer Cache: L1 -> L2)
curl http://localhost:5000/api/devices

# Trigger manual sync
curl -X POST http://localhost:5000/api/sync
```

✅ **All endpoints working? Move to Phase 2!**

---

## ⏱️ PHASE 2: Frontend Integration (15 minutes)

### Step 5: Update useDeviceQueries.tsx

Replace direct Firestore SDK calls with Backend API calls.

**AFTER:**
```typescript
export function useDevices() {
    return useQuery({
        queryKey: queryKeys.devices(),
        queryFn: async () => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/devices`)
            if (!response.ok) throw new Error('Failed to fetch devices')
            const { data } = await response.json()
            return data as Device[]
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: 60 * 1000, // Refetch every minute
    })
}
```

### Step 6: Add "Fetch Latest" Button

Add a button in `Devices.tsx` to trigger manual synchronization.

```typescript
const handleManualSync = async () => {
    setIsSyncing(true)
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sync`, { method: 'POST' })
        const result = await response.json()
        if (result.success) {
            alert('✅ Sync complete!')
            await refetch()
        }
    } catch (error) {
        alert('❌ Error: ' + error.message)
    } finally {
        setIsSyncing(false)
    }
}
```

---

## ⏱️ PHASE 3: Deploy to Railway (20 minutes)

### Step 7: Add Redis Service

In Railway UI:
1. Click "Add Service" → "Database" → "Redis"
2. Copy `REDIS_URL` from Variables tab.

### Step 8: Deploy Backend

In Railway UI:
1. Add service from GitHub repo.
2. Select `/backend` folder.
3. Set variables:
   - `REDIS_URL` = (from Step 7)
   - `FIREBASE_PROJECT_ID` = evaratds
   - `FIREBASE_SERVICE_ACCOUNT_KEY` = (your JSON)
   - `FRONTEND_URL` = (your deployed frontend URL)

---

## 📊 Performance & Architecture

### Multi-Layer Caching Strategy
1. **L1 (Local Memory)**: 0ms latency. Stores high-frequency data for 60s. prunes automatically.
2. **L2 (Redis)**: ~1-5ms latency. Shared across backend instances.
3. **Persistence (Firestore)**: Single source of truth. Accessed only during sync or cache misses.

### Expected Impact
- **Firebase Reads**: Reduced by 99.9% ✅
- **Latency**: <10ms for cached lookups ✅
- **Reliability**: Dual-layer caching ensures data availability even during Firestore spikes.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Redis Connection Error | Check if Redis is running and REDIS_URL is correct |
| Firestore Permission | Verify Firebase Service Account Key has proper access |
| CORS Errors | Ensure FRONTEND_URL in backend matches your frontend domain |
| Memory Usage | L1 cache prunes items after 60s to maintain low footprint |

---

**🚀 System is now ultra-fast and cost-optimized!**
