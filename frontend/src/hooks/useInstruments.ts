import { useState, useEffect } from 'react';

export type InstrumentCategory = 'major' | 'defi' | 'altcoin';

export interface Instrument {
  symbol: string;
  displayName: string;
  baseCurrency: string;
  category: InstrumentCategory;
  iconUrl: string;
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
