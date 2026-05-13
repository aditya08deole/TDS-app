# 🚀 PHASE 3: Railway Deployment (20 minutes)

## Prerequisites
- ✅ Redis + Backend running locally (Phase 1)
- ✅ Frontend updated with API integration (Phase 2)
- Railway account (create at https://railway.app)
- GitHub account with TDS-APP repo

---

## Step 1: Provision Redis (L2 Cache) (2 min)

In Railway UI:
1. Click "Add Service" → "Database" → "Redis"
2. Wait for it to provision.
3. Go to the Redis service → "Variables" tab.
4. Copy the `REDIS_URL`.

---

## Step 2: Deploy Backend Service (8 min)

In Railway UI:
1. Click "New" → "GitHub Repository"
2. Select "aditya08deole/TDS-APP"
3. Select root directory: `/backend`
4. Click "Deploy"

### Configuration (Variables):
Add these environment variables in the Backend service:
- `REDIS_URL` = (Paste from Step 1)
- `FIREBASE_PROJECT_ID` = evaratds
- `FIREBASE_SERVICE_ACCOUNT_KEY` = (Your full JSON key)
- `PORT` = 5000
- `NODE_ENV` = production
- `SYNC_INTERVAL_HOURS` = 1
- `ENABLE_EVENT_SYNC` = true
- `FRONTEND_URL` = (Your frontend domain, set after Step 3)
- `API_URL` = (Your backend domain URL)

---

## Step 3: Deploy Frontend Service (7 min)

In Railway UI:
1. Click "New" → "GitHub Repository"
2. Select TDS-APP repo.
3. Select root directory: `/admin_dashboard`
4. Set Variable: `VITE_API_URL` = (Your backend URL)
5. Click "Deploy"

---

## Step 4: Verify Deployment (3 min)

### Test Backend:
```bash
# Health check
curl https://your-backend.railway.app/health

# Trigger sync
curl -X POST https://your-backend.railway.app/api/sync
```

### Test Frontend:
1. Open your frontend URL.
2. Verify devices load instantly.
3. Check the "Fetch Latest" button functionality.

---

## 📊 Deployment Success Metrics

- **Latency**: Sub-10ms (Redis + L1 Cache)
- **Quotas**: 99.9% Firebase read reduction
- **Reliability**: Scalable across multiple backend instances via Redis

---

**You're Done! 🎉 System is Production-Ready on Railway**
