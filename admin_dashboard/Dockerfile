# ─── Stage 1: Build Stage ───
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
RUN npm ci

# Copy source code and build Vite SPA
COPY . .
RUN npm run build

# ─── Stage 2: Production Nginx Server ───
FROM nginx:alpine AS runner

# Copy compiled static output from builder to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
