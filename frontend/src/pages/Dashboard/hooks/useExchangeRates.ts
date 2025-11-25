import { useState, useEffect } from 'react';
import { getApiUrl } from '../../../config/api';

// Define PAYOUT_CRYPTOS locally if not imported from constants
const PAYOUT_CRYPTOS = [
  { symbol: 'BTC', label: 'Bitcoin', icon: '₿' },
  { symbol: 'ETH', label: 'Ethereum', icon: 'Ξ' },
  { symbol: 'SOL', label: 'Solana', icon: '◎' },
  { symbol: 'ADA', label: 'Cardano', icon: '₳' },
  { symbol: 'XRP', label: 'XRP', icon: '✕' },
  { symbol: 'LTC', label: 'Litecoin', icon: 'Ł' },
  { symbol: 'DOGE', label: 'Dogecoin', icon: 'Ð' },
] as const;

export const useExchangeRates = () => {
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });
  const [rateLastUpdated, setRateLastUpdated] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<'live' | 'cache'>('live');
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        setRatesLoading(true);
        setRateError(null);

        const symbols = PAYOUT_CRYPTOS.map(c => c.symbol).join(',');
        const response = await fetch(getApiUrl(`/api/v1/exchange-rate?symbols=${symbols}`));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch exchange rates`);
        }

        const rates = await response.json() as Record<string, number>;
        
        const timestamp = response.headers.get('X-Rates-Timestamp');
        const source = response.headers.get('X-Rate-Source') as 'live' | 'cache' | null;

        setExchangeRates(rates);
        if (timestamp) {
          setRateLastUpdated(timestamp);
        }
        if (source) {
          setRateSource(source);
        }
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
        setRateError(err instanceof Error ? err.message : 'Failed to fetch rates');
      } finally {
        setRatesLoading(false);
      }
    };

    fetchExchangeRates();
    
    const interval = setInterval(fetchExchangeRates, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    exchangeRates,
    rateLastUpdated,
    rateSource,
    ratesLoading,
    rateError
  };
};