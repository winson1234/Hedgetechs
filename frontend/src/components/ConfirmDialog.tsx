import { useEffect, useCallback } from 'react';

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  details?: Array<{ label: string; value: string; highlight?: boolean }>;
};

type PositionDetail = {
  side: 'LONG' | 'SHORT';
  pnl: string;
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  details
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onConfirm();
  }, [isOpen, onCancel, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Check if this is a hedged pair close dialog
  const isHedgedPairClose = title === 'Close Hedged Pair';
  
  // Parse details for hedged pair
  let symbol = '';
  const longPosition: PositionDetail = { side: 'LONG', pnl: '' };
  const shortPosition: PositionDetail = { side: 'SHORT', pnl: '' };
  let combinedPnL = '';
  let closePrice = '';
  let otherDetails: Array<{ label: string; value: string; highlight?: boolean }> = [];

  if (isHedgedPairClose && details) {
    details.forEach(detail => {
      if (detail.label.includes('LONG Position')) {
        symbol = detail.value;
      } else if (detail.label.includes('SHORT Position')) {
        symbol = detail.value;
      } else if (detail.label === 'P&L' && !longPosition.pnl) {
        longPosition.pnl = detail.value;
      } else if (detail.label === 'P&L' && longPosition.pnl) {
        shortPosition.pnl = detail.value;
      } else if (detail.label === 'Combined P&L') {
        combinedPnL = detail.value;
      } else if (detail.label === 'Close Price') {
        closePrice = detail.value;
      }
    });
  } else if (details) {
    otherDetails = details;
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: (
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
        };
      default:
        return {
          icon: (
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        };
    }
  };

  const styles = getVariantStyles();

  const getPnLColor = (pnl: string) => {
    if (pnl.startsWith('+')) return 'text-green-600 dark:text-green-400';
    if (pnl.startsWith('-')) return 'text-red-600 dark:text-red-400';
    return 'text-slate-700 dark:text-slate-300';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-xl transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4">
          <div className="flex-shrink-0 mt-0.5">
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Hedged Pair Details */}
        {isHedgedPairClose && longPosition.pnl && shortPosition.pnl && (
          <div className="px-6 pb-4 space-y-3">
            {/* Symbol Header */}
            <div className="text-center pb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Symbol</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{symbol}</div>
            </div>

            {/* Position Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Long Position Card */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-xs font-semibold uppercase text-green-700 dark:text-green-300">Long</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">P&L</div>
                <div className={`text-lg font-bold ${getPnLColor(longPosition.pnl)}`}>
                  {longPosition.pnl}
                </div>
              </div>

              {/* Short Position Card */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-xs font-semibold uppercase text-red-700 dark:text-red-300">Short</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">P&L</div>
                <div className={`text-lg font-bold ${getPnLColor(shortPosition.pnl)}`}>
                  {shortPosition.pnl}
                </div>
              </div>
            </div>

            {/* Combined P&L Highlight */}
            <div className="bg-slate-100 dark:bg-slate-700 rounded-md p-4 border-2 border-slate-300 dark:border-slate-600">
              <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1 text-center">
                Combined P&L
              </div>
              <div className={`text-2xl font-bold text-center ${getPnLColor(combinedPnL)}`}>
                {combinedPnL}
              </div>
            </div>

            {/* Close Price */}
            <div className="flex justify-between items-center text-sm pt-2">
              <span className="text-slate-600 dark:text-slate-400">Close Price:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{closePrice}</span>
            </div>
          </div>
        )}

        {/* Standard Details Section */}
        {!isHedgedPairClose && otherDetails && otherDetails.length > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-md p-3 space-y-2">
              {otherDetails.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{detail.label}:</span>
                  <span className={`font-medium ${
                    detail.highlight 
                      ? 'text-slate-900 dark:text-slate-100' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
