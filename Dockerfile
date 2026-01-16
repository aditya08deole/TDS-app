# Stage 1: Build Flutter Web
FROM ghcr.io/cirruslabs/flutter:3.10.4 AS build

WORKDIR /app

# Copy dependency definitions
COPY pubspec.yaml pubspec.lock ./

# Get dependencies
RUN flutter pub get

# Copy source code
COPY . .

# Argument for Secrets (Passed from Render)
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY

# Create .env file from Arguments
RUN echo "SUPABASE_URL=$SUPABASE_URL" > .env
RUN echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env

# Build Web
RUN flutter build web --release --no-tree-shake-icons

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets to Nginx html folder
COPY --from=build /app/build/web /usr/share/nginx/html

# Expose Port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
