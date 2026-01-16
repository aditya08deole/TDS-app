# ==========================================
# Flutter Web App Docker Build
# ==========================================
FROM ghcr.io/cirruslabs/flutter:stable AS build

# Set working directory
WORKDIR /app

# Copy pubspec files first for better caching
COPY pubspec.yaml pubspec.lock* ./

# Get Flutter dependencies
RUN flutter pub get

# Copy the rest of the source code
COPY . .

# Build arguments for secrets
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY

# Create .env file from build arguments
RUN echo "SUPABASE_URL=${SUPABASE_URL}" > .env && \
    echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .env

# Build Flutter web app
RUN flutter build web --release --no-tree-shake-icons

# ==========================================
# Production Stage - Serve with Nginx
# ==========================================
FROM nginx:alpine

# Copy built web files to nginx
COPY --from=build /app/build/web /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
