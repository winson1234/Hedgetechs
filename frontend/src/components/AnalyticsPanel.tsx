import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setShowAnalyticsPanel } from '../store/slices/uiSlice';
import { getApiUrl } from '../config/api';
import { CURRENCIES } from '../config/constants';

// Forex rate data type
type ForexRate = {
  from: string;
  to: string;
  rate: number;
  lastUpdated?: string;
};

type IndicatorData = {
  symbol: string;
  value: number;
  period?: number;
  signal?: number;
  histogram?: number;
};

type TabType = 'forex' | 'rsi' | 'sma' | 'ema' | 'macd';

const AnalyticsPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  // Access Redux state
  const isOpen = useAppSelector(state => state.ui.showAnalyticsPanel);
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);

  const onClose = () => {
    dispatch(setShowAnalyticsPanel(false));
  };

  const [activeTab, setActiveTab] = useState<TabType>('forex');
  const [loading, setLoading] = useState(false);
  const [forexRates, setForexRates] = useState<ForexRate[]>([]);
  const [indicatorData, setIndicatorData] = useState<IndicatorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(activeInstrument);
  const [period, setPeriod] = useState<number>(14);

  const fetchForexRates = useCallback(async () => {
    // Generate forex pairs dynamically from currencies config (all pairs with USD)
    const forexPairs = CURRENCIES
      .filter((curr: string) => curr !== 'USD')
      .map((curr: string) => ({
        from: curr,
        to: 'USD',
        label: `${curr}/USD`
      }));
    setLoading(true);
    setError(null);
    try {
      const rates: ForexRate[] = [];

      // Fetch all forex rates in parallel
      await Promise.all(
        forexPairs.map(async (pair) => {
          try {
            const endpoint = `/api/v1/analytics?type=fx_rate&from=${pair.from}&to=${pair.to}`;
            const response = await fetch(getApiUrl(endpoint));

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

  const fetchIndicator = useCallback(async (type: string, symbol: string, periodVal: number) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = `/api/v1/analytics?type=${type}&symbol=${symbol}&period=${periodVal}`;
      const response = await fetch(getApiUrl(endpoint));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.data) {
        if (type === 'macd') {
          setIndicatorData({
            symbol: data.data.symbol,
            value: data.data.macd,
            signal: data.data.signal,
            histogram: data.data.histogram,
          });
        } else {
          setIndicatorData({
            symbol: data.data.symbol,
            value: data.data[type], // rsi, sma, or ema
            period: data.data.period,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      setError(error instanceof Error ? error.message : `Failed to fetch ${type}`);
    }
    setLoading(false);
  }, []);

  // Sync selectedSymbol with activeInstrument
  useEffect(() => {
    setSelectedSymbol(activeInstrument);
  }, [activeInstrument]);

  // Fetch data when panel opens, tab changes, or symbol changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (activeTab === 'forex') {
        fetchForexRates();
        // Refresh every 30 seconds for forex
        const interval = setInterval(() => {
          fetchForexRates();
        }, 30000);
        return () => clearInterval(interval);
      } else {
        // Fetch indicator data
        fetchIndicator(activeTab, selectedSymbol, period);
      }
    }
  }, [isOpen, activeTab, selectedSymbol, period, fetchForexRates, fetchIndicator]);

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
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Analytics
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-4 gap-2 overflow-x-auto">
            {(['forex', 'rsi', 'sma', 'ema', 'macd'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab
                    ? 'border-[#00C0A2] text-[#00C0A2]'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'forex' ? 'Forex Rates' : tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-[calc(100vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && forexRates.length === 0 && !indicatorData ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C0A2]"></div>
            </div>
          ) : activeTab !== 'forex' ? (
            /* Indicator Display */
            <div className="space-y-4">
              {/* Symbol Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Symbol
                </label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00C0A2]"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                  <option value="EURUSDT">EUR/USDT</option>
                </select>
              </div>

              {/* Period Input (except for MACD) */}
              {activeTab !== 'macd' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Period
                  </label>
                  <input
                    type="number"
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value) || 14)}
                    min="1"
                    max="200"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00C0A2]"
                  />
                </div>
              )}

              {/* Indicator Card */}
              {indicatorData && (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-center">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      {activeTab.toUpperCase()}
                      {indicatorData.period && ` (${indicatorData.period})`}
                    </div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                      {indicatorData.value.toFixed(2)}
                    </div>

                    {activeTab === 'rsi' && (
                      <div className="mt-2">
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          indicatorData.value > 70 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          indicatorData.value < 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {indicatorData.value > 70 ? 'Overbought' : indicatorData.value < 30 ? 'Oversold' : 'Neutral'}
                        </div>
                      </div>
                    )}

                    {activeTab === 'macd' && indicatorData.signal !== undefined && (
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Signal:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {indicatorData.signal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Histogram:</span>
                          <span className={`font-semibold ${
                            (indicatorData.histogram ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {(indicatorData.histogram ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            (indicatorData.histogram ?? 0) > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {(indicatorData.histogram ?? 0) > 0 ? 'Bullish' : 'Bearish'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => fetchIndicator(activeTab, selectedSymbol, period)}
                disabled={loading}
                className="w-full py-2 px-4 bg-[#00C0A2] hover:bg-[#00a085] disabled:bg-slate-400 text-white rounded font-medium text-sm transition"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>

              {/* Info Box */}
              <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold mb-1">About {activeTab.toUpperCase()}</p>
                <p>
                  {activeTab === 'rsi' && 'RSI measures momentum, ranging from 0-100. Above 70 indicates overbought, below 30 indicates oversold.'}
                  {activeTab === 'sma' && 'Simple Moving Average smooths price data by calculating the average price over a specified period.'}
                  {activeTab === 'ema' && 'Exponential Moving Average gives more weight to recent prices, making it more responsive to new information.'}
                  {activeTab === 'macd' && 'MACD shows the relationship between two EMAs. Positive histogram indicates bullish momentum, negative indicates bearish.'}
                </p>
              </div>
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

              <div className="mb-3 p-2 bg-[#00C0A2]/10 dark:bg-[#00C0A2]/20 border border-[#00C0A2]/30 dark:border-[#00C0A2]/50 rounded text-xs text-[#00C0A2]">
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
