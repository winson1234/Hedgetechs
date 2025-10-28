import React, { useState, useEffect, useCallback } from 'react';

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
}

// Alpha Vantage API response types (dynamic structure from API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AlphaVantageData = Record<string, any>;

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ isOpen, onClose, symbol }) => {
  const [loading, setLoading] = useState(false);
  const [quoteData, setQuoteData] = useState<AlphaVantageData | null>(null);
  const [rsiData, setRsiData] = useState<AlphaVantageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse crypto symbol from Binance format (e.g., "BTCUSDT" -> { base: "BTC", quote: "USD" })
  const parseCryptoSymbol = (symbol: string): { base: string; quote: string; isCrypto: boolean; isForex: boolean } => {
    // List of fiat currencies that are not cryptocurrencies
    const fiatCurrencies = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'];
    
    // Check if it's a crypto pair (ends with USDT or USD)
    if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      // Check if base is a fiat currency
      if (fiatCurrencies.includes(base)) {
        return {
          base: base,
          quote: 'USD',
          isCrypto: false,
          isForex: true // Forex pair like EUR/USD
        };
      }
      return {
        base: base,
        quote: 'USD',
        isCrypto: true,
        isForex: false // Crypto pair like BTC/USD
      };
    } else if (symbol.endsWith('USD') && symbol !== 'USD') {
      const base = symbol.replace('USD', '');
      // Check if base is a fiat currency
      if (fiatCurrencies.includes(base)) {
        return {
          base: base,
          quote: 'USD',
          isCrypto: false,
          isForex: true // Forex pair like EUR/USD
        };
      }
      return {
        base: base,
        quote: 'USD',
        isCrypto: true,
        isForex: false // Crypto pair like BTC/USD
      };
    }
    
    // Not a crypto pair, return as stock symbol
    return {
      base: symbol,
      quote: 'USD',
      isCrypto: false,
      isForex: false
    };
  };

  // Get display text for the symbol
  const getSymbolDisplayText = (originalSymbol: string): string => {
    const parsed = parseCryptoSymbol(originalSymbol);
    if (parsed.isCrypto) {
      return `${originalSymbol} (${parsed.base}/${parsed.quote})`;
    }
    return originalSymbol;
  };

  const fetchQuoteData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { base, quote, isCrypto, isForex } = parseCryptoSymbol(symbol);
      console.log(`Fetching quote for ${symbol} (${base}/${quote}, crypto: ${isCrypto}, forex: ${isForex})`);
      
      // Use crypto_quote (CURRENCY_EXCHANGE_RATE) for all currency pairs (crypto + forex)
      // Use regular quote (GLOBAL_QUOTE) only for stocks
      const isCurrencyPair = isCrypto || isForex;
      
      const endpoint = isCurrencyPair
        ? `http://localhost:8080/api/v1/alphavantage?type=crypto_quote&symbol=${base}&market=${quote}`
        : `http://localhost:8080/api/v1/alphavantage?type=quote&symbol=${base}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Quote fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Quote data received:', data);
      
      if (data.error || data['Error Message'] || data['Note']) {
        throw new Error(data.error || data['Error Message'] || data['Note']);
      }
      
      setQuoteData(data);
    } catch (error) {
      console.error('Error fetching quote data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch quote data');
    }
    setLoading(false);
  }, [symbol]);

  const fetchRSIData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { base, quote, isCrypto, isForex } = parseCryptoSymbol(symbol);
      console.log(`Fetching daily data for ${symbol} (${base}/${quote}, crypto: ${isCrypto}, forex: ${isForex})`);
      
      // Determine the endpoint based on the type
      let endpoint;
      if (isCrypto) {
        // Use crypto_daily for cryptocurrencies (BTC, ETH, SOL)
        endpoint = `http://localhost:8080/api/v1/alphavantage?type=crypto_daily&symbol=${base}&market=${quote}`;
      } else if (isForex) {
        // Use fx_daily for forex pairs (EUR/USD, GBP/USD, etc.)
        endpoint = `http://localhost:8080/api/v1/alphavantage?type=fx_daily&symbol=${base}&market=${quote}`;
      } else {
        // Use technical indicator (RSI) for stocks
        endpoint = `http://localhost:8080/api/v1/alphavantage?type=indicator&symbol=${base}&function=RSI&interval=daily&time_period=14&series_type=close`;
      }
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Daily data fetch failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Daily data received:', data);
      
      if (data.error || data['Error Message'] || data['Note']) {
        throw new Error(data.error || data['Error Message'] || data['Note']);
      }
      
      setRsiData(data);
    } catch (error) {
      console.error('Error fetching RSI data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch RSI data');
    }
    setLoading(false);
  }, [symbol]);

  // Fetch data when panel opens
  useEffect(() => {
    if (isOpen && symbol) {
      setError(null);
      fetchQuoteData();
      fetchRSIData();
    }
  }, [isOpen, symbol, fetchQuoteData, fetchRSIData]);

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
            <p className="text-sm text-slate-500 dark:text-slate-400">{symbol}</p>
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
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Technical Indicators
              </h3>
              
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-600 dark:text-blue-400">
                {getSymbolDisplayText(symbol)}
              </div>
              
              {/* Quote Data - Handle both crypto and stock formats */}
              {quoteData && (quoteData['Realtime Currency Exchange Rate'] || (quoteData['Global Quote'] && Object.keys(quoteData['Global Quote']).length > 0)) ? (
                <div className="space-y-2">
                  {quoteData['Realtime Currency Exchange Rate'] ? (
                    // Crypto format
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Price (Alpha Vantage)</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          ${parseFloat(quoteData['Realtime Currency Exchange Rate']['5. Exchange Rate'] || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">From</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {quoteData['Realtime Currency Exchange Rate']['2. From_Currency Name']}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Last Update (UTC)</span>
                        <span className="font-medium text-slate-900 dark:text-white text-xs">
                          {quoteData['Realtime Currency Exchange Rate']['6. Last Refreshed']}
                        </span>
                      </div>
                    </>
                  ) : (
                    // Stock format
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Price (Alpha Vantage)</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          ${parseFloat(quoteData['Global Quote']['05. price'] || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Change</span>
                        <span
                          className={`font-medium ${
                            parseFloat(quoteData['Global Quote']['09. change'] || 0) >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {quoteData['Global Quote']['09. change']} ({quoteData['Global Quote']['10. change percent']})
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Volume</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {parseInt(quoteData['Global Quote']['06. volume'] || 0).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                !loading && !error && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No quote data available
                  </div>
                )
              )}

              {/* Daily Price History */}
              {rsiData && ((rsiData['Technical Analysis: RSI'] && Object.keys(rsiData['Technical Analysis: RSI']).length > 0) || 
                          (rsiData['Time Series (Digital Currency Daily)'] && Object.keys(rsiData['Time Series (Digital Currency Daily)']).length > 0) ||
                          (rsiData['Time Series FX (Daily)'] && Object.keys(rsiData['Time Series FX (Daily)']).length > 0)) ? (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Daily Price History
                  </h4>
                  <div className="space-y-1">
                    {rsiData['Time Series (Digital Currency Daily)'] ? (
                      // Crypto daily format
                      Object.entries(rsiData['Time Series (Digital Currency Daily)'])
                        .slice(0, 5)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map(([date, values]: [string, any]) => (
                          <div key={date} className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">{date}</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              ${parseFloat(values['4a. close (USD)'] || values['4. close'] || 0).toFixed(2)}
                            </span>
                          </div>
                        ))
                    ) : rsiData['Time Series FX (Daily)'] ? (
                      // Forex daily format
                      Object.entries(rsiData['Time Series FX (Daily)'])
                        .slice(0, 5)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map(([date, values]: [string, any]) => (
                          <div key={date} className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">{date}</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              ${parseFloat(values['4. close'] || 0).toFixed(4)}
                            </span>
                          </div>
                        ))
                    ) : (
                      // Stock daily format (if using stock symbols)
                      Object.entries(rsiData['Technical Analysis: RSI'])
                        .slice(0, 5)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map(([date, values]: [string, any]) => (
                          <div key={date} className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">{date}</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {parseFloat(values['RSI'] || 0).toFixed(2)}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                !loading && !error && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                    No daily data available
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnalyticsPanel;
