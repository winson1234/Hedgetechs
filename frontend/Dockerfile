# ============================================
# Build Stage
# ============================================
FROM node:20-alpine AS builder

RUN apk add --no-cache bash
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build arguments (REMOVED SUPABASE VARIABLES)
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_API_URL
ARG APP_URL
ARG WEBHOOK_URL

# Set environment variables
ENV VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
ENV VITE_API_URL=${VITE_API_URL}
ENV APP_URL=${APP_URL}
ENV WEBHOOK_URL=${WEBHOOK_URL}

RUN pnpm run build

# ============================================
# Runtime Stage
# ============================================
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]