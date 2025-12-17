# MT5 Real-Time Forex Data - Setup Summary

## 📋 Overview

Your MT5 integration is now ready to deploy! This will stream real-time forex prices from your MetaTrader 5 terminal to your Hedgetechs trading portal.

## 🏗️ Architecture

```
Windows Laptop (MT5) 
    ↓ (windows-api-server.py)
  ngrok Tunnel (HTTPS)
    ↓ (Internet)
Linux Server (Contabo)
    ↓ (linux-bridge-service.py)
  Redis (Pub/Sub)
    ↓
  Go Backend (WebSocket)
    ↓
  React Frontend
```

## 📁 Files Created/Modified

### New MT5 Publisher Files:
- `mt5-publisher/README.md` - Complete documentation
- `mt5-publisher/QUICK_START.md` - 10-minute setup guide
- `mt5-publisher/INTEGRATION_CHECKLIST.md` - Detailed checklist
- `mt5-publisher/setup-windows.md` - Detailed Windows guide
- `mt5-publisher/setup-linux.md` - Detailed Linux guide
- `mt5-publisher/docker-compose.bridge.yml` - Bridge service Docker Compose
- `mt5-publisher/env.production.example` - Linux environment example
- `mt5-publisher/env.windows.example` - Windows environment example
- `mt5-publisher/start-windows.bat` - Windows startup script
- `mt5-publisher/check-health.sh` - Health monitoring script

### Modified Files:
- `deployment/docker-compose.prod.yml` - Added mt5-bridge service

### Existing Files (Already in mt5-publisher):
- `windows-api-server.py` - Fetches prices from MT5, exposes HTTP API
- `linux-bridge-service.py` - Polls Windows API, publishes to Redis
- `Dockerfile.bridge` - Docker image for bridge service
- `requirements.txt` - Python dependencies for Windows
- `requirements-bridge.txt` - Python dependencies for Linux

## 🚀 Quick Setup (15 minutes)

### Phase 1: Windows Laptop (5 min)

```bash
cd mt5-publisher
pip install -r requirements.txt

# Create .env with your MT5 credentials
notepad .env

# Start both services (creates 2 terminal windows)
start-windows.bat
```

Copy the ngrok URL (example: `https://abc123.ngrok-free.app`)

### Phase 2: Linux Server (5 min)

```bash
# Upload mt5-publisher folder (from your local machine)
scp -r mt5-publisher root@your-contabo-ip:/root/Hedgetechs/

# SSH to server
ssh root@your-contabo-ip
cd /root/Hedgetechs

# Add to main .env file
nano .env
```

Add these lines to `.env`:
```env
# MT5 Bridge
WINDOWS_API_URL=https://your-ngrok-url.ngrok-free.app
MT5_POLL_INTERVAL_MS=100
```

Start the service:
```bash
cd deployment
docker-compose -f docker-compose.prod.yml up -d mt5-bridge
```

### Phase 3: Verify (5 min)

```bash
# Check bridge logs
docker logs -f mt5-bridge-service

# Check Redis data
docker exec -it brokerage-redis-prod redis-cli -a "YOUR_PASSWORD"
HGETALL fx_latest_prices

# Run health check
bash /root/Hedgetechs/mt5-publisher/check-health.sh
```

Open your trading portal → Forex prices should update in real-time!

## 🔧 Configuration

### Windows `.env`
```env
MT5_LOGIN=your_account
MT5_PASSWORD=your_password
MT5_SERVER=YourBroker-Live
API_PORT=5000
```

### Linux `.env` (add to main .env)
```env
WINDOWS_API_URL=https://your-ngrok-url.ngrok-free.app
REDIS_PASSWORD=your_existing_redis_password
MT5_POLL_INTERVAL_MS=100
```

## ✅ What's Already Working

Your backend is **already configured** to receive forex data from Redis:
- ✅ Redis client initialized (`internal/infrastructure/redis/client.go`)
- ✅ Backend subscribes to `fx_price_updates` channel (`internal/hub/hub.go`)
- ✅ WebSocket hub broadcasts to frontend (`internal/hub/hub.go`)
- ✅ Docker Compose has Redis configured (`deployment/docker-compose.prod.yml`)

**You just need to:**
1. Run Windows scripts (provides the data source)
2. Start bridge service (connects Windows → Redis)
3. That's it! Data flows automatically.

## 📊 Supported Forex Pairs

Currently configured (13 pairs):
- EURUSD, GBPUSD, USDJPY, AUDUSD
- NZDUSD, USDCHF, AUDJPY, CADJPY
- AUDNZD, EURGBP, USDCAD, EURJPY, GBPJPY

To add more, edit `MT5_SYMBOLS` in `windows-api-server.py`.

## 🔍 Monitoring

### Quick Health Check
```bash
bash /root/Hedgetechs/mt5-publisher/check-health.sh
```

### Manual Checks
```bash
# Container status
docker ps | grep mt5-bridge

# Logs
docker logs -f mt5-bridge-service

# Redis data
docker exec redis redis-cli -a "$REDIS_PASSWORD" HGETALL fx_latest_prices

# Backend logs
docker logs -f brokerage-backend-prod | grep fx_price
```

## 🚨 Troubleshooting

### No prices in frontend?

**1. Check Windows:**
```bash
# Is API responding?
curl http://localhost:5000/prices
```

**2. Check ngrok:**
```bash
# Is tunnel active?
curl https://your-ngrok-url.ngrok-free.app/health
```

**3. Check Linux bridge:**
```bash
# Is container running?
docker ps | grep mt5-bridge

# Any errors?
docker logs mt5-bridge-service --tail 50
```

**4. Check Redis:**
```bash
# Has data?
docker exec redis redis-cli -a PASSWORD HLEN fx_latest_prices
# Should return: 13
```

### Bridge can't reach Windows API?

1. ✅ Verify ngrok URL in Linux `.env` is correct
2. ✅ Check Windows firewall isn't blocking
3. ✅ Verify ngrok rate limits (free: 40 req/min)
4. ✅ Test manually: `curl https://your-ngrok-url/health`

### Bridge says Redis connection failed?

1. ✅ Check Redis password matches
2. ✅ Verify Redis container is running: `docker ps | grep redis`
3. ✅ Test connection: `docker exec redis redis-cli -a PASSWORD ping`

## 🔄 When ngrok URL Changes

ngrok free tier gives you a new URL on each restart. To update:

```bash
# 1. Get new URL from Windows ngrok terminal
# 2. Update Linux .env
nano /root/Hedgetechs/.env
# Change WINDOWS_API_URL

# 3. Restart bridge
cd /root/Hedgetechs/deployment
docker-compose -f docker-compose.prod.yml restart mt5-bridge

# 4. Verify
docker logs -f mt5-bridge-service
```

**💡 Tip:** Upgrade to ngrok paid plan ($8/month) for a reserved domain that never changes!

## 📚 Documentation Files

Choose based on your needs:

1. **QUICK_START.md** - Fast 10-minute setup (recommended to start)
2. **README.md** - Complete documentation with architecture
3. **setup-windows.md** - Detailed Windows setup with troubleshooting
4. **setup-linux.md** - Detailed Linux setup with troubleshooting
5. **INTEGRATION_CHECKLIST.md** - Step-by-step verification checklist
6. **MT5_SETUP_SUMMARY.md** - This file (overview)

## 🎯 Next Steps

1. **[ ] Follow QUICK_START.md** to set up in 15 minutes
2. **[ ] Test end-to-end** data flow
3. **[ ] Run health check** script
4. **[ ] Monitor for 1 hour** to ensure stability
5. **[ ] Document your ngrok URL** for team reference
6. **[ ] Consider ngrok upgrade** for stable URL

## 💡 Production Recommendations

1. ✅ **Windows laptop always on** - Disable sleep, use UPS
2. ✅ **Stable internet** - Wired connection preferred
3. ✅ **ngrok reserved domain** - $8/month, no URL changes
4. ✅ **Monitoring** - UptimeRobot for ngrok endpoint
5. ✅ **Auto-restart** - Already configured (`restart: always`)
6. ✅ **Backup plan** - Document Windows laptop location/access

## 🔐 Security

- ✅ `.env` files are in `.gitignore` - never commit credentials
- ✅ Consider ngrok authentication: `ngrok http 5000 --basic-auth="user:pass"`
- ✅ Monitor ngrok usage for suspicious activity
- ✅ Use strong Redis password (already in your setup)

## 📞 Support

If you encounter issues:

1. Check the relevant documentation file
2. Run health check: `bash mt5-publisher/check-health.sh`
3. Review logs: `docker logs -f mt5-bridge-service`
4. Verify each component in the chain:
   - MT5 terminal logged in?
   - Windows API running?
   - ngrok tunnel active?
   - Bridge container running?
   - Redis has data?
   - Backend subscribed?

## 🎉 Success Indicators

You'll know it's working when:

- ✅ Bridge logs show: "Published 13 symbols to Redis"
- ✅ Redis has 13 forex pairs: `HLEN fx_latest_prices` returns 13
- ✅ Backend logs show: "Subscribed to fx_price_updates"
- ✅ Frontend shows real-time price updates (prices change every 1-2 seconds)
- ✅ Browser console shows WebSocket messages with price data

---

**Ready to start?** Go to `mt5-publisher/QUICK_START.md` for the 15-minute setup guide!

**Need details?** Check `mt5-publisher/README.md` for complete documentation.

**Want to verify everything?** Use `mt5-publisher/INTEGRATION_CHECKLIST.md` for step-by-step validation.
