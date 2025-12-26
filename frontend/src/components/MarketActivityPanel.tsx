import React, { useState, useEffect, memo, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { setActiveMarketTab } from '../store/slices/uiSlice';
import PendingOrdersTab from './market/PendingOrdersTab';
import TradeHistoryTab from './market/TradeHistoryTab';
import PositionsTable from './market/PositionsTable';
import SessionIndicator from './SessionIndicator';
import { formatPrice, formatQuantity } from '../utils/priceUtils';

type TabType = 'orderbook' | 'trades' | 'pending' | 'history' | 'positions' | 'forex';

function MarketActivityPanel() {
  const dispatch = useAppDispatch();
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const selectedProductType = useAppSelector(state => state.ui.selectedProductType);
  const activeMarketTabFromState = useAppSelector(state => state.ui.activeMarketTab);
  // Get order book and trades from Redux store (updated by WebSocket middleware)
  const orderBook = useAppSelector(state => state.price.orderBooks[activeInstrument]);
  const tradesRaw = useAppSelector(state => state.price.trades[activeInstrument]);
  const trades = useMemo(() => tradesRaw || [], [tradesRaw]);
  // Get forex quotes from Redux store
  const forexQuotes = useAppSelector(state => state.forex.quotes);

  // Detect if active instrument is forex
  const isForex = activeInstrument && forexQuotes[activeInstrument];
  const forexQuote = isForex ? forexQuotes[activeInstrument] : null;

  // Determine if CFD mode based on global product type selection
  const isCFD = selectedProductType === 'cfd' || selectedProductType === 'futures';
  const isSpot = selectedProductType === 'spot';

  // Set default tab based on forex/spot/cfd
  const getDefaultTab = (): TabType => {
    if (isForex) return 'forex';
    if (isSpot) return 'orderbook';
    if (isCFD) return 'positions';
    return 'orderbook';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getDefaultTab());
  const [filterByProductType, setFilterByProductType] = useState<boolean>(false);

  // Sync with Redux state (for external navigation, e.g., from TradingPanel)
  useEffect(() => {
    if (activeMarketTabFromState !== null) {
      setActiveTab(activeMarketTabFromState);
      // Reset Redux state after applying
      dispatch(setActiveMarketTab(null));
    }
  }, [activeMarketTabFromState, dispatch]);

  // Switch to appropriate tab when product type or forex status changes
  useEffect(() => {
    // If forex instrument is selected, default to forex tab (unless on pending/history/positions)
    if (isForex && activeTab !== 'forex' && activeTab !== 'pending' && activeTab !== 'history' && activeTab !== 'positions') {
      setActiveTab('forex');
    }
    // If non-forex crypto SPOT and currently on positions or forex tab, switch to orderbook
    else if (!isForex && isSpot && (activeTab === 'positions' || activeTab === 'forex')) {
      setActiveTab('orderbook');
    }
    // If non-forex CFD and currently on orderbook/trades, switch to positions
    else if (!isForex && isCFD && (activeTab === 'orderbook' || activeTab === 'trades')) {
      setActiveTab('positions');
    }
    // If forex CFD and on orderbook/trades, switch to positions (keep forex tab available)
    else if (isForex && isCFD && (activeTab === 'orderbook' || activeTab === 'trades')) {
      setActiveTab('positions');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductType, isForex]);

  // Convert Redux order book format to component format (memoized for performance)
  const bids: [string, string][] = useMemo(() => {
    return orderBook?.bids.map(bid => [
      bid.price.toString(),
      bid.quantity.toString()
    ]) || [];
  }, [orderBook?.bids]);

  const asks: [string, string][] = useMemo(() => {
    return orderBook?.asks.map(ask => [
      ask.price.toString(),
      ask.quantity.toString()
    ]) || [];
  }, [orderBook?.asks]);

  // Pre-calculate cumulative totals for performance (memoized)
  const bidTotals = useMemo(() => {
    let cumulative = 0;
    return bids.map(bid => {
      cumulative += parseFloat(bid[1]);
      return cumulative.toFixed(4);
    });
  }, [bids]);

  const askTotals = useMemo(() => {
    let cumulative = 0;
    return asks.map(ask => {
      cumulative += parseFloat(ask[1]);
      return cumulative.toFixed(4);
    });
  }, [asks]);

  // Memoize filtered valid trades for performance
  const validTrades = useMemo(() => {
    return trades.filter(t => t.quantity > 0 && t.price > 0);
  }, [trades]);

  return (
    <div className="bg-white dark:bg-slate-900 h-full flex flex-col">
      {/* Tab Header - Dynamic tabs based on product type */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {/* Forex mode tab: Forex Info (show for both SPOT and CFD when forex instrument selected) */}
          {isForex && (isSpot || isCFD) && (
            <button
              onClick={() => setActiveTab('forex')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'forex'
                ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
            >
              Forex Info
            </button>
          )}

          {/* SPOT mode tabs: Order Book, Market Trades (hide for forex) */}
          {isSpot && !isForex && (
            <>
              <button
                onClick={() => setActiveTab('orderbook')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'orderbook'
                  ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
              >
                Order Book
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'trades'
                  ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
              >
                Market Trades
              </button>
            </>
          )}

          {/* CFD mode tabs: Positions (show for both CFD crypto and forex) */}
          {isCFD && (
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'positions'
                ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
            >
              Positions
            </button>
          )}

          {/* Common tabs for all modes: Pending Orders, Trade History */}
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'pending'
              ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            Pending Orders
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'history'
              ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
          >
            Trade History
          </button>
        </div>

        {/* Filter Toggle - only show for history and pending tabs */}
        {(activeTab === 'history' || activeTab === 'pending' || activeTab === 'positions') && (
          <button
            onClick={() => setFilterByProductType(!filterByProductType)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${filterByProductType
              ? 'bg-[#00C0A2]/20 dark:bg-[#00C0A2]/30 text-[#00C0A2] dark:text-[#00C0A2] border border-[#00C0A2]/50'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            title={filterByProductType ? 'Showing current product type only' : 'Showing all orders'}
          >
            {filterByProductType ? `${selectedProductType.toUpperCase()} Only` : 'All'}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden px-4 py-2">
        {activeTab === 'orderbook' && (
          <div className="flex gap-4 h-full overflow-hidden">
            {/* Bids (Buy Orders) - Left Side */}
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
                <div className="text-left">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {bids.length > 0 ? (
                  bids.map((bid, index) => (
                    <div
                      key={`bid-${index}`}
                      className="grid grid-cols-3 gap-2 text-xs px-2 py-1 hover:bg-slate-800 rounded"
                    >
                      <div className="text-green-500 font-medium">{formatPrice(parseFloat(bid[0]))}</div>
                      <div className="text-slate-300 text-right">{formatQuantity(parseFloat(bid[1]))}</div>
                      <div className="text-slate-500 text-right">{bidTotals[index]}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-sm text-center mt-4">No bid data</div>
                )}
              </div>
            </div>

            {/* Separator Line */}
            <div className="w-px bg-slate-700 flex-shrink-0"></div>

            {/* Asks (Sell Orders) - Right Side */}
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
                <div className="text-left">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {asks.length > 0 ? (
                  asks.map((ask, index) => (
                    <div
                      key={`ask-${index}`}
                      className="grid grid-cols-3 gap-2 text-xs px-2 py-1 hover:bg-slate-800 rounded"
                    >
                      <div className="text-red-500 font-medium">{formatPrice(parseFloat(ask[0]))}</div>
                      <div className="text-slate-300 text-right">{formatQuantity(parseFloat(ask[1]))}</div>
                      <div className="text-slate-500 text-right">{askTotals[index]}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-sm text-center mt-4">No ask data</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Market Trades Header */}
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
              <div className="text-left">Price</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Time</div>
            </div>

            {/* Market Trades List */}
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {validTrades.length > 0 ? (
                validTrades.map((trade, index) => {
                  const tradeTime = new Date(trade.time);
                  const timeStr = tradeTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });
                  const isBuy = !trade.isBuyerMaker;

                  return (
                    <div
                      key={`trade-${trade.time}-${index}`}
                      className="grid grid-cols-3 gap-2 text-xs px-2 py-1 hover:bg-slate-800 rounded"
                    >
                      <div className={`font-medium ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPrice(trade.price)}
                      </div>
                      <div className="text-slate-300 text-right">{formatQuantity(trade.quantity)}</div>
                      <div className="text-slate-500 text-right">{timeStr}</div>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 text-sm text-center mt-4">
                  {trades.length > 0 ? 'Trade data not available for this instrument' : 'No recent trades'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <PendingOrdersTab
            filterByProductType={filterByProductType}
            selectedProductType={selectedProductType}
          />
        )}

        {activeTab === 'history' && (
          <TradeHistoryTab
            filterByProductType={filterByProductType}
            selectedProductType={selectedProductType}
          />
        )}

        {activeTab === 'positions' && isCFD && (
          <PositionsTable
            filterByProductType={filterByProductType}
            selectedProductType={selectedProductType}
          />
        )}

        {/* Forex Info Tab - Compact grid layout */}
        {activeTab === 'forex' && isForex && forexQuote && (
          <div className="h-full p-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded h-full flex flex-col">
              {/* Header */}
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center">{activeInstrument}</h2>
              </div>

              {/* Grid Layout - 2x2 */}
              <div className="flex-1 grid grid-cols-2 divide-x divide-y divide-slate-200 dark:divide-slate-700">
                {/* Top Left - Price & Spread */}
                <div className="p-3 flex flex-col justify-center">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3">Price & Spread</h3>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Bid</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-500 font-mono">{forexQuote.bid.toFixed(5)}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Ask</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-500 font-mono">{forexQuote.ask.toFixed(5)}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Spread</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{forexQuote.spread.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">pips</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Right - 24h Statistics */}
                <div className="p-3 flex flex-col justify-center">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3">24h Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Change</span>
                      <div className={`px-1.5 py-0.5 rounded text-xs font-bold ${forexQuote.change24h >= 0
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                        {forexQuote.change24h >= 0 ? '▲' : '▼'} {Math.abs(forexQuote.change24h).toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">High</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">{forexQuote.high24h.toFixed(5)}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Low</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">{forexQuote.low24h.toFixed(5)}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Range</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">{forexQuote.rangePips.toFixed(1)}</span>
                        <span className="text-xs text-slate-400">pips</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Left - Active Sessions */}
                <div className="p-3 flex flex-col justify-center col-span-2">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Active Sessions</h3>
                  <SessionIndicator sessions={forexQuote.sessions} />
                </div>
              </div>

              {/* Footer */}
              <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Updated {new Date(forexQuote.lastUpdated).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-renders when Redux state values from selectors change
export default memo(MarketActivityPanel);
