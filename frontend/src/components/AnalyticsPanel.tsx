import React, { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';

// Forex rate data type
type ForexRate = {
  from: string;
  to: string;
  rate: number;
  lastUpdated?: string;
};

const AnalyticsPanel: React.FC = () => {
  // Access stores
  const isOpen = useUIStore(state => state.showAnalyticsPanel);
  const setShowAnalyticsPanel = useUIStore(state => state.setShowAnalyticsPanel);

  const onClose = () => {
    setShowAnalyticsPanel(false);
  };

  const [loading, setLoading] = useState(false);
  const [forexRates, setForexRates] = useState<ForexRate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchForexRates = useCallback(async () => {
    // Forex pairs to track
    const forexPairs = [
      { from: 'EUR', to: 'USD', label: 'EUR/USD' },
      { from: 'JPY', to: 'USD', label: 'JPY/USD' },
      { from: 'MYR', to: 'USD', label: 'MYR/USD' },
    ];
    setLoading(true);
    setError(null);
    try {
      const rates: ForexRate[] = [];

      // Fetch all forex rates in parallel
      await Promise.all(
        forexPairs.map(async (pair) => {
          try {
            const endpoint = `/api/v1/analytics?type=fx_rate&from=${pair.from}&to=${pair.to}`;
            const response = await fetch(endpoint);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data?.rate) {
              rates.push({
                from: pair.from,
                to: pair.to,
                rate: data.data.rate,
                lastUpdated: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error(`Error fetching ${pair.from}/${pair.to}:`, error);
          }
        })
      );

      setForexRates(rates);
    } catch (error) {
      console.error('Error fetching forex rates:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch forex rates');
    }
    setLoading(false);
  }, []);

  // Fetch data when panel opens and refresh every 30 seconds
  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchForexRates();

      // Refresh every 30 seconds
      const interval = setInterval(() => {
        fetchForexRates();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isOpen, fetchForexRates]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Analytics
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Forex Rates</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-[calc(100vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && forexRates.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Real-time Exchange Rates
                </h3>
                <button
                  onClick={fetchForexRates}
                  disabled={loading}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-50"
                  title="Refresh rates"
                >
                  <svg className={`w-4 h-4 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-600 dark:text-blue-400">
                Powered by Frankfurter API (European Central Bank)
              </div>

              {/* Forex Rates Cards */}
              {forexRates.length > 0 ? (
                <div className="space-y-3">
                  {forexRates.map((rate) => (
                    <div
                      key={`${rate.from}${rate.to}`}
                      className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {rate.from}/{rate.to}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {rate.lastUpdated ? new Date(rate.lastUpdated).toLocaleTimeString() : ''}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Exchange Rate</span>
                          <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {rate.rate.toFixed(6)}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">1 {rate.from} =</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {rate.rate.toFixed(4)} {rate.to}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-slate-600 dark:text-slate-400">1 {rate.to} =</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {(1 / rate.rate).toFixed(4)} {rate.from}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !loading && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No forex data available
                  </div>
                )
              )}

              {/* Info Box */}
              <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-1">About Forex Rates</p>
                <p>
                  Exchange rates are automatically updated every 30 seconds. These rates are used for portfolio calculations and multi-currency conversions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnalyticsPanel;
