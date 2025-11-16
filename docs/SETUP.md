# Setup Guide

## Environment Variables

### Development (.env file)

Create `.env` file in project root:

```bash
cp env.example .env
```

See `env.example` for complete template. Key variables:

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:password@host.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

# Frontend Supabase
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Market Data - TwelveData WebSocket for Forex/Commodities
MARKET_DATA_PROVIDER=twelvedata
TWELVE_DATA_API_KEY=your_twelve_data_api_key_here
TWELVE_DATA_POLL_INTERVAL=15m
ENABLE_EXTERNAL_FETCH=true

# MT5 Windows Bridge (URL of Windows API server)
WINDOWS_API_URL=http://localhost:5000

# Stripe API Keys (from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# Application URL (for redirects and callbacks)
APP_URL=https://localhost:5173

# Optional: NOWPayments for crypto deposits
NOWPAYMENTS_API_KEY=your_api_key_here

# Optional: Webhook URL (only needed for testing webhooks)
# WEBHOOK_URL=https://your-tunnel-url.trycloudflare.com
```

### Production (Fly.io Secrets)

Set environment variables via Fly.io CLI:

```bash
# Backend secrets
fly secrets set STRIPE_SECRET_KEY=sk_live_your_live_key
fly secrets set APP_URL=https://brokerageproject.fly.dev
fly secrets set NOWPAYMENTS_API_KEY=your_api_key

# View current secrets
fly secrets list
```

Frontend environment variables are set in Cloudflare Pages dashboard:
- Go to Settings → Environment Variables
- Add `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key`

---

## Supabase Setup

1. **Create Supabase Project:**
   - Go to [Supabase Dashboard](https://app.supabase.com/)
   - Click "New Project"
   - Choose organization and region
   - Set database password

2. **Get API Keys:**
   - Go to Project Settings → API
   - Copy:
     - `Project URL` → `SUPABASE_URL`
     - `anon public` key → `SUPABASE_ANON_KEY`
     - `service_role` key (keep secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - Go to Project Settings → JWT Settings
   - Copy `JWT Secret` → `SUPABASE_JWT_SECRET`

3. **Get Database URL:**
   - Go to Project Settings → Database
   - Scroll to "Connection pooling" (Session mode)
   - Copy connection string → `DATABASE_URL`
   - **Important:** Use Session Pooler (port 5432) for IPv4 compatibility
   - Format: `postgresql://postgres.project:password@host.pooler.supabase.com:5432/postgres`

4. **Run Migrations:**
   ```bash
   migrate -path internal/database/migrations -database $DATABASE_URL up
   ```

---

## Docker Compose Setup

The project uses Docker Compose to run Redis and MT5 bridge services locally.

1. **Start Services:**
   ```bash
   docker-compose up -d
   ```

2. **Verify Services Running:**
   ```bash
   docker ps
   # Should show:
   # - brokerage-redis (port 6379)
   # - mt5-bridge (if configured)
   ```

3. **View Logs:**
   ```bash
   docker-compose logs -f          # All services
   docker-compose logs -f redis    # Redis only
   docker-compose logs -f mt5-bridge  # MT5 bridge only
   ```

4. **Stop Services:**
   ```bash
   docker-compose down
   ```

**MT5 Publisher Setup:**

The MT5 bridge publishes real-time forex prices to Redis. See `mt5-publisher/README.md` for detailed setup instructions.

For local development:
1. Run Windows API server on Windows machine: `python windows-api-server.py`
2. Update `.env` with `WINDOWS_API_URL=http://localhost:5000`
3. Start bridge: `docker-compose up -d mt5-bridge`

---

## Database Migrations

The project uses [golang-migrate](https://github.com/golang-migrate/migrate) for schema management.

**Install golang-migrate:**
```powershell
# Windows
choco install golang-migrate

# Or download binary from GitHub releases
```

**Run Migrations:**
```bash
# Apply all migrations
migrate -path internal/database/migrations -database $DATABASE_URL up

# Rollback last migration
migrate -path internal/database/migrations -database $DATABASE_URL down 1

# Check current version
migrate -path internal/database/migrations -database $DATABASE_URL version

# Force version (if dirty state)
migrate -path internal/database/migrations -database $DATABASE_URL force VERSION
```

**Create New Migration:**
```bash
migrate create -ext sql -dir internal/database/migrations -seq description_here
```

This creates two files:
- `NNNN_description_here.up.sql` - Apply changes
- `NNNN_description_here.down.sql` - Rollback changes

---

## Local HTTPS Setup

HTTPS is **required** for testing Stripe Express Checkout (Google Pay, Apple Pay, Link) and secure WebSocket connections (WSS).

### Quick Setup with mkcert

**1. Install mkcert:**

```powershell
# Windows (Chocolatey)
choco install mkcert

# Install local Certificate Authority
mkcert -install
```

**2. Generate certificates:**

```powershell
# Navigate to project root
cd project\path

# Generate certificates
mkcert localhost 127.0.0.1 ::1
```

**Output:**
- `localhost+2.pem` - SSL certificate
- `localhost+2-key.pem` - Private key

**3. Start development servers:**

Both frontend and backend will automatically detect the certificates and start in HTTPS mode.

```powershell
# Terminal 1: Backend (https://localhost:8080)
cd cmd\server
go run main.go

# Terminal 2: Frontend (https://localhost:5173)
cd frontend
pnpm run dev
```

**4. Verify:**
- Open `https://localhost:5173` in browser
- No security warnings
- Express Checkout buttons appear when depositing ≥ $5

### Troubleshooting

**Certificates not detected:**
```powershell
# Verify files exist in project root
dir localhost+2*.pem

# If missing, regenerate
mkcert localhost 127.0.0.1 ::1
```

**Browser shows "Not Secure":**
```powershell
# Reinstall Certificate Authority
mkcert -uninstall
mkcert -install

# Regenerate certificates
rm localhost+2*.pem
mkcert localhost 127.0.0.1 ::1

# Restart browser
```

**WebSocket connection failed:**
- Ensure both frontend and backend are using HTTPS
- Check browser console for WSS connection (not WS)
- Hard refresh browser (Ctrl+Shift+F5)

### Testing Webhooks (Optional)

For testing NOWPayments or other webhooks that need external access:

```powershell
# Install Cloudflare Tunnel
winget install --id Cloudflare.cloudflared

# Start tunnel
cloudflared tunnel --url https://localhost:8080 --no-tls-verify

# Copy the generated URL (e.g., https://abc-xyz.trycloudflare.com) and add to .env:
WEBHOOK_URL=https://abc-xyz.trycloudflare.com

# Restart backend server
```

**Note:** For Stripe webhooks, use Stripe CLI instead:
```powershell
stripe listen --forward-to https://localhost:8080/api/v1/stripe/webhook
```

---

## Deployment

### Backend (Fly.io)

**Initial Setup:**

```bash
# Install Fly CLI
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login

# Deploy (from project root)
fly deploy
```

**Configuration:**
- **Platform:** Fly.io
- **Region:** Frankfurt, Germany (fra)
- **VM:** 256MB RAM, 1 shared CPU
- **Live URL:** https://brokerageproject.fly.dev
- **Build:** Multi-stage Dockerfile (Go 1.23-alpine)

**Deployment workflow:**
1. Push to `main` branch
2. GitHub Actions runs build
3. Automatically deploys to Fly.io
4. Health check verifies deployment

**Manual deployment:**
```bash
fly deploy
```

**View logs:**
```bash
fly logs
```

**Check status:**
```bash
fly status
```

### Frontend (Cloudflare Pages)

**Initial Setup:**

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Connect GitHub repository
3. Configure build:
   - **Framework:** Vite
   - **Build command:** `cd frontend; pnpm run build`
   - **Output directory:** `frontend/dist`
4. Add environment variables:
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key`

**Configuration:**
- **Platform:** Cloudflare Pages
- **Live URL:** https://brokerageproject.pages.dev
- **Build time:** ~1-2 minutes
- **Auto-deployment:** On push to `main` branch

**Deployment workflow:**
1. Push to `main` branch
2. Cloudflare Pages automatically builds and deploys
3. Preview deployments created for pull requests

**Manual deployment:**
```bash
cd frontend
pnpm run build
# Upload dist/ folder via Cloudflare Pages dashboard
```
