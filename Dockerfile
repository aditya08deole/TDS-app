# Multi-stage build to keep production image lightweight.
#
# This is a SINGLE unified deployment: the backend (server.ts) serves both
# the API and the built frontend static files (via express.static +
# getFrontendPath(), which resolves to admin_dashboard/dist relative to the
# process cwd). Both halves must be built and copied into the final image —
# a backend-only build leaves admin_dashboard/dist missing, and every
# frontend request silently falls through to server.ts's tiny JSON fallback
# instead of real files (this was live in production: manifest.json, sw.js,
# bg-*.jpg, and even SPA routes were all returning that same ~129-byte
# fallback instead of actual content).

# ─── Stage 1: Backend Builder ───
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json ./
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/
RUN cd backend && npm run build

# ─── Stage 2: Frontend Builder ───
FROM node:20-alpine AS frontend-builder

WORKDIR /app/admin_dashboard

COPY admin_dashboard/package*.json ./
RUN npm ci

COPY admin_dashboard/ ./

# Vite bakes VITE_* variables into the built JS at build time (not runtime),
# so they must be passed as build args. Railway automatically forwards any
# service Variable of the same name as a build ARG when the Dockerfile
# declares it — set these in the Railway service's Variables tab.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Stage 3: Production Runner ───
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy root package.json
COPY package.json ./

# Copy backend package.json and install only production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy compiled backend and built frontend from their respective builder stages
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/admin_dashboard/dist ./admin_dashboard/dist

# Expose the API server port
EXPOSE 5000

# Run the production build — serves both the API and the frontend
CMD ["node", "backend/dist/server.js"]
