import type { WalletTab } from '../types';
import { useUIStore } from '../stores/uiStore';
import WalletOverview from '../components/wallet/WalletOverview';
import DepositTab from '../components/wallet/DepositTab';
import WithdrawTab from '../components/wallet/WithdrawTab';
import TransferTab from '../components/wallet/TransferTab';

export default function WalletPage() {
  // Access stores
  const activeWalletTab = useUIStore(state => state.activeWalletTab);
  const setActiveWalletTab = useUIStore(state => state.setActiveWalletTab);

  const renderTabContent = () => {
    switch (activeWalletTab) {
      case 'overview':
        return <WalletOverview />;
      case 'deposit':
        return <DepositTab />;
      case 'withdraw':
        return <WithdrawTab />;
      case 'transfer':
        return <TransferTab />;
      default:
        return <WalletOverview />;
    }
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Wallet
        </h1>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 md:px-6 lg:px-8 pt-5">
          <nav className="flex justify-center -mb-px space-x-12" aria-label="Tabs">
            {(['overview', 'deposit', 'withdraw', 'transfer'] as WalletTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveWalletTab(tab)}
                className={`whitespace-nowrap pb-4 px-3 border-b-2 font-semibold text-base transition-colors capitalize ${
                  activeWalletTab === tab
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="p-5 md:p-6 lg:p-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}