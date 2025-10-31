import type { Account, WalletTab } from '../App';
import type { AssetPriceMap } from '../hooks/useAssetPrices';
import WalletOverview from '../components/wallet/WalletOverview';
import DepositTab from '../components/wallet/DepositTab';
import WithdrawTab from '../components/wallet/WithdrawTab';
import TransferTab from '../components/wallet/TransferTab';

type WalletPageProps = {
  accounts: Account[];
  activeAccountId: string | null;
  activeWalletTab: WalletTab;
  setActiveWalletTab: (tab: WalletTab) => void;
  onDeposit: (accountId: string, amount: number, currency: string) => { success: boolean; message: string };
  onWithdraw: (accountId: string, amount: number, currency: string) => { success: boolean; message: string };
  onTransfer: (fromAccountId: string, toAccountId: string, amount: number, currency: string) => { success: boolean; message: string };
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
  assetPrices: AssetPriceMap;
  pricesLoading: boolean;
};

export default function WalletPage({
  accounts,
  activeAccountId,
  activeWalletTab,
  setActiveWalletTab,
  onDeposit,
  onWithdraw,
  onTransfer,
  formatBalance,
  showToast,
  assetPrices,
  pricesLoading,
}: WalletPageProps) {

  const activeAccount = accounts.find(acc => acc.id === activeAccountId) || null;

  const renderTabContent = () => {
    switch (activeWalletTab) {
      case 'overview':
        return (
          <WalletOverview
            accounts={accounts}
            formatBalance={formatBalance}
            assetPrices={assetPrices}
            pricesLoading={pricesLoading}
          />
        );
      case 'deposit':
        return (
          <DepositTab
            accounts={accounts}
            activeAccount={activeAccount}
            onDeposit={onDeposit}
            formatBalance={formatBalance}
            showToast={showToast}
          />
        );
      case 'withdraw':
        return (
          <WithdrawTab
            accounts={accounts}
            activeAccount={activeAccount}
            onWithdraw={onWithdraw}
            formatBalance={formatBalance}
            showToast={showToast}
          />
        );
      case 'transfer':
        return (
          <TransferTab
            accounts={accounts}
            activeAccount={activeAccount}
            onTransfer={onTransfer}
            formatBalance={formatBalance}
            showToast={showToast}
          />
        );
      default:
        return <WalletOverview accounts={accounts} formatBalance={formatBalance} assetPrices={assetPrices} pricesLoading={pricesLoading} />;
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
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 md:px-6 lg:px-8 pt-3">
          <nav className="flex -mb-px space-x-8" aria-label="Tabs">
            {(['overview', 'deposit', 'withdraw', 'transfer'] as WalletTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveWalletTab(tab)}
                className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors capitalize ${
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