import { useState, useEffect, memo } from 'react';

type TextInputModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
};

function TextInputModal({ isOpen, onClose, onSubmit }: TextInputModalProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setText('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!text.trim()) {
      setError('Please enter some text.');
      return;
    }

    onSubmit(text.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && text.trim()) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    // Modal backdrop
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 transition-opacity duration-150"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Add Text Annotation
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="annotationText" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Text
            </label>
            <input
              type="text"
              id="annotationText"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 text-sm ${
                error ? 'border-red-500 dark:border-red-600 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
              }`}
              placeholder="Enter text to display on chart"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-500">{error}</p>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Press Enter to add or Escape to cancel
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(TextInputModal);
