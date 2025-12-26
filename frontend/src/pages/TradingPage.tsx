import LivePriceDisplay from '../components/LivePriceDisplay';
import ChartComponent from '../components/ChartComponent';
import TradingPanel from '../components/TradingPanel';
import InstrumentsPanel from '../components/InstrumentsPanel';
import MarketActivityPanel from '../components/MarketActivityPanel';
import { useAppSelector } from '../store';

export default function TradingPage() {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* TOP SECTION: Responsive Layout */}
      <div className="flex flex-col lg:flex-row min-h-[400px] lg:min-h-[600px] gap-px">

        {/* LEFT COLUMN: Instruments Panel - Desktop left, Mobile after chart */}
        <div className="w-full lg:w-[240px] flex flex-col order-3 lg:order-1 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex-shrink-0">
          {/* Instruments Panel - Full height, scrollable */}
          <div className="h-[600px] sm:h-[700px] lg:h-[calc(100vh-64px)] overflow-y-auto">
            <div className="p-2 sm:p-3">
              <InstrumentsPanel />
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Chart - Shows FIRST on mobile */}
        <div className="flex-1 flex flex-col min-w-0 order-1 lg:order-2 bg-white dark:bg-slate-900">
          {/* Chart Header / Price Display - Compact */}
          <div className="px-2 sm:px-4 py-2 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <LivePriceDisplay symbol={activeInstrument} />
          </div>
          {/* Chart Container - Responsive height */}
          <div className="h-[400px] sm:h-[500px] lg:h-[700px] bg-white dark:bg-slate-900">
            <ChartComponent />
          </div>
        </div>

        {/* RIGHT COLUMN: Trading Panel - Shows SECOND on mobile */}
        <div className="w-full lg:w-[280px] order-2 lg:order-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex-shrink-0">
          <div className="p-2 sm:p-4">
            <TradingPanel />
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: Market Activity Panel (History, Orders) - Spacious */}
      <div className="min-h-[300px] lg:min-h-[400px] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="p-2 sm:p-4">
          <MarketActivityPanel />
        </div>
      </div>

    </div>
  );
}