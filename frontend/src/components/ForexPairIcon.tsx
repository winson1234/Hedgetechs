import React, { useState, useEffect } from 'react';

interface ForexPairIconProps {
  base: string;
  quote: string;
}

const ForexPairIcon: React.FC<ForexPairIconProps> = ({ base, quote }) => {
  const [failedCount, setFailedCount] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  // Currency code to country code mapping
  const currencyToCountry: Record<string, string> = {
    'CAD': 'ca',
    'AUD': 'au',
    'JPY': 'jp',
    'NZD': 'nz',
    'EUR': 'eu',
    'GBP': 'gb',
    'USD': 'us',
    'CHF': 'ch'
  };

  const baseCountry = currencyToCountry[base] || base.toLowerCase();
  const quoteCountry = currencyToCountry[quote] || quote.toLowerCase();

  useEffect(() => {
    if (failedCount >= 2) {
      setShowFallback(true);
    }
  }, [failedCount]);

  const handleImageError = () => {
    setFailedCount(prev => prev + 1);
  };

  if (showFallback) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {base}/{quote}
        </span>
      </div>
    );
  }

  return (
    <div className="flex -space-x-2 items-center justify-center">
      <img
        src={`https://hatscripts.github.io/circle-flags/flags/${baseCountry}.svg`}
        alt={base}
        className="w-5 h-5 rounded-full border border-white dark:border-slate-900"
        onError={handleImageError}
      />
      <img
        src={`https://hatscripts.github.io/circle-flags/flags/${quoteCountry}.svg`}
        alt={quote}
        className="w-5 h-5 rounded-full border border-white dark:border-slate-900"
        onError={handleImageError}
      />
    </div>
  );
};

export default ForexPairIcon;
