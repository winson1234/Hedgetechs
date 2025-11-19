import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '../config/api';

interface ExchangeRateResponse {
  rates: Record<string, number>;
  last_updated: string;
  source: 'live' | 'cache';
}

interface UseExchangeRatesOptions {
  symbols: string[];
  refetchInterval?: number;
}

export function useExchangeRates({ symbols, refetchInterval = 30000 }: UseExchangeRatesOptions) {
  return useQuery({
    queryKey: ['exchangeRates', symbols.join(',')],
    queryFn: async () => {
      const symbolsParam = symbols.join(',');
      const response = await fetch(getApiUrl(`/api/v1/exchange-rate?symbols=${symbolsParam}`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch exchange rates`);
      }

      const data: ExchangeRateResponse = await response.json();
      return {
        rates: data.rates,
        lastUpdated: data.last_updated,
        source: data.source,
      };
    },
    refetchInterval,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute after component unmounts
  });
}
