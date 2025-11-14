"""
MT5 to Redis Publisher
Connects to MetaTrader5 terminal and publishes real-time forex prices to Redis.
"""

import MetaTrader5 as mt5
import redis
import json
import time
import logging
from datetime import datetime
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
REDIS_CHANNEL = 'fx_price_updates'
REDIS_HASH_KEY = 'fx_latest_prices'

# MT5 symbols → normalized format mapping
# Note: MetaQuotes demo broker uses format without slashes (EURUSD not EUR/USD)
# Using symbols available in MetaQuotes demo Market Watch
MT5_SYMBOLS = {
    'EURUSD': 'EURUSD',
    'GBPUSD': 'GBPUSD',
    'USDJPY': 'USDJPY',
    'AUDUSD': 'AUDUSD',
    'NZDUSD': 'NZDUSD',
    'USDCHF': 'USDCHF',
    'CADJPY': 'CADJPY',
    'AUDNZD': 'AUDNZD',
    'EURGBP': 'EURGBP'
}

# Reconnection settings
MAX_RECONNECT_DELAY = 60  # seconds
INITIAL_RECONNECT_DELAY = 1  # seconds


class MT5RedisPublisher:
    """Publisher that streams MT5 forex prices to Redis"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.running = False
        self.reconnect_delay = INITIAL_RECONNECT_DELAY

    def connect_mt5(self) -> bool:
        """Initialize connection to MT5 terminal"""
        try:
            # Try to initialize with explicit path (helps with some MT5 installations)
            if not mt5.initialize():
                error = mt5.last_error()
                logger.error(f"MT5 initialization failed: {error}")
                return False

            # Get terminal info
            terminal_info = mt5.terminal_info()
            if terminal_info is None:
                logger.error("Failed to get terminal info")
                return False

            logger.info(f"Connected to MT5 Terminal: {terminal_info.company}")
            logger.info(f"Terminal path: {terminal_info.path}")
            logger.info(f"MT5 build: {terminal_info.build}")

            # Verify symbols are available
            available_symbols = set()
            for mt5_symbol in MT5_SYMBOLS.keys():
                symbol_info = mt5.symbol_info(mt5_symbol)
                if symbol_info is None:
                    logger.warning(f"Symbol {mt5_symbol} not found in terminal")
                else:
                    available_symbols.add(mt5_symbol)
                    # Enable symbol in Market Watch if not already enabled
                    if not symbol_info.visible:
                        if mt5.symbol_select(mt5_symbol, True):
                            logger.info(f"Enabled {mt5_symbol} in Market Watch")
                        else:
                            logger.warning(f"Failed to enable {mt5_symbol}")

            if not available_symbols:
                logger.error("No valid symbols found in MT5 terminal")
                return False

            logger.info(f"Available symbols: {', '.join(sorted(available_symbols))}")
            return True

        except Exception as e:
            logger.error(f"Error connecting to MT5: {e}")
            return False

    def connect_redis(self) -> bool:
        """Initialize connection to Redis"""
        try:
            self.redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )

            # Test connection
            self.redis_client.ping()
            logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
            return True

        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis_client = None
            return False
        except Exception as e:
            logger.error(f"Error connecting to Redis: {e}")
            self.redis_client = None
            return False

    def normalize_symbol(self, mt5_symbol: str) -> Optional[str]:
        """Convert MT5 symbol format to normalized format"""
        return MT5_SYMBOLS.get(mt5_symbol)

    def publish_price(self, symbol: str, bid: float, ask: float) -> bool:
        """Publish price update to Redis (Pub/Sub + Hash)"""
        if not self.redis_client:
            return False

        try:
            # Create JSON payload for Pub/Sub
            pubsub_payload = json.dumps({
                'symbol': symbol,
                'bid': bid,
                'ask': ask,
                'timestamp': int(time.time() * 1000)
            })

            # Create JSON payload for Hash (just the prices)
            hash_payload = json.dumps({'bid': bid, 'ask': ask})

            # 1. Publish to Pub/Sub channel for real-time updates
            self.redis_client.publish(REDIS_CHANNEL, pubsub_payload)

            # 2. Store in Hash for state persistence (latest price)
            self.redis_client.hset(REDIS_HASH_KEY, symbol, hash_payload)

            return True

        except redis.ConnectionError:
            logger.error("Redis connection lost while publishing")
            self.redis_client = None
            return False
        except Exception as e:
            logger.error(f"Error publishing price for {symbol}: {e}")
            return False

    def process_tick(self, mt5_symbol: str) -> None:
        """Process a single tick for a symbol"""
        try:
            # Get latest tick
            tick = mt5.symbol_info_tick(mt5_symbol)
            if tick is None:
                return

            # Normalize symbol name
            normalized_symbol = self.normalize_symbol(mt5_symbol)
            if not normalized_symbol:
                return

            # Get both bid and ask prices
            bid_price = tick.bid
            ask_price = tick.ask

            # Publish to Redis
            if self.publish_price(normalized_symbol, bid_price, ask_price):
                logger.debug(f"{normalized_symbol}: Bid={bid_price:.5f}, Ask={ask_price:.5f}")

        except Exception as e:
            logger.error(f"Error processing tick for {mt5_symbol}: {e}")

    def run(self) -> None:
        """Main loop - continuously fetch and publish prices"""
        logger.info("Starting MT5 Redis Publisher...")
        self.running = True

        while self.running:
            # Ensure connections are established
            if not mt5.terminal_info():
                logger.warning("MT5 connection lost, reconnecting...")
                if not self.connect_mt5():
                    logger.error(f"MT5 reconnection failed, retrying in {self.reconnect_delay}s")
                    time.sleep(self.reconnect_delay)
                    self.reconnect_delay = min(self.reconnect_delay * 2, MAX_RECONNECT_DELAY)
                    continue
                else:
                    self.reconnect_delay = INITIAL_RECONNECT_DELAY

            if not self.redis_client:
                logger.warning("Redis connection lost, reconnecting...")
                if not self.connect_redis():
                    logger.error(f"Redis reconnection failed, retrying in {self.reconnect_delay}s")
                    time.sleep(self.reconnect_delay)
                    self.reconnect_delay = min(self.reconnect_delay * 2, MAX_RECONNECT_DELAY)
                    continue
                else:
                    self.reconnect_delay = INITIAL_RECONNECT_DELAY

            # Process ticks for all symbols
            for mt5_symbol in MT5_SYMBOLS.keys():
                if not self.running:
                    break
                self.process_tick(mt5_symbol)

            # Small delay to avoid hammering the API (adjust based on needs)
            # MT5 tick updates are typically 100-500ms anyway
            time.sleep(0.1)

    def stop(self) -> None:
        """Graceful shutdown"""
        logger.info("Stopping MT5 Redis Publisher...")
        self.running = False

        if self.redis_client:
            try:
                self.redis_client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")

        mt5.shutdown()
        logger.info("MT5 connection closed")


def main():
    """Entry point"""
    publisher = MT5RedisPublisher()

    # Initial connections
    logger.info("Initializing connections...")

    if not publisher.connect_mt5():
        logger.error("Failed to connect to MT5. Ensure MT5 terminal is running.")
        return

    if not publisher.connect_redis():
        logger.error(f"Failed to connect to Redis at {REDIS_HOST}:{REDIS_PORT}")
        logger.error("Ensure Redis is running and accessible from this machine.")
        mt5.shutdown()
        return

    logger.info("All connections established successfully")
    logger.info(f"Publishing to Redis channel: {REDIS_CHANNEL}")
    logger.info(f"Storing latest prices in Redis hash: {REDIS_HASH_KEY}")
    logger.info("Press Ctrl+C to stop")

    # Run main loop
    try:
        publisher.run()
    except KeyboardInterrupt:
        logger.info("\nReceived shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
    finally:
        publisher.stop()


if __name__ == '__main__':
    main()
