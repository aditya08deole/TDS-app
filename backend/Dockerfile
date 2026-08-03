# ─── Stage 1: Build Stage ───
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY . .
RUN npm run build

# ─── Stage 2: Production Runner Stage ───
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Expose backend API port
EXPOSE 5000

# Start server
CMD ["node", "dist/server.js"]
