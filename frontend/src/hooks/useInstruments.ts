import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export type InstrumentCategory = 'major' | 'defi' | 'altcoin' | 'forex' | 'commodity';

export interface SpotConfiguration {
  symbol: string;
  base_precision: number;
  quote_precision: number;
  tick_size: number;
  step_size: number;
  min_quantity: number;
  max_quantity: number;
  min_notional: number;
  max_notional: number;
  maker_fee_rate: number;
  taker_fee_rate: number;
}

export interface ForexConfiguration {
  symbol: string;
  digits: number;
  contract_size: number;
  pip_size: number;
  min_lot: number;
  max_lot: number;
  lot_step: number;
  max_leverage: number;
  margin_currency: string;
  stop_level: number;
  freeze_level: number;
  swap_enable: boolean;
  swap_long: number;
  swap_short: number;
  swap_triple_day: string;
}

export interface Instrument {
  symbol: string;
  instrument_type: 'crypto' | 'forex' | 'commodity';
  base_currency: string;
  quote_currency: string;
  is_tradable: boolean;
  created_at: string;
  updated_at: string;

  // Nested configurations (populated by backend)
  spot_config?: SpotConfiguration;
  forex_config?: ForexConfiguration;

  // Legacy fields for backward compatibility
  category?: string | null; // Derived from instrument_type
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

        const response = await apiFetch('api/v1/instruments');

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
