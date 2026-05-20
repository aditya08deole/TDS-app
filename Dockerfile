# Multi-stage build to keep production image lightweight
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for caching
COPY package.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (including devDependencies for tsc)
RUN cd backend && npm ci

# Copy the rest of the backend files
COPY backend/ ./backend/

# Build TypeScript to JS
RUN cd backend && npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy root package.json
COPY package.json ./

# Copy backend package.json and install only production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy compiled files from the builder stage
COPY --from=builder /app/backend/dist ./backend/dist

# Expose the API server port
EXPOSE 5000

# Run the production build
CMD ["node", "backend/dist/server.js"]
