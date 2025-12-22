import { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../../../store';
import { getApiUrl } from '../../../config/api';
import { CryptoData } from '../types/dashboard';

const INITIAL_CRYPTO_DATA: CryptoData[] = [
  // Major (7)
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0, change: 0, volume24h: 0, icon: '₿', gradient: 'linear-gradient(135deg, #f7931a, #ff9500)' },
  { symbol: 'ETHUSDT', name: 'Ethereum', price: 0, change: 0, volume24h: 0, icon: 'Ξ', gradient: 'linear-gradient(135deg, #627eea, #8a9cff)' },
  { symbol: 'BNBUSDT', name: 'Binance Coin', price: 0, change: 0, volume24h: 0, icon: 'B', gradient: 'linear-gradient(135deg, #f3ba2f, #ffd700)' },
  { symbol: 'SOLUSDT', name: 'Solana', price: 0, change: 0, volume24h: 0, icon: '◎', gradient: 'linear-gradient(135deg, #9945ff, #14f195)' },
  { symbol: 'XRPUSDT', name: 'Ripple', price: 0, change: 0, volume24h: 0, icon: '✕', gradient: 'linear-gradient(135deg, #23292f, #3d4853)' },
  { symbol: 'ADAUSDT', name: 'Cardano', price: 0, change: 0, volume24h: 0, icon: '₳', gradient: 'linear-gradient(135deg, #0033ad, #3468d6)' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', price: 0, change: 0, volume24h: 0, icon: '▲', gradient: 'linear-gradient(135deg, #e84142, #ff6b6b)' },

  // DeFi/Layer2 (8)
  { symbol: 'MATICUSDT', name: 'Polygon', price: 0, change: 0, volume24h: 0, icon: '⬡', gradient: 'linear-gradient(135deg, #8247e5, #a77bf3)' },
  { symbol: 'LINKUSDT', name: 'Chainlink', price: 0, change: 0, volume24h: 0, icon: '⬡', gradient: 'linear-gradient(135deg, #2a5ada, #5c8bf5)' },
  { symbol: 'UNIUSDT', name: 'Uniswap', price: 0, change: 0, volume24h: 0, icon: '🦄', gradient: 'linear-gradient(135deg, #ff007a, #ff6bae)' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', price: 0, change: 0, volume24h: 0, icon: '⚛', gradient: 'linear-gradient(135deg, #2e3148, #5064fb)' },
  { symbol: 'DOTUSDT', name: 'Polkadot', price: 0, change: 0, volume24h: 0, icon: '●', gradient: 'linear-gradient(135deg, #e6007a, #ff4d9e)' },
  { symbol: 'ARBUSDT', name: 'Arbitrum', price: 0, change: 0, volume24h: 0, icon: '◆', gradient: 'linear-gradient(135deg, #2d374b, #4a90e2)' },
  { symbol: 'OPUSDT', name: 'Optimism', price: 0, change: 0, volume24h: 0, icon: '○', gradient: 'linear-gradient(135deg, #ff0420, #ff6b8a)' },
  { symbol: 'APTUSDT', name: 'Aptos', price: 0, change: 0, volume24h: 0, icon: 'A', gradient: 'linear-gradient(135deg, #00d4aa, #40e5cc)' },

  // Altcoin (9)
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0, change: 0, volume24h: 0, icon: 'Ð', gradient: 'linear-gradient(135deg, #c2a633, #f0d068)' },
  { symbol: 'LTCUSDT', name: 'Litecoin', price: 0, change: 0, volume24h: 0, icon: 'Ł', gradient: 'linear-gradient(135deg, #345d9d, #5c8bd6)' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', price: 0, change: 0, volume24h: 0, icon: '🐕', gradient: 'linear-gradient(135deg, #ffa409, #ffcd5d)' },
  { symbol: 'NEARUSDT', name: 'Near Protocol', price: 0, change: 0, volume24h: 0, icon: 'N', gradient: 'linear-gradient(135deg, #00c08b, #00f395)' },
  { symbol: 'ICPUSDT', name: 'Internet Computer', price: 0, change: 0, volume24h: 0, icon: '∞', gradient: 'linear-gradient(135deg, #29abe2, #6dd5f5)' },
  { symbol: 'FILUSDT', name: 'Filecoin', price: 0, change: 0, volume24h: 0, icon: 'F', gradient: 'linear-gradient(135deg, #0090ff, #42b4ff)' },
  { symbol: 'SUIUSDT', name: 'Sui', price: 0, change: 0, volume24h: 0, icon: 'S', gradient: 'linear-gradient(135deg, #4da2ff, #7ec8ff)' },
  { symbol: 'STXUSDT', name: 'Stacks', price: 0, change: 0, volume24h: 0, icon: '⬢', gradient: 'linear-gradient(135deg, #5546ff, #7e72ff)' },
  { symbol: 'TONUSDT', name: 'Toncoin', price: 0, change: 0, volume24h: 0, icon: '◇', gradient: 'linear-gradient(135deg, #0088cc, #229ed9)' },
];

export const useCryptoData = () => {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>(INITIAL_CRYPTO_DATA);
  const currentPrices = useAppSelector(state => state.price.currentPrices);
  const lastPricesUpdateRef = useRef(0);

  // Update crypto data when prices change in Redux store
  useEffect(() => {
    const now = Date.now();
    if (now - lastPricesUpdateRef.current < 500) return;
    lastPricesUpdateRef.current = now;

    setCryptoData(prevData =>
      prevData.map(crypto => {
        const priceData = currentPrices[crypto.symbol];
        if (priceData !== undefined) {
          const price = typeof priceData === 'number' ? priceData : priceData.price;
          if (crypto.price !== price) {
            return { ...crypto, price };
          }
        }
        return crypto;
      })
    );
  }, [currentPrices]);

  // Fetch initial 24h ticker data
  useEffect(() => {
    const fetchInitialData = async (retries = 3): Promise<void> => {
      try {
        const symbols = cryptoData.map(c => c.symbol).join(',');
        const response = await fetch(getApiUrl(`/api/v1/ticker?symbols=${symbols}`));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch ticker data`);
        }

        const tickerData = await response.json() as Array<{
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          volume: string;
        }>;

        setCryptoData(prevData =>
          prevData.map(crypto => {
            const ticker = tickerData.find((t) => t.symbol === crypto.symbol);
            if (ticker) {
              return {
                ...crypto,
                price: parseFloat(ticker.lastPrice),
                change: parseFloat(ticker.priceChangePercent),
                volume24h: parseFloat(ticker.volume),
              };
            }
            return crypto;
          })
        );
      } catch (err) {
        console.error(`Error fetching initial ticker data (${4 - retries}/3):`, err);

        if (retries > 1) {
          const delay = (4 - retries) * 2000;
          console.log(`Retrying in ${delay / 1000}s...`);
          setTimeout(() => fetchInitialData(retries - 1), delay);
        } else {
          console.error('All retries failed. Prices may not be displayed correctly.');
        }
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { cryptoData };
};