import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchForexQuotes, fetchForexKlines, setSelectedSymbol } from '../store/slices/forexSlice';
import { addToast } from '../store/slices/uiSlice';
import ForexQuoteCard from '../components/ForexQuoteCard';
import SessionIndicator from '../components/SessionIndicator';
import ForexChartComponent from '../components/ForexChartComponent';

// Icon components
const RefreshCw = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
  </svg>
);

const TrendingUp = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 7L13.5 15.5L8.5 10.5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
);

export default function ForexPage() {
  const dispatch = useAppDispatch();

  // Access Redux store
  const { quotes, activeSessions, selectedSymbol, loading, error } = useAppSelector((state) => state.forex);

  const [chartInterval, setChartInterval] = useState<string>('1h');

  // Fetch quotes on mount
  useEffect(() => {
    dispatch(fetchForexQuotes())
      .unwrap()
      .catch((err) => {
        dispatch(addToast({
          type: 'error',
          message: `Failed to load forex quotes: ${err}`,
          duration: 5000,
        }));
      });

    // Refresh quotes every 60 seconds
    const intervalId = setInterval(() => {
      dispatch(fetchForexQuotes());
    }, 60000);

    return () => clearInterval(intervalId);
  }, [dispatch]);

  // Fetch klines when symbol or interval changes
  useEffect(() => {
    if (selectedSymbol) {
      // Fetch forex historical klines for chart
      dispatch(fetchForexKlines({ symbol: selectedSymbol, interval: chartInterval, limit: 200 }))
        .unwrap()
        .catch((err) => {
          dispatch(addToast({
            type: 'error',
            message: `Failed to load chart data: ${err}`,
            duration: 5000,
          }));
        });
    }
  }, [dispatch, selectedSymbol, chartInterval]);

  // Handle quote card click
  const handleQuoteClick = (symbol: string) => {
    dispatch(setSelectedSymbol(symbol));
  };

  // Handle manual refresh
  const handleRefresh = () => {
    dispatch(fetchForexQuotes())
      .unwrap()
      .then(() => {
        dispatch(addToast({
          type: 'success',
          message: 'Forex quotes refreshed',
          duration: 3000,
        }));
      })
      .catch((err) => {
        dispatch(addToast({
          type: 'error',
          message: `Refresh failed: ${err}`,
          duration: 5000,
        }));
      });
  };

  // Convert quotes object to array and sort by symbol
  const quotesArray = Object.values(quotes).sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forex Trading</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Sessions */}
          <SessionIndicator sessions={activeSessions} />

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-6 p-6" style={{ minHeight: '600px' }}>
          {/* Left Panel - Forex Quotes */}
          <div className="lg:col-span-1 overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Forex Pairs</h2>

            {quotesArray.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>No forex quotes available</p>
                <p className="text-sm mt-2">Click refresh to load data</p>
              </div>
            )}

            {loading && quotesArray.length === 0 && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Loading forex quotes...</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {quotesArray.map((quote) => (
                <ForexQuoteCard
                  key={quote.symbol}
                  quote={quote}
                  onClick={() => handleQuoteClick(quote.symbol)}
                  isSelected={quote.symbol === selectedSymbol}
                />
              ))}
            </div>
          </div>

          {/* Right Panel - Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
            {!selectedSymbol && (
              <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Select a forex pair to view chart</p>
                  <p className="text-sm mt-2">Click on any quote card to the left</p>
                </div>
              </div>
            )}

            {selectedSymbol && (
              <>
                {/* Chart Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedSymbol.slice(0, 3)}/{selectedSymbol.slice(3)}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {quotes[selectedSymbol] && (
                        <span>
                          Bid: {quotes[selectedSymbol].bid.toFixed(selectedSymbol.includes('JPY') ? 3 : 5)} |
                          Ask: {quotes[selectedSymbol].ask.toFixed(selectedSymbol.includes('JPY') ? 3 : 5)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Interval Selector */}
                  <div className="flex gap-2">
                    {['1m', '5m', '15m', '1h', '4h', '1d'].map((interval) => (
                      <button
                        key={interval}
                        onClick={() => setChartInterval(interval)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          chartInterval === interval
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-0">
                  <ForexChartComponent />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
