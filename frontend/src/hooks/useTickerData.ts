import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '../config/api';

export interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume?: string;
}

interface UseTickerDataOptions {
  symbols: string[];
  enabled?: boolean;
}

export function useTickerData({ symbols, enabled = true }: UseTickerDataOptions) {
  return useQuery({
    queryKey: ['tickerData', symbols.join(',')],
    queryFn: async () => {
      const symbolsParam = symbols.join(',');
      const response = await fetch(getApiUrl(`/api/v1/ticker?symbols=${symbolsParam}`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch ticker data`);
      }

      const data: TickerData[] = await response.json();
      return data;
    },
    enabled: enabled && symbols.length > 0,
    staleTime: 60000, // Consider data stale after 1 minute
    gcTime: 120000, // Keep in cache for 2 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
