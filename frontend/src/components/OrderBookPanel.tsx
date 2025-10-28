import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'

type OrderBookPanelProps = {
  activeInstrument: string
}

type Trade = {
  price: string
  quantity: string
  time: number
  isBuyerMaker: boolean
}

export default function OrderBookPanel({ activeInstrument }: OrderBookPanelProps) {
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null
  const [activeTab, setActiveTab] = useState<'orderbook' | 'trades'>('orderbook')
  const [bids, setBids] = useState<[string, string][]>([])
  const [asks, setAsks] = useState<[string, string][]>([])
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!lastMessage) return
    
    try {
      // Check if this is an order book update
      if ('symbol' in lastMessage && 'bids' in lastMessage && 'asks' in lastMessage) {
        const data = lastMessage as { symbol: string; bids: [string, string][]; asks: [string, string][] }
        
        if (data.symbol === activeInstrument) {
          // Market standard: Show 10-12 levels (following Binance/TradingView approach)
          setBids(data.bids.slice(0, 12))
          setAsks(data.asks.slice(0, 12))
        }
      }
      
      // Check if this is a trade message (has price, time, but not bids/asks)
      if ('symbol' in lastMessage && 'price' in lastMessage && 'time' in lastMessage && !('bids' in lastMessage)) {
        const tradeMsg = lastMessage as { symbol: string; price: string | number; time: number; quantity?: string | number; isBuyerMaker?: boolean }
        
        if (tradeMsg.symbol === activeInstrument) {
          const newTrade: Trade = {
            price: String(tradeMsg.price),
            quantity: String(tradeMsg.quantity || '0'),
            time: tradeMsg.time,
            isBuyerMaker: tradeMsg.isBuyerMaker || false
          }
          
          // Keep last 50 trades
          setTrades(prev => [newTrade, ...prev].slice(0, 50))
        }
      }
    } catch (err) {
      console.error('Error parsing WebSocket data:', err)
    }
  }, [lastMessage, activeInstrument])
  
  // Reset trades when instrument changes
  useEffect(() => {
    setTrades([])
  }, [activeInstrument])

  // Calculate total for each level
  const calculateTotal = (orders: [string, string][], index: number): string => {
    let total = 0
    for (let i = 0; i <= index; i++) {
      total += parseFloat(orders[i][1])
    }
    return total.toFixed(4)
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-900 rounded-lg p-4 h-full flex flex-col">
      {/* Tab Header */}
      <div className="flex gap-2 mb-4 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('orderbook')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'orderbook'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Order Book
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'trades'
              ? 'text-blue-500 border-b-2 border-blue-500'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Market Trades
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'orderbook' ? (
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Bids (Buy Orders) - Left Side */}
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
              <div className="text-left">Price</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Total</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {bids.length > 0 ? (
                bids.map((bid, index) => (
                  <div
                    key={`bid-${index}`}
                    className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-800 rounded"
                  >
                    <div className="text-green-500 font-medium">{parseFloat(bid[0]).toFixed(2)}</div>
                    <div className="text-slate-300 text-right">{parseFloat(bid[1]).toFixed(4)}</div>
                    <div className="text-slate-400 text-right text-xs">{calculateTotal(bids, index)}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-sm text-center mt-4">No bid data</div>
              )}
            </div>
          </div>

          {/* Asks (Sell Orders) - Right Side */}
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
              <div className="text-left">Price</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Total</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {asks.length > 0 ? (
                asks.map((ask, index) => (
                  <div
                    key={`ask-${index}`}
                    className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-800 rounded"
                  >
                    <div className="text-red-500 font-medium">{parseFloat(ask[0]).toFixed(2)}</div>
                    <div className="text-slate-300 text-right">{parseFloat(ask[1]).toFixed(4)}</div>
                    <div className="text-slate-400 text-right text-xs">{calculateTotal(asks, index)}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-sm text-center mt-4">No ask data</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Market Trades Header */}
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-400 mb-2 px-2">
            <div className="text-left">Price</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Time</div>
          </div>
          
          {/* Market Trades List */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {trades.length > 0 ? (
              trades.map((trade, index) => {
                const tradeTime = new Date(trade.time)
                const timeStr = tradeTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                const isBuy = !trade.isBuyerMaker // If buyer is maker, it's a sell; otherwise buy
                
                return (
                  <div
                    key={`trade-${trade.time}-${index}`}
                    className="grid grid-cols-3 gap-2 text-sm px-2 py-1 hover:bg-slate-800 rounded"
                  >
                    <div className={`font-medium ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                      {parseFloat(trade.price).toFixed(2)}
                    </div>
                    <div className="text-slate-300 text-right">{parseFloat(trade.quantity).toFixed(4)}</div>
                    <div className="text-slate-400 text-right text-xs">{timeStr}</div>
                  </div>
                )
              })
            ) : (
              <div className="text-slate-500 text-sm text-center mt-4">No recent trades</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
