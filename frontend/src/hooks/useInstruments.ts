import { useState, useEffect } from 'react';

export type InstrumentCategory = 'major' | 'defi' | 'altcoin';

export interface Instrument {
  symbol: string;
  name?: string | null;
  base_currency?: string | null;
  quote_currency?: string | null;
  instrument_type?: string | null;
  category?: string | null; // major, defi, altcoin, forex, commodity (from database)
  is_tradeable: boolean;
  leverage_cap: number;
  spread_adjustment_bps?: number;
  min_order_size?: number | null;
  max_order_size?: number | null;
  tick_size?: number | null;
  created_at?: string;
  updated_at?: string;
  // Legacy fields for backward compatibility
  displayName?: string;
  baseCurrency?: string;
  iconUrl?: string;
}

interface InstrumentsData {
  instruments: Instrument[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch trading instruments from backend API
 * Provides list of supported instruments with metadata
 */
export function useInstruments(): InstrumentsData {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchInstruments = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/v1/instruments');

        if (!response.ok) {
          throw new Error('Failed to fetch instruments');
        }

        const data = await response.json();

        if (isMounted) {
          setInstruments(data.instruments || []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
          setLoading(false);
        }
      }
    };

    void fetchInstruments();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    instruments,
    loading,
    error,
  };
}
