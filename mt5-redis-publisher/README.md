# MT5 to Redis Publisher

Real-time forex price publisher that streams MetaTrader5 tick data to Redis for consumption by the Go brokerage backend.

## Overview

This standalone Python service connects to your MT5 Terminal and publishes real-time forex prices to Redis using two mechanisms:

1. **Pub/Sub** - Real-time price updates broadcast to `fx_price_updates` channel
2. **Hash Storage** - Latest prices stored in `fx_latest_prices` hash for state persistence

## Architecture

```
MT5 Terminal (Local) → Python Publisher (This Script) → Redis (Network) → Go Backend
```

## Supported Symbols

The script publishes 7 forex pairs:

| MT5 Symbol | Normalized | Description |
|------------|------------|-------------|
| `CAD/JPY` | `CADJPY` | Canadian Dollar / Japanese Yen |
| `AUD/NZD` | `AUDNZD` | Australian Dollar / New Zealand Dollar |
| `EUR/GBP` | `EURGBP` | Euro / British Pound |
| `EUR/USD` | `EURUSD` | Euro / US Dollar |
| `USD/JPY` | `USDJPY` | US Dollar / Japanese Yen |
| `GBP/USD` | `GBPUSD` | British Pound / US Dollar |
| `AUD/USD` | `AUDUSD` | Australian Dollar / US Dollar |

**Symbol Normalization**: MT5 broker symbols with slashes (e.g., `EUR/USD`) are normalized to clean format (e.g., `EURUSD`) before publishing.

## Prerequisites

### Windows Machine Requirements

- **MetaTrader5 Terminal** installed and running
- **Active MT5 account** with forex symbols enabled in Market Watch
- **Python 3.8+** installed
- **Network access** to Redis server (Docker host)

### Redis Server

- Redis 7.x running (typically in Docker on your main server)
- Port 6379 accessible from MT5 machine

## Installation

### 1. Install Python Dependencies

```bash
cd mt5-redis-publisher
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `env.example` to `.env` and edit:

```bash
cp env.example .env
```

Edit `.env`:

```env
REDIS_HOST=192.168.1.100  # IP of machine running Docker/Redis
REDIS_PORT=6379
REDIS_DB=0
```

### 3. Verify MT5 Terminal

1. Open MetaTrader5 Terminal
2. Ensure you're logged into your account
3. Open **Market Watch** (Ctrl+M)
4. Verify all required symbols are visible:
   - Right-click → "Show All" if symbols are missing
   - Look for: CAD/JPY, AUD/NZD, EUR/GBP, EUR/USD, USD/JPY, GBP/USD, AUD/USD

**Note**: Different brokers may use different symbol names (e.g., `EURUSD.raw`, `EURUSDm`). If your broker uses non-standard names, edit the `MT5_SYMBOLS` dictionary in `publisher.py`.

## Usage

### Run the Publisher

```bash
python publisher.py
```

### Expected Output

```
2025-01-13 10:30:00 - INFO - Initializing connections...
2025-01-13 10:30:00 - INFO - Connected to MT5 Terminal: Your Broker Name
2025-01-13 10:30:00 - INFO - Terminal path: C:\Program Files\MetaTrader 5\terminal64.exe
2025-01-13 10:30:00 - INFO - Available symbols: AUD/NZD, AUD/USD, CAD/JPY, EUR/GBP, EUR/USD, GBP/USD, USD/JPY
2025-01-13 10:30:00 - INFO - Connected to Redis at 192.168.1.100:6379
2025-01-13 10:30:00 - INFO - All connections established successfully
2025-01-13 10:30:00 - INFO - Publishing to Redis channel: fx_price_updates
2025-01-13 10:30:00 - INFO - Storing latest prices in Redis hash: fx_latest_prices
2025-01-13 10:30:00 - INFO - Press Ctrl+C to stop
2025-01-13 10:30:00 - INFO - Starting MT5 Redis Publisher...
```

### Stop the Publisher

Press `Ctrl+C` to gracefully shutdown:

```
^C
2025-01-13 10:35:00 - INFO - Received shutdown signal
2025-01-13 10:35:00 - INFO - Stopping MT5 Redis Publisher...
2025-01-13 10:35:00 - INFO - Redis connection closed
2025-01-13 10:35:00 - INFO - MT5 connection closed
```

## Features

### Automatic Reconnection

The publisher automatically handles disconnections:

- **MT5 Terminal crash/restart** - Detects loss and reconnects
- **Redis server restart** - Exponential backoff reconnection (1s → 2s → 4s → ... → 60s max)
- **Network interruptions** - Continuous retry until connection restored

### Data Publishing Strategy

Each tick update triggers two Redis operations:

```python
# 1. Real-time broadcast (Pub/Sub)
PUBLISH fx_price_updates '{"symbol":"EURUSD","price":1.0850,"timestamp":1705143000000}'

# 2. State storage (Hash)
HSET fx_latest_prices EURUSD "1.0850"
```

This dual approach ensures:
- **Real-time updates** via Pub/Sub for active listeners
- **State persistence** via Hash for backend startup/recovery

### Logging

- **INFO level** - Connection events, startup/shutdown
- **DEBUG level** - Every price update (enable by editing `logging.basicConfig`)
- **ERROR level** - Connection failures, exceptions

## Troubleshooting

### MT5 Connection Failed

**Error**: `MT5 initialization failed: (x, 'reason')`

**Solutions**:
1. Ensure MT5 Terminal is running and logged in
2. Check if MT5 is not in "Safe Mode"
3. Verify Python script has permission to access MT5 (run as Administrator if needed)

### Symbol Not Found

**Error**: `Symbol EUR/USD not found in terminal`

**Solutions**:
1. Open MT5 Market Watch → Right-click → "Show All"
2. Search for the symbol manually and check exact name
3. Update `MT5_SYMBOLS` dictionary in `publisher.py` if broker uses different names

### Redis Connection Failed

**Error**: `Redis connection failed: [Errno 10061] No connection could be made`

**Solutions**:
1. Verify Redis container is running: `docker ps`
2. Check Redis port is exposed in `docker-compose.yml`
3. Verify firewall allows connection from MT5 machine
4. Test connection: `telnet <redis_host> 6379`

## Deployment Recommendations

### Production Setup

1. **Run as Windows Service**: Use `NSSM` or Task Scheduler to run publisher on system startup
2. **Monitoring**: Add health checks, alert on extended disconnections
3. **Logging**: Rotate logs, send critical errors to monitoring system
4. **Redundancy**: Consider running multiple MT5 terminals/publishers for failover

### Performance

- **Tick Rate**: Script polls MT5 every 100ms (adjustable via `time.sleep(0.1)`)
- **CPU Usage**: Minimal (~1-2% on modern systems)
- **Network**: ~1KB/s per symbol (very lightweight)

## Integration with Go Backend

The Go backend's Redis provider will:

1. **On startup**: `HGETALL fx_latest_prices` to seed price cache
2. **Runtime**: `SUBSCRIBE fx_price_updates` for real-time updates

This ensures the backend always has prices available, even if started before the publisher.

## Development

### Adding New Symbols

Edit `publisher.py`:

```python
MT5_SYMBOLS = {
    'EUR/USD': 'EURUSD',
    'USD/JPY': 'USDJPY',
    'NEW/SYMBOL': 'NEWSYMBOL',  # Add here
}
```

### Adjusting Tick Rate

Modify sleep duration in `run()` method:

```python
time.sleep(0.1)  # 100ms (10 ticks/sec) - default
time.sleep(0.05) # 50ms (20 ticks/sec) - faster
time.sleep(0.5)  # 500ms (2 ticks/sec) - slower
```

## License

Part of the brokerageProject - see main repository for license details.
