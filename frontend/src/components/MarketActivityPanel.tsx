import React, { useState } from 'react';
import { useAppSelector } from '../store';
import PendingOrdersTab from './market/PendingOrdersTab';
import TradeHistoryTab from './market/TradeHistoryTab';
import { formatPrice, formatQuantity } from '../utils/priceUtils';

type TabType = 'orderbook' | 'trades' | 'pending' | 'history';

export default function MarketActivityPanel() {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  // Get order book and trades from Redux store (updated by WebSocket middleware)
  const orderBook = useAppSelector(state => state.price.orderBooks[activeInstrument]);
  const trades = useAppSelector(state => state.price.trades[activeInstrument]) || [];
  const [activeTab, setActiveTab] = useState<TabType>('orderbook');

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
      {/* Tab Header */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
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
              {trades.length > 0 ? (
                trades.map((trade, index) => {
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
                })
              ) : (
                <div className="text-slate-400 dark:text-slate-500 text-sm text-center mt-4">No recent trades</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pending' && <PendingOrdersTab />}

        {activeTab === 'history' && <TradeHistoryTab />}
      </div>
    </div>
  );
}
