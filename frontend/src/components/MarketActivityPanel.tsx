import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store';
import PendingOrdersTab from './market/PendingOrdersTab';
import TradeHistoryTab from './market/TradeHistoryTab';
import PositionsTable from './market/PositionsTable';
import { formatPrice, formatQuantity } from '../utils/priceUtils';

type TabType = 'orderbook' | 'trades' | 'pending' | 'history' | 'positions';

export default function MarketActivityPanel() {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const selectedProductType = useAppSelector(state => state.ui.selectedProductType);
  // Get order book and trades from Redux store (updated by WebSocket middleware)
  const orderBook = useAppSelector(state => state.price.orderBooks[activeInstrument]);
  const trades = useAppSelector(state => state.price.trades[activeInstrument]) || [];

  // Determine if CFD mode based on global product type selection
  const isCFD = selectedProductType === 'cfd' || selectedProductType === 'futures';
  const isSpot = selectedProductType === 'spot';

  const [activeTab, setActiveTab] = useState<TabType>(isSpot ? 'orderbook' : 'positions');
  const [filterByProductType, setFilterByProductType] = useState<boolean>(false);

  // Switch to appropriate tab when product type changes
  useEffect(() => {
    if (isSpot && (activeTab === 'positions')) {
      setActiveTab('orderbook'); // Switch to orderbook when going from CFD to SPOT
    } else if (isCFD && (activeTab === 'orderbook' || activeTab === 'trades')) {
      setActiveTab('positions'); // Switch to positions when going from SPOT to CFD
    }
  }, [selectedProductType, isSpot, isCFD, activeTab]);

  // Convert Redux order book format to component format
  const bids: [string, string][] = orderBook?.bids.map(bid => [
    bid.price.toString(),
    bid.quantity.toString()
  ]) || [];

  const asks: [string, string][] = orderBook?.asks.map(ask => [
    ask.price.toString(),
    ask.quantity.toString()
  ]) || [];

  // Calculate total for each level
  const calculateTotal = (orders: [string, string][], index: number): string => {
    let total = 0;
    for (let i = 0; i <= index; i++) {
      total += parseFloat(orders[i][1]);
    }
    return total.toFixed(4);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 h-full flex flex-col">
      {/* Tab Header - Dynamic tabs based on product type */}
      <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1 overflow-x-auto">
        {/* SPOT mode tabs: Order Book, Market Trades */}
        {isSpot && (
          <>
            <button
              onClick={() => setActiveTab('orderbook')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'orderbook'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              Order Book
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'trades'
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              Market Trades
            </button>
          </>
        )}

        {/* CFD mode tabs: Positions */}
        {isCFD && (
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'positions'
                ? 'text-blue-500 border-b-2 border-blue-500'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Positions
          </button>
        )}

        {/* Common tabs for all modes: Pending Orders, Trade History */}
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'pending'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Pending Orders
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Trade History
        </button>
        </div>

        {/* Filter Toggle - only show for history and pending tabs */}
        {(activeTab === 'history' || activeTab === 'pending' || activeTab === 'positions') && (
          <button
            onClick={() => setFilterByProductType(!filterByProductType)}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              filterByProductType
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={filterByProductType ? 'Showing current product type only' : 'Showing all orders'}
          >
            {filterByProductType ? `${selectedProductType.toUpperCase()} Only` : 'All'}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'orderbook' && (
          <div className="flex gap-4 h-full overflow-hidden">
            {/* Bids (Buy Orders) - Left Side */}
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">
                <div className="text-left">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {bids.length > 0 ? (
                  bids.map((bid, index) => (
                    <div
                      key={`bid-${index}`}
                      className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                      <div className="text-green-600 dark:text-green-500 font-medium">{formatPrice(parseFloat(bid[0]))}</div>
                      <div className="text-slate-700 dark:text-slate-300 text-right">{formatQuantity(parseFloat(bid[1]))}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-right text-xs">{calculateTotal(bids, index)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 text-sm text-center mt-4">No bid data</div>
                )}
              </div>
            </div>

            {/* Separator Line */}
            <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>

            {/* Asks (Sell Orders) - Right Side */}
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">
                <div className="text-left">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {asks.length > 0 ? (
                  asks.map((ask, index) => (
                    <div
                      key={`ask-${index}`}
                      className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                    >
                      <div className="text-red-600 dark:text-red-500 font-medium">{formatPrice(parseFloat(ask[0]))}</div>
                      <div className="text-slate-700 dark:text-slate-300 text-right">{formatQuantity(parseFloat(ask[1]))}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-right text-xs">{calculateTotal(asks, index)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-slate-500 text-sm text-center mt-4">No ask data</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Market Trades Header */}
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">
              <div className="text-left">Price</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Time</div>
            </div>

            {/* Market Trades List */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {(() => {
                // Filter out invalid trades first
                const validTrades = trades.filter(t => t.quantity > 0 && t.price > 0);

                if (validTrades.length > 0) {
                  return validTrades.map((trade, index) => {
                    const tradeTime = new Date(trade.time);
                    const timeStr = tradeTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    });
                    const isBuy = !trade.isBuyerMaker; // If buyer is maker, it's a sell; otherwise buy

                    return (
                      <div
                        key={`trade-${trade.time}-${index}`}
                        className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <div className={`font-medium ${isBuy ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {formatPrice(trade.price)}
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 text-right">{formatQuantity(trade.quantity)}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-right text-xs">{timeStr}</div>
                      </div>
                    );
                  });
                } else {
                  return (
                    <div className="text-slate-400 dark:text-slate-500 text-sm text-center mt-4">
                      {trades.length > 0 ? 'Trade data not available for this instrument' : 'No recent trades'}
                    </div>
                  );
                }
              })()}
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
      </div>
    </div>
  );
}
