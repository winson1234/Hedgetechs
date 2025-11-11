import LivePriceDisplay from '../components/LivePriceDisplay';
import ChartComponent from '../components/ChartComponent';
import TradingPanel from '../components/TradingPanel';
import InstrumentsPanel from '../components/InstrumentsPanel';
import NewsPanel from '../components/NewsPanel';
import MarketActivityPanel from '../components/MarketActivityPanel';
import { useAppSelector } from '../store';

export default function TradingPage() {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
        {/* Chart + Market Activity - Takes full width on mobile, left half on tablet, 6 cols on xl */}
        <div className="md:col-span-2 xl:col-span-6 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5">
            <div className="mb-5">
              <LivePriceDisplay symbol={activeInstrument} />
            </div>
            <ChartComponent />
          </div>
          <div className="h-[300px] md:h-[360px] lg:h-[440px]">
            <MarketActivityPanel />
          </div>
        </div>

        {/* Trading Panel - Full width on mobile, right half on tablet, 3 cols on xl */}
        <div className="md:col-span-1 xl:col-span-3">
          <div className="h-full min-h-[800px] lg:min-h-[1000px] xl:min-h-[1100px]">
            <TradingPanel />
          </div>
        </div>

        {/* Instruments + News - Full width on mobile, spans both on tablet, 3 cols on xl */}
        <div className="md:col-span-1 xl:col-span-3 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5 h-[500px] md:h-[600px] lg:h-[600px] overflow-y-auto">
            <InstrumentsPanel />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5 h-[400px] md:h-[450px] lg:h-[700px]">
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
