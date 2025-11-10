# Setup Guide

## Environment Variables

### Development (.env file)

Create `.env` file in project root:

```bash
cp env.example .env
```

```env
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
