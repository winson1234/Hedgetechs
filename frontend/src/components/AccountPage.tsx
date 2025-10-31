import { useState, useMemo, useEffect } from 'react';
import type { Account, Page, WalletTab } from '../App';
import type { AssetPriceMap } from '../hooks/useAssetPrices';
import OpenAccountModal from './OpenAccountModal';
import EditBalanceModal from './EditBalanceModal';

// --- Icons ---
const PlusIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg> );
const PencilSquareIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg> );
const ArrowDownTrayIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> );
const ArrowUpTrayIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> );
// --- End Icons ---

type EditBalanceResult = { success: boolean; message?: string };

type AccountPageProps = {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  openAccount: (type: 'live' | 'demo', currency: string, initialBalance?: number, platformType?: 'integrated' | 'external', platform?: string, server?: string) => { success: boolean, message?: string };
  editDemoBalance: (accountId: string, newBalance: number) => EditBalanceResult;
  toggleAccountStatus: (accountId: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
  assetPrices: AssetPriceMap;
  pricesLoading: boolean;
  navigateTo: (page: Page, tab?: WalletTab) => void;
};

type AccountTab = 'live' | 'demo';

export default function AccountPage({
  accounts,
  activeAccountId,
  setActiveAccount,
  openAccount,
  editDemoBalance,
  toggleAccountStatus,
  showToast,
  formatBalance,
  assetPrices,
  navigateTo
}: AccountPageProps) {
  const [activeTab, setActiveTab] = useState<AccountTab>('live');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Set selectedAccountId to activeAccountId on mount
  useEffect(() => {
    if (activeAccountId && !selectedAccountId) {
      setSelectedAccountId(activeAccountId);
    }
  }, [activeAccountId, selectedAccountId]);

  const liveAccounts = useMemo(() => accounts.filter(acc => acc.type === 'live'), [accounts]);
  const demoAccounts = useMemo(() => accounts.filter(acc => acc.type === 'demo'), [accounts]);
  const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);

  // Helper function to calculate asset allocations for any account
  const calculateAllocations = (account: Account) => {
    if (!account || account.platformType === 'external') return [];

    const holdings = Object.entries(account.balances).filter(
      ([currency, amount]) => currency !== account.currency && amount > 0
    );

    if (holdings.length === 0) return [];

    // Calculate USD values for each holding
    const fiatCurrencies = ['USD', 'EUR', 'MYR', 'JPY'];
    const holdingsWithUsd = holdings.map(([currency, amount]) => {
      const isFiat = fiatCurrencies.includes(currency);
      let usdValue = 0;

      if (isFiat) {
        usdValue = amount; // 1:1 for fiat
      } else {
        const symbol = `${currency}USDT`;
        const price = assetPrices[symbol] || 0;
        usdValue = amount * price;
      }

      return { currency, amount, usdValue };
    });

    const totalUsd = holdingsWithUsd.reduce((sum, h) => sum + h.usdValue, 0);

    // Calculate percentages
    return holdingsWithUsd.map(h => ({
      currency: h.currency,
      amount: h.amount,
      usdValue: h.usdValue,
      percentage: totalUsd > 0 ? (h.usdValue / totalUsd) * 100 : 0,
    }));
  };

  const handleOpenCreateModal = (type: 'live' | 'demo') => {
    setActiveTab(type);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (account: Account) => {
    if (account.type !== 'demo') return;
    setAccountToEdit(account);
    setIsEditModalOpen(true);
  };

   const handleAccountCreated = (message: string) => {
    setIsCreateModalOpen(false);
    showToast(message, 'success');
  };

   const handleBalanceEdited = (message: string) => {
    setIsEditModalOpen(false);
    setAccountToEdit(null);
    showToast(message, 'success');
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return 'N/A';
    try { return new Date(timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return 'N/A'; }
  };

  // Color palette for chart segments
  const COLORS = [
    '#6366f1', // indigo
    '#10b981', // green
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
  ];

  // --- Micro Donut Chart Component ---
  type MicroDonutChartProps = {
    allocations: Array<{ currency: string; percentage: number }>;
    size?: number;
  };

  // eslint-disable-next-line react/prop-types
  const MicroDonutChart = ({ allocations, size = 80 }: MicroDonutChartProps) => {
    if (allocations.length === 0) return null;

    const strokeWidth = Math.floor(size / 4);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const centerX = size / 2;
    const centerY = size / 2;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {/* Base circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700"
        />

        {/* Colored segments */}
        {allocations.map((asset, index) => {
          const dashLength = (asset.percentage / 100) * circumference;
          const dashArray = `${dashLength} ${circumference}`;
          const prevPercentages = allocations.slice(0, index).reduce((sum, a) => sum + a.percentage, 0);
          const rotation = (prevPercentages / 100) * 360;

          return (
            <circle
              key={asset.currency}
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
            />
          );
        })}

        {/* Center text */}
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-sm font-bold fill-slate-700 dark:fill-slate-300 transform rotate-90"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {allocations.length}
        </text>
      </svg>
    );
  };

  // --- Render Thin Account Card (List View) ---
  const renderAccountCard = (acc: Account) => {
    const isDeactivated = acc.status === 'deactivated' || acc.status === 'suspended';
    const isExternal = acc.platformType === 'external';
    const isSelected = selectedAccountId === acc.id;
    const isActive = activeAccountId === acc.id;
    const allocations = calculateAllocations(acc);

    return (
      <div
        key={acc.id}
        onClick={() => setSelectedAccountId(acc.id)}
        className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
          isDeactivated ? 'opacity-60 grayscale' : ''
        } ${
          isSelected
            ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/50'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {acc.type === 'live' ? (
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                Live
              </span>
            ) : (
              <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                Demo
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active
              </span>
            )}
            {isExternal && (
              <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                External
              </span>
            )}
            {isDeactivated && (
              <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
                {acc.status}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">{acc.id}</p>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatBalance(acc.balances[acc.currency], acc.currency)}
            </p>
          </div>

          {/* Micro Chart - only for integrated accounts with holdings */}
          {/* eslint-disable-next-line react/prop-types */}
          {acc.platformType === 'integrated' && allocations.length > 0 && (
            <div className="flex-shrink-0">
              <MicroDonutChart allocations={allocations} size={80} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    // REMOVED ml-14 from this div
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header - Removed Back Button */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">My Accounts</h1>
      </div>
      <div className="lg:grid lg:grid-cols-5 lg:gap-8 space-y-8 lg:space-y-0">
        <div className="lg:col-span-3">
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
             <div className="border-b border-slate-200 dark:border-slate-700 px-5 md:px-6 lg:px-8 pt-3">
               <nav className="flex -mb-px space-x-8" aria-label="Tabs">
                 <button onClick={() => setActiveTab('live')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'live'? 'border-indigo-500 text-indigo-600 dark:text-indigo-400': 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}>Live Accounts ({liveAccounts.length})</button>
                 <button onClick={() => setActiveTab('demo')} className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'demo'? 'border-indigo-500 text-indigo-600 dark:text-indigo-400': 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}>Demo Accounts ({demoAccounts.length})</button>
               </nav>
             </div>
             <div className="p-5 md:p-6 lg:p-8">
                <div className="flex justify-end mb-6">
                    <button onClick={() => handleOpenCreateModal(activeTab)} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${activeTab === 'live'? 'bg-indigo-600 hover:bg-indigo-700 text-white': 'bg-green-600 hover:bg-green-700 text-white'}`}><PlusIcon /> Open New Account</button>
                </div>
                {activeTab === 'live' && (<div>{liveAccounts.length === 0 ? (<div className="text-center py-10 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/30"><p className="text-slate-500 dark:text-slate-400">You haven&apos;t opened any live accounts yet.</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-5">{liveAccounts.map(renderAccountCard)}</div>)}</div>)}
                {activeTab === 'demo' && (<div>{demoAccounts.length === 0 ? (<div className="text-center py-10 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/30"><p className="text-slate-500 dark:text-slate-400">You haven&apos;t opened any demo accounts yet.</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-5">{demoAccounts.map(renderAccountCard)}</div>)}</div>)}
             </div>
           </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm lg:sticky lg:top-[77px] h-fit max-h-[calc(100vh-100px)] overflow-y-auto">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">Account Details</h2>
                {selectedAccount ? (
                    <div className="space-y-4 text-sm">
                        {/* Account Information */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                             <div className="text-slate-500 dark:text-slate-400">Account ID:</div>
                             <div className="font-medium text-slate-700 dark:text-slate-300 truncate text-right">{selectedAccount.id}</div>

                             <div className="text-slate-500 dark:text-slate-400">Type:</div>
                             <div className="text-right">
                                <span className={`font-medium px-2 py-0.5 rounded text-[10px] ${selectedAccount.type === 'live' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'}`}>{selectedAccount.type.toUpperCase()}</span>
                             </div>

                            <div className="text-slate-500 dark:text-slate-400">Status:</div>
                            <div className="text-right">
                                <span className={`font-medium px-2 py-0.5 rounded text-[10px] ${selectedAccount.status === 'active' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'}`}>{selectedAccount.status.toUpperCase()}</span>
                            </div>

                            <div className="text-slate-500 dark:text-slate-400">Platform:</div>
                            <div className="font-medium text-slate-700 dark:text-slate-300 text-right">{selectedAccount.platform || 'N/A'}</div>

                            <div className="text-slate-500 dark:text-slate-400">Server:</div>
                            <div className="font-medium text-slate-700 dark:text-slate-300 text-right">{selectedAccount.server || 'N/A'}</div>

                            <div className="text-slate-500 dark:text-slate-400">Created On:</div>
                            <div className="font-medium text-slate-700 dark:text-slate-300 text-right">{formatDate(selectedAccount.createdAt)}</div>
                        </div>

                        {/* Balance */}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="text-slate-500 dark:text-slate-400 font-semibold mb-1">Balance ({selectedAccount.currency})</div>
                            <div className="font-semibold text-2xl text-slate-900 dark:text-slate-100">{formatBalance(selectedAccount.balances[selectedAccount.currency], selectedAccount.currency)}</div>
                        </div>

                        {/* Holdings (only for integrated accounts) */}
                        {selectedAccount.platformType === 'integrated' && (
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="text-slate-500 dark:text-slate-400 font-semibold mb-2">Holdings</div>
                                {Object.entries(selectedAccount.balances).filter(([k,v]) => k !== selectedAccount.currency && v > 0).length > 0 ? (
                                    <div className="space-y-1">
                                        {Object.entries(selectedAccount.balances).filter(([k,v]) => k !== selectedAccount.currency && v > 0).map(([k,v]) => (
                                            <div key={k} className="flex justify-between text-xs">
                                                <span className="text-slate-600 dark:text-slate-400">{k}</span>
                                                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">{v.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="italic text-xs text-slate-400 dark:text-slate-600">No other holdings</div>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            {/* Set Active Button - only for integrated, active accounts */}
                            {selectedAccount.platformType === 'integrated' && selectedAccount.status === 'active' && selectedAccount.id !== activeAccountId && (
                                <button
                                    onClick={() => setActiveAccount(selectedAccount.id)}
                                    className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors shadow-sm"
                                >
                                    Set as Active Account
                                </button>
                            )}

                            {/* Deposit Button */}
                            <button
                                onClick={() => navigateTo('wallet', 'deposit')}
                                className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={selectedAccount.status !== 'active'}
                                title={selectedAccount.status !== 'active' ? 'Account must be active' : 'Navigate to Deposit'}
                            >
                              <ArrowDownTrayIcon /> Deposit
                            </button>

                            {/* Withdraw Button */}
                            <button
                                onClick={() => navigateTo('wallet', 'withdraw')}
                                className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors border border-slate-200 dark:border-slate-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={selectedAccount.status !== 'active'}
                                title={selectedAccount.status !== 'active' ? 'Account must be active' : 'Navigate to Withdraw'}
                            >
                              <ArrowUpTrayIcon /> Withdraw
                            </button>

                            {/* Edit Balance Button - only for demo accounts */}
                            {selectedAccount.type === 'demo' && selectedAccount.status === 'active' && (
                                <button
                                    onClick={() => handleOpenEditModal(selectedAccount)}
                                    className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md transition-colors border border-indigo-200 dark:border-indigo-700"
                                >
                                  <PencilSquareIcon /> Edit Balance
                                </button>
                            )}

                            {/* Trade Button - only for external accounts */}
                            {selectedAccount.platformType === 'external' && (
                                <button
                                    onClick={() => showToast(`Trade on ${selectedAccount.platform} coming soon!`, 'success')}
                                    className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
                                >
                                  Trade on {selectedAccount.platform}
                                </button>
                            )}
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-4 mt-4 border-t-2 border-red-200 dark:border-red-900/50">
                            <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">Account Management</div>
                            {selectedAccount.status === 'active' ? (
                                <button
                                    onClick={() => toggleAccountStatus(selectedAccount.id)}
                                    className="w-full px-3 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={selectedAccount.id === activeAccountId}
                                    title={selectedAccount.id === activeAccountId ? 'Cannot deactivate the active trading account' : 'Deactivate this account'}
                                >
                                  Deactivate Account
                                </button>
                            ) : (
                                <button
                                    onClick={() => toggleAccountStatus(selectedAccount.id)}
                                    className="w-full px-3 py-2 text-xs font-medium bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md transition-colors border border-green-200 dark:border-green-800"
                                >
                                  Reactivate Account
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">Click on an account to view details.</p>
                )}
            </div>
        </div>
      </div>
      {/* --- Modals --- */}
      <OpenAccountModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} openAccount={openAccount} onAccountCreated={handleAccountCreated}/>
      <EditBalanceModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} account={accountToEdit} editDemoBalance={editDemoBalance} onBalanceEdited={handleBalanceEdited}/>
    </div>
  );
}

// Added React import needed for React.Fragment
import React from 'react';