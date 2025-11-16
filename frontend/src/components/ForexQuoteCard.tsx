import React from 'react';
import { ForexQuote } from '../store/slices/forexSlice';

// Icon components
const TrendingUp = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 7L13.5 15.5L8.5 10.5L2 17" />
    <path d="M16 7h6v6" />
  </svg>
);

const TrendingDown = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 17L13.5 8.5L8.5 13.5L2 7" />
    <path d="M16 17h6v-6" />
  </svg>
);

const Minus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14" />
  </svg>
);

interface ForexQuoteCardProps {
  quote: ForexQuote;
  onClick?: () => void;
  isSelected?: boolean;
}

const ForexQuoteCard: React.FC<ForexQuoteCardProps> = ({ quote, onClick, isSelected = false }) => {
  const isPositive = quote.change24h > 0;
  const isNegative = quote.change24h < 0;

  // Format price with appropriate decimal places
  const formatPrice = (price: number) => {
    return quote.symbol.includes('JPY') ? price.toFixed(3) : price.toFixed(5);
  };

  // Format spread and range pips
  const formatPips = (pips: number) => {
    return pips.toFixed(1);
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
        ${isSelected ? 'shadow-lg' : 'hover:shadow-md'}
      `}
    >
      {/* Header - Symbol */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {quote.symbol.slice(0, 3)}/{quote.symbol.slice(3)}
          </h3>
          {isSelected && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded font-medium">
              Selected
            </span>
          )}
        </div>

        {/* 24h Change */}
        <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'}`}>
          {isPositive && <TrendingUp size={16} />}
          {isNegative && <TrendingDown size={16} />}
          {!isPositive && !isNegative && <Minus size={16} />}
          <span>{isPositive ? '+' : ''}{quote.change24h.toFixed(2)}%</span>
        </div>
      </div>

      {/* Bid/Ask Prices */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bid</div>
          <div className="text-lg font-mono font-bold text-gray-900 dark:text-white">
            {formatPrice(quote.bid)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ask</div>
          <div className="text-lg font-mono font-bold text-gray-900 dark:text-white">
            {formatPrice(quote.ask)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Spread</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {formatPips(quote.spread)} pips
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">24h High</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {formatPrice(quote.high24h)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">24h Low</div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {formatPrice(quote.low24h)}
          </div>
        </div>
      </div>

      {/* Range Pips */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">24h Range</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatPips(quote.rangePips)} pips
          </span>
        </div>
      </div>

      {/* Last Update Time */}
      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Updated {new Date(quote.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ForexQuoteCard;
