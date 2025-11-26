# ============================================
# Build Stage
# ============================================
FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --shamefully-hoist

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL
ARG VITE_DOCKER_BACKEND_URL
ARG APP_URL
ARG WEBHOOK_URL

# Set environment variables for Vite build
ENV VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_DOCKER_BACKEND_URL=${VITE_DOCKER_BACKEND_URL}
ENV APP_URL=${APP_URL}
ENV WEBHOOK_URL=${WEBHOOK_URL}

# Build the application
RUN pnpm run build

# ============================================
# Runtime Stage
# ============================================
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]