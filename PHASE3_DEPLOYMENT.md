# 🚀 PHASE 3: Railway Deployment (20 minutes)

## Prerequisites
- ✅ PostgreSQL + Backend running locally (Phase 1)
- ✅ Frontend updated with API integration (Phase 2)
- Railway account (create at https://railway.app)
- GitHub account with TDS-APP repo

---

## Step 1: Create Railway Account & Project (2 min)

```bash
1. Go to https://railway.app
2. Sign up with GitHub (authenticate)
3. Click "Create New Project"
4. Select "Provision PostgreSQL" from the template
   OR click "Add Service" → "Database" → "PostgreSQL"
```

### What to do:
- ✅ Create new Railway account
- ✅ Create new project (any name, e.g., "TDS-APP")
- ✅ PostgreSQL will auto-provision with credentials

---

## Step 2: Deploy PostgreSQL (2 min)

Railway automatically creates PostgreSQL when you provision it.

**Get the DATABASE_URL:**
```
1. In Railway dashboard, click the PostgreSQL service
2. Go to "Variables" tab
3. Copy the DATABASE_URL (looks like: postgresql://username:password@host:port/database)
4. Save this for backend deployment
```

---

## Step 3: Deploy Backend Service (8 min)

### Option A: Connect GitHub Repository (Recommended)

```bash
In Railway Dashboard:
1. Click "New" → "GitHub Repository"
2. Authorize GitHub if needed
3. Select "aditya08deole/TDS-APP" (your repo)
4. Select root directory: `/backend`
5. Click "Deploy"

# After service creates:
6. Go to the Backend service
7. Click "Variables" tab
8. Add these environment variables:

   DATABASE_URL = [paste from PostgreSQL]
   FIREBASE_PROJECT_ID = evaratds
   FIREBASE_SERVICE_ACCOUNT_KEY = [paste your full JSON key]
   PORT = 5000
   NODE_ENV = production
   SYNC_INTERVAL_HOURS = 1
   ENABLE_EVENT_SYNC = true
   FRONTEND_URL = https://[YOUR_FRONTEND_DOMAIN] (set after frontend deployed)
   LOG_LEVEL = info

9. Service auto-redeploys with new variables
10. Wait for green "Active" status
```

### Option B: Manual Deployment

```bash
# Build backend
cd backend
npm run build

# Deploy using Railway CLI
railway login
railway link
railway up
```

---

## Step 4: Get Backend URL

```
After Backend service is deployed:
1. Go to Backend service
2. Click "Settings" tab
3. Under "Domains", copy the auto-generated URL
   (looks like: https://backend-abc123.railway.app)
4. Save this for frontend configuration
```

**Backend URL Format:** `https://backend-{id}.railway.app`

---

## Step 5: Deploy Frontend Service (7 min)

### In Railway Dashboard:

```bash
1. Click "New" → "GitHub Repository"
2. Select TDS-APP repo
3. Select root directory: `/admin_dashboard`
4. Click "Deploy"

After service creates:
5. Go to Frontend service
6. Click "Variables" tab
7. Add environment variable:

   VITE_API_URL = https://backend-abc123.railway.app

8. Service auto-redeploys
9. Wait for green "Active" status
10. Click "Settings" → "Domains" to get frontend URL
    (looks like: https://frontend-xyz789.railway.app)
```

---

## Step 6: Update Backend FRONTEND_URL (1 min)

```bash
Now that frontend is deployed:
1. Go back to Backend service
2. Click "Variables" tab
3. Update FRONTEND_URL to the frontend URL from Step 5
4. Service auto-redeploys
```

---

## Step 7: Verify Deployment (2 min)

### Test Backend Endpoints:

```bash
# Health check
curl https://backend-abc123.railway.app/health

# Get devices (should be empty)
curl https://backend-abc123.railway.app/api/devices

# Trigger sync
curl -X POST https://backend-abc123.railway.app/api/sync

# Get sync status
curl https://backend-abc123.railway.app/api/sync/status
```

**Expected Responses:**
```json
✅ /health
{"status":"healthy","timestamp":"2026-05-13T..."}

✅ /api/devices
{"success":true,"data":[],"timestamp":"2026-05-13T..."}

✅ /api/sync
{"success":true,"data":{"devicesSynced":0,...}}
```

### Test Frontend:

```bash
1. Open https://frontend-xyz789.railway.app in browser
2. Login with your credentials
3. Go to Devices page
4. Should load devices from backend API (empty list initially)
5. Click "Fetch Latest" button
6. Should trigger sync from Firebase
```

---

## Step 8: Verify Firebase Quota Reduction (1 min)

```bash
In Firebase Console:
1. Go to Firestore → Usage tab
2. Check last 24 hours of reads
3. Should see ~150 reads/day (down from 116,000 baseline)
4. Daily cost: ~$0.01 (down from $6.98)
```

---

## Railway Configuration Files

All three config files are already set up:

### `/backend/railway.json`
```json
{
  "build": {"builder": "NIXPACKS", "buildCommand": "npm run build"},
  "deploy": {
    "startCommand": "npm start",
    "healthCheckPath": "/health"
  }
}
```

### `/admin_dashboard/railway.json`
```json
{
  "build": {"builder": "NIXPACKS", "buildCommand": "npm run build"},
  "deploy": {
    "startCommand": "npm start",
    "healthCheckPath": "/"
  }
}
```

**Railway auto-detects these files and uses them for deployment!**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check DATABASE_URL is correct, FIREBASE_SERVICE_ACCOUNT_KEY is valid JSON |
| CORS errors | Check FRONTEND_URL is set correctly in backend variables |
| Frontend can't reach API | Verify VITE_API_URL points to correct backend URL |
| Sync shows 0 devices | Normal - Firebase might not have data. Check with manual sync |
| Port errors | Railway assigns PORT automatically via PORT env var |

---

## Environment Variables Summary

### Backend Required:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
FIREBASE_PROJECT_ID=evaratds
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
```

### Frontend Required:
```
VITE_API_URL=https://your-backend-domain
```

---

## Cost Breakdown (Monthly)

| Service | Before | After | Savings |
|---------|--------|-------|---------|
| Firebase Firestore | $6.98 | $0.01 | -$6.97 ✅ |
| PostgreSQL (Railway) | - | $5.00 | +$5.00 |
| **Total** | **$6.98** | **$5.01** | **-$1.97 (28%)** |

---

## Success Metrics

✅ Backend API responding on Railway domain
✅ Frontend loads and connects to backend API
✅ "Fetch Latest" button triggers manual sync
✅ Firebase daily reads dropped 99% (116k → ~150)
✅ Monthly cost reduced by 28%
✅ Device list loads in <500ms (was 2-3 seconds)

---

**You're Done! 🎉 System is Production-Ready on Railway**
