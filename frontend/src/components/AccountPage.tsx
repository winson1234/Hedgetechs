import { useState, useMemo } from 'react';
import type { Account } from '../App';
import OpenAccountModal from './OpenAccountModal';
import EditBalanceModal from './EditBalanceModal';

// --- Icons ---
const PlusIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg> );
const PencilSquareIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg> );
const ArrowDownTrayIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> );
const ArrowUpTrayIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> );
const WalletIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline mr-1 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>);
// --- End Icons ---

type EditBalanceResult = { success: boolean; message?: string };

// FIX: Removed navigateTo from props definition
type AccountPageProps = {
  accounts: Account[];
  activeAccountId: string | null;
  setActiveAccount: (id: string) => void;
  openAccount: (type: 'live' | 'demo', currency: string, initialBalance?: number) => { success: boolean, message?: string };
  editDemoBalance: (accountId: string, newBalance: number) => EditBalanceResult;
  showToast: (message: string, type: 'success' | 'error') => void;
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
};

type AccountTab = 'live' | 'demo';

export default function AccountPage({
  accounts,
  activeAccountId,
  setActiveAccount,
  openAccount,
  // navigateTo, // Removed parameter destructuring
  editDemoBalance,
  showToast,
  formatBalance
}: AccountPageProps) {
  const [activeTab, setActiveTab] = useState<AccountTab>('live');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const liveAccounts = useMemo(() => accounts.filter(acc => acc.type === 'live'), [accounts]);
  const demoAccounts = useMemo(() => accounts.filter(acc => acc.type === 'demo'), [accounts]);
  const activeAccount = useMemo(() => accounts.find(acc => acc.id === activeAccountId), [accounts, activeAccountId]);

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

   const calculateTotalPortfolioValue = (type: 'live' | 'demo') => {
        const relevantAccounts = type === 'live' ? liveAccounts : demoAccounts;
        return relevantAccounts.reduce((sum, acc) => sum + (acc.balances[acc.currency] ?? 0), 0);
   };

  // --- Render Account Card ---
  const renderAccountCard = (acc: Account) => (
    <div
      key={acc.id}
      className={`relative p-5 rounded-xl border transition-all duration-150 ease-in-out shadow-sm group flex flex-col justify-between min-h-[270px] ${ activeAccountId === acc.id ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/30 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/50 dark:ring-indigo-500/70' : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700' }`}
    >
      <div> {/* Top section */}
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
                {acc.type === 'live' ? ( <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-wider">Live</span> )
                 : ( <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase tracking-wider">Demo</span> )}
               <p className={`text-sm font-semibold truncate ${activeAccountId === acc.id ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'}`}>{acc.id}</p>
            </div>
             {activeAccountId === acc.id && (<span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Active</span>)}
        </div>
        <p className={`text-3xl font-bold mb-4 ${activeAccountId === acc.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-slate-100'}`}>
          {formatBalance(acc.balances[acc.currency], acc.currency)}
        </p>
        <div className="border-t border-slate-200 dark:border-slate-700/80 pt-3 mt-3 text-xs space-y-1.5 text-slate-600 dark:text-slate-400 min-h-[5rem]">
           <span className="font-medium text-slate-500 dark:text-slate-500 block mb-1"><WalletIcon /> Holdings:</span>
           {Object.entries(acc.balances).filter(([k,v]) => k !== acc.currency && v > 0).slice(0, 4).map(([k,v]) => (<div key={k} className="flex justify-between items-center pl-4"><span>{k}</span><span className="font-mono tabular-nums">{v.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></div>))}
           {Object.entries(acc.balances).filter(([k,v]) => k !== acc.currency && v > 0).length === 0 && (<p className="italic text-slate-400 dark:text-slate-600 pl-4">No holdings</p>)}
        </div>
      </div> {/* End Top section */}
       <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80">
           <div className="flex justify-between items-center text-xs">
                 <span className="text-slate-500 dark:text-slate-500">Created: {formatDate(acc.createdAt)}</span>
                 {activeAccountId === acc.id ? (
                     <div className="flex items-center gap-2">
                        {acc.type === 'live' && (<><button className="flex items-center text-green-600 dark:text-green-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline" disabled title="Coming soon"><ArrowDownTrayIcon /> Deposit</button><button className="flex items-center text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline" disabled title="Coming soon"><ArrowUpTrayIcon /> Withdraw</button></>)}
                        {acc.type === 'demo' && (<button onClick={() => handleOpenEditModal(acc)} className="flex items-center text-indigo-600 dark:text-indigo-400 hover:underline"><PencilSquareIcon /> Edit Balance</button>)}
                     </div>
                 ) : ( <button onClick={() => setActiveAccount(acc.id)} className="px-3 py-1 font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors border border-slate-200 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Set Active</button> )}
           </div>
       </div>
    </div>
  );

  return (
    <div className="ml-14 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header - Removed Back Button */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">My Accounts</h1>
      </div>
      <div className="lg:grid lg:grid-cols-5 lg:gap-8 space-y-8 lg:space-y-0">
        <div className="lg:col-span-3 space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm">
                 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">Portfolio Overview</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                     <div className="p-4 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
                        <div className="flex justify-between items-center mb-1"><span className="font-medium text-slate-600 dark:text-slate-300">Total Live Value</span><span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase">Live</span></div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBalance(calculateTotalPortfolioValue('live'), 'USD')}</p>
                     </div>
                      <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50">
                        <div className="flex justify-between items-center mb-1"><span className="font-medium text-slate-600 dark:text-slate-300">Total Demo Value</span><span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase">Demo</span></div>
                         <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatBalance(calculateTotalPortfolioValue('demo'), 'USD')}</p>
                     </div>
                 </div>
            </div>
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm lg:sticky lg:top-[77px] h-fit">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">Active Account Details</h2>
                {activeAccount ? (
                    <div className="space-y-4 text-sm">
                         <div>
                            <label htmlFor="active-account-switcher-sidebar" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current Active Account</label>
                            <select id="active-account-switcher-sidebar" value={activeAccountId ?? ''} onChange={(e) => setActiveAccount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs">{!activeAccountId && <option value="" disabled>Select account</option>}{accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.id} ({acc.type === 'live' ? 'Live' : 'Demo'})</option>))}</select>
                         </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
                             <div className="text-slate-500 dark:text-slate-400">Account ID:</div><div className="font-medium text-slate-700 dark:text-slate-300 truncate text-right">{activeAccount.id}</div>
                             <div className="text-slate-500 dark:text-slate-400">Type:</div><div className="text-right"><span className={`font-medium px-2 py-0.5 rounded text-[10px] ${activeAccount.type === 'live' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'}`}>{activeAccount.type.toUpperCase()}</span></div>
                            <div className="text-slate-500 dark:text-slate-400">Base Currency:</div><div className="font-medium text-slate-700 dark:text-slate-300 text-right">{activeAccount.currency}</div>
                            <div className="text-slate-500 dark:text-slate-400 col-span-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 font-semibold">Balance ({activeAccount.currency}):</div><div className="font-semibold text-xl text-slate-900 dark:text-slate-100 col-span-2 text-right -mt-2 mb-2">{formatBalance(activeAccount.balances[activeAccount.currency], activeAccount.currency)}</div>
                            <div className="text-slate-500 dark:text-slate-400 col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 font-semibold">Holdings:</div>
                            {Object.entries(activeAccount.balances).filter(([k,v]) => k !== activeAccount.currency && v > 0).length > 0 ? ( Object.entries(activeAccount.balances).filter(([k,v]) => k !== activeAccount.currency && v > 0).map(([k,v]) => ( <React.Fragment key={k}><div className="text-xs text-slate-600 dark:text-slate-400 pl-2">{k}</div><div className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 text-right">{v.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div></React.Fragment> ))) : (<div className="col-span-2 italic text-xs text-slate-400 dark:text-slate-600 pl-2">No other holdings</div>)}
                            <div className="text-slate-500 dark:text-slate-400 col-span-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">Created On:</div><div className="font-medium text-slate-700 dark:text-slate-300 col-span-2 text-right -mt-2">{formatDate(activeAccount.createdAt)}</div>
                         </div>
                         <div className="pt-4 space-y-2">
                            {activeAccount.type === 'live' && (<><button className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Coming soon"><ArrowDownTrayIcon /> Deposit Funds</button><button className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors border border-slate-200 dark:border-slate-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Coming soon"><ArrowUpTrayIcon /> Withdraw Funds</button></>)}
                            {activeAccount.type === 'demo' && (<button onClick={() => handleOpenEditModal(activeAccount)} className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md transition-colors border border-indigo-200 dark:border-indigo-700"><PencilSquareIcon /> Edit Balance</button>)}
                         </div>
                    </div>
                ) : ( <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">Select an account to view details.</p> )}
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