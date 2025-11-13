import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveAccount, fetchAccounts } from '../store/slices/accountSlice';
import { createPendingOrder, executeMarketOrder, fetchOrders } from '../store/slices/orderSlice';
import { addToast } from '../store/slices/uiSlice';
import { formatPrice } from '../utils/priceUtils';

type TradingMode = 'spot' | 'cross' | 'isolated' | 'grid';
type OrderType = 'limit' | 'market' | 'stop-limit';

export default function TradingPanel() {
  // Access Redux store
  const dispatch = useAppDispatch();
  const activeInstrument = useAppSelector((state) => state.ui.activeInstrument);
  const { accounts, activeAccountId } = useAppSelector((state) => state.account);
  const { currentPrices } = useAppSelector((state) => state.price);

  // Get active account
  const activeAccount = accounts.find((acc) => acc.id === activeAccountId);

  // Get combined USD + USDT balance (treated as equivalent 1:1)
  const accountBalance = useMemo(() => {
    if (!activeAccount) return 0;
    const usdBal = activeAccount.balances.find((b) => b.currency === 'USD')?.amount || 0;
    const usdtBal = activeAccount.balances.find((b) => b.currency === 'USDT')?.amount || 0;
    return usdBal + usdtBal; // Combine USD + USDT
  }, [activeAccount]);

  const accountCurrency = 'USD'; // Display as USD (includes USDT)

  // Get crypto holdings from account balances
  const cryptoHoldings: Record<string, number> = useMemo(() => {
    if (!activeAccount) return {};
    const holdings: Record<string, number> = {};
    // Extract all non-USD/USDT balances as crypto holdings
    activeAccount.balances.forEach((balance) => {
      if (balance.currency !== 'USD' && balance.currency !== 'USDT') {
        holdings[balance.currency] = balance.amount;
      }
    });
    return holdings;
  }, [activeAccount]);

  // Use combined balance directly (USD + USDT are equivalent)
  const usdBalance = accountBalance;

  // Fetch orders from database when component mounts or account changes
  useEffect(() => {
    if (activeAccountId) {
      dispatch(fetchOrders({ accountId: activeAccountId }));
    }
  }, [activeAccountId, dispatch]);

  // Trading mode and settings
  const [tradingMode, setTradingMode] = useState<TradingMode>('spot');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [buyWithEUR, setBuyWithEUR] = useState<boolean>(false);
  const [enableTPSL, setEnableTPSL] = useState<boolean>(false);
  const feeLevel = 0.1; // 0.1% default fee

  // Price and order inputs
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [percentage, setPercentage] = useState<number>(0);

  // TP/SL inputs
  const [tpTrigger, setTpTrigger] = useState<string>('');
  const [tpLimit, setTpLimit] = useState<string>('');
  const [slTrigger, setSlTrigger] = useState<string>('');
  const [slLimit, setSlLimit] = useState<string>('');

  // Trading info
  const [lots, setLots] = useState<number>(0);
  const [margin, setMargin] = useState<number>(0);
  const [pipValue, setPipValue] = useState<number>(0);

  // Extract base and quote currencies from symbol (e.g., BTCUSDT -> BTC, USDT)
  const baseCurrency = activeInstrument.replace(/USDT?$/, '');
  const quoteCurrency = activeInstrument.match(/USDT?$/)?.[0] || 'USDT';

  // Get current holdings for the active instrument
  const currentHolding = cryptoHoldings[baseCurrency] || 0;

  // --- Start of Price Update Logic ---
  // Listen to Redux price updates for the active instrument
  useEffect(() => {
    const priceData = currentPrices[activeInstrument];
    if (priceData && priceData.price > 0) {
      // Update current price when price data changes
      setCurrentPrice(priceData.price);
      // TODO: Pending order processing should be handled in Redux middleware or App.tsx
      // processPendingOrders(activeInstrument, priceData.price);
    }
  }, [currentPrices, activeInstrument]);

  // --- End of Price Update Logic ---


  // Initialize limit price when instrument changes or when first price is received
  useEffect(() => {
    // Set limit price only if it's currently empty AND we have a valid current price
    if (currentPrice > 0 && limitPrice === '') {
      setLimitPrice(formatPrice(currentPrice));
    }
     // If current price becomes 0 (e.g., instrument change reset), clear limit price
     else if (currentPrice <= 0 && limitPrice !== '') {
        setLimitPrice('');
     }
    // Don't reset limitPrice automatically if currentPrice changes later, let user control it
  }, [currentPrice, limitPrice]);



  // Reset form ONLY when instrument changes
  useEffect(() => {
    // Reset ALL state including currentPrice
    setCurrentPrice(0);
    setLimitPrice(''); 
    setStopPrice('');
    setAmount('');
    setPercentage(0);
    setTpTrigger('');
    setTpLimit('');
    setSlTrigger('');
    setSlLimit('');
    // Reset toggles as well
    setIsRecurring(false);
    setBuyWithEUR(false);
    setEnableTPSL(false);
    // Note: Pending orders are managed by orderStore, no need to clear them here
  }, [activeInstrument]);


  // Calculate trading info (lots, margin, pip value)
  useEffect(() => {
    const qty = parseFloat(amount);

    // Determine the price to use for calculation
    let priceForCalc = currentPrice; // Default to current market price
    if (orderType === 'limit' || orderType === 'stop-limit') {
      const parsedLimitPrice = parseFloat(limitPrice);
      if (!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
        priceForCalc = parsedLimitPrice; // Use limit price if valid
      } else {
          // If limit price is invalid for limit/stop-limit, use current price as fallback for calculation
          priceForCalc = currentPrice > 0 ? currentPrice : 0;
      }
    }


    if (!isNaN(qty) && qty > 0 && !isNaN(priceForCalc) && priceForCalc > 0) {
      // Lots calculation (1 lot = 100,000 units in forex, for crypto we use direct amount)
      const calculatedLots = tradingMode === 'spot' ? qty : qty / 100000;
      setLots(calculatedLots);

      // Margin calculation (for leveraged trading)
      const leverage = tradingMode === 'spot' ? 1 : tradingMode === 'cross' ? 10 : 5; // Example leverage
      const totalValue = qty * priceForCalc;
      const calculatedMargin = totalValue / leverage;
      setMargin(calculatedMargin);

      // Pip value calculation (1 pip = 0.0001 for most pairs)
      // This might need adjustment based on the specific instrument's pip definition
      const pipSize = quoteCurrency === 'JPY' ? 0.01 : 0.0001; // Example adjustment for JPY pairs
      const calculatedPipValue = qty * pipSize;
      setPipValue(calculatedPipValue);
    } else {
      setLots(0);
      setMargin(0);
      setPipValue(0);
    }
  }, [amount, limitPrice, currentPrice, orderType, tradingMode, quoteCurrency]); // Added quoteCurrency

  // Calculate fee amount
  const getFeeAmount = useCallback((): number => {
    let priceForFee = currentPrice;
    if ((orderType === 'limit' || orderType === 'stop-limit') ) {
        const parsedLimitPrice = parseFloat(limitPrice);
        if(!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
            priceForFee = parsedLimitPrice;
        } else {
            // Use current price if limit price is invalid for limit/stop-limit
             priceForFee = currentPrice > 0 ? currentPrice : 0;
        }
    }
    const qty = parseFloat(amount);
    if (isNaN(priceForFee) || isNaN(qty) || priceForFee <= 0 || qty <= 0) {
      return 0;
    }
    return priceForFee * qty * (feeLevel / 100);
  }, [currentPrice, limitPrice, amount, orderType, feeLevel]);


  // Calculate total including fee
  const getTotal = useCallback((): string => {
    let priceForTotal = currentPrice;
     if ((orderType === 'limit' || orderType === 'stop-limit') ) {
        const parsedLimitPrice = parseFloat(limitPrice);
        if(!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
            priceForTotal = parsedLimitPrice;
        } else {
             // Use current price if limit price is invalid for limit/stop-limit
             priceForTotal = currentPrice > 0 ? currentPrice : 0;
        }
    }
    const qty = parseFloat(amount);
    if (isNaN(priceForTotal) || isNaN(qty) || priceForTotal <= 0 || qty <= 0) {
      return '0.00';
    }
    const total = priceForTotal * qty + getFeeAmount();
    return total.toFixed(2);
  }, [currentPrice, limitPrice, amount, orderType, getFeeAmount]);


  // Calculate max amount based on percentage (always for BUY using USD)
  const calculateAmountFromPercentage = (pct: number) => {
    // Determine the price to use for calculation
    let price = currentPrice;
    if ((orderType === 'limit' || orderType === 'stop-limit')) {
        const parsedLimitPrice = parseFloat(limitPrice);
        if (!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
            price = parsedLimitPrice;
        } else if (currentPrice <= 0) {
            // If limit price is invalid AND current price is invalid, cannot calculate
            console.warn('Cannot calculate percentage amount: Invalid price.');
            setAmount('0');
            setPercentage(pct);
            return;
        }
        // Fallback to current price if limit price is invalid but current price is valid
        else {
             price = currentPrice;
        }
    }
     // If price is still invalid (e.g., market order with no current price yet)
    if (isNaN(price) || price <= 0) {
      console.warn('Invalid price for percentage calculation:', price);
      setAmount('0'); // Set amount to 0 if price is invalid
      setPercentage(pct);
      return;
    }

    // Always calculate BUY amount based on USD balance percentage
    const usdToSpend = usdBalance * (pct / 100);
    // Estimate fee and subtract it before calculating amount
    const effectivePrice = price * (1 + feeLevel / 100);
     // Avoid division by zero if effectivePrice is somehow zero
    const calculatedAmount = effectivePrice > 0 ? usdToSpend / effectivePrice : 0;

    // Ensure amount is not negative and format
    setAmount(Math.max(0, calculatedAmount).toFixed(6));
    setPercentage(pct);
  };


  // Handle amount input change
  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Reset percentage slider when manually typing
    setPercentage(0);
  };

  // Handle order submission
  const handleOrder = async (side: 'buy' | 'sell') => {
    // Use currentPrice for market orders, limitPrice for limit/stop-limit
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice);
    const qty = parseFloat(amount);

    // Basic Validations
    if (isNaN(qty) || qty <= 0) {
      console.error('Invalid amount entered.'); // Log error instead of alert
      return;
    }
    // Price validation only needed for non-market orders
    if (orderType !== 'market' && (isNaN(price) || price <= 0)) {
      console.error(`Invalid ${orderType === 'stop-limit' ? 'limit ' : ''}price entered.`); // Log error instead of alert
      return;
    }
    // Stop price validation for stop-limit orders
    const stopPriceNum = parseFloat(stopPrice);
    if (orderType === 'stop-limit' && (isNaN(stopPriceNum) || stopPriceNum <= 0)) {
        console.error('Invalid stop price entered.'); // Log error instead of alert
        return;
    }
    // Additional validation for stop-limit: stop price vs current price
    if (orderType === 'stop-limit') {
        // Ensure currentPrice is valid before comparing
         if (isNaN(currentPrice) || currentPrice <= 0) {
            console.error("Cannot validate stop price: Current market price is unknown.");
            return;
         }
        // Allow stop price to be equal for triggering immediately if needed
        if (side === 'buy' && stopPriceNum < currentPrice) {
            console.error('Buy Stop price must be at or above the current market price.'); // Log error
            return;
        }
        if (side === 'sell' && stopPriceNum > currentPrice) {
            console.error('Sell Stop price must be at or below the current market price.'); // Log error
            return;
        }
    }


    // For limit and stop-limit orders, add to pending orders via orderStore
    if (orderType === 'limit' || orderType === 'stop-limit') {
      if (!activeAccountId) {
        console.error('No active account selected');
        return;
      }

      // Dispatch createPendingOrder thunk
      dispatch(createPendingOrder({
        account_id: activeAccountId,
        type: orderType === 'stop-limit' ? 'stop_limit' : 'limit',
        side,
        symbol: activeInstrument,
        quantity: qty,
        trigger_price: orderType === 'stop-limit' ? stopPriceNum : price,
        limit_price: price,
      }))
        .unwrap()
        .then(() => {
          console.log('Pending order placed successfully');
          // Show success toast
          dispatch(addToast({
            type: 'success',
            message: `${orderType === 'stop-limit' ? 'Stop-limit' : 'Limit'} order placed successfully`,
            duration: 5000,
          }));
        })
        .catch((error) => {
          console.error('Failed to place pending order:', error);
          // Show error toast
          dispatch(addToast({
            type: 'error',
            message: `Failed to place order: ${error}`,
            duration: 5000,
          }));
        });
    } else {
      // Market orders - Execute immediately
      if (isNaN(currentPrice) || currentPrice <= 0) {
        console.error("Cannot execute market order: Invalid current price.");
        dispatch(addToast({
          type: 'error',
          message: 'Cannot execute market order: Invalid current price',
          duration: 5000,
        }));
        return;
      }

      if (!activeAccountId) {
        console.error('No active account selected');
        dispatch(addToast({
          type: 'error',
          message: 'No active account selected',
          duration: 5000,
        }));
        return;
      }

      // Execute market order via backend
      dispatch(executeMarketOrder({
        account_id: activeAccountId,
        symbol: activeInstrument,
        side,
        amount_base: qty,
        current_price: currentPrice,
      }))
        .unwrap()
        .then(() => {
          // Show success toast
          dispatch(addToast({
            type: 'success',
            message: `Market ${side} order executed successfully`,
            duration: 5000,
          }));

          // Refresh account balances
          dispatch(fetchAccounts());

          // Refresh order history
          if (activeAccountId) {
            dispatch(fetchOrders(activeAccountId));
          }
        })
        .catch((error) => {
          // Show error toast
          console.error('Failed to execute market order:', error);
          dispatch(addToast({
            type: 'error',
            message: `Failed to execute order: ${error}`,
            duration: 5000,
          }));
        });
    }

    // Create TP/SL orders if enabled (applies to all order types)
    if (enableTPSL && activeAccountId) {
        const tpTriggerNum = parseFloat(tpTrigger);
        const tpLimitNum = parseFloat(tpLimit);
        const slTriggerNum = parseFloat(slTrigger);
        const slLimitNum = parseFloat(slLimit);

        // Validate TP/SL prices with directional checks
        let hasValidTP = !isNaN(tpTriggerNum) && tpTriggerNum > 0 && !isNaN(tpLimitNum) && tpLimitNum > 0;
        let hasValidSL = !isNaN(slTriggerNum) && slTriggerNum > 0 && !isNaN(slLimitNum) && slLimitNum > 0;

        // Additional validation: ensure TP is favorable and SL is unfavorable
        if (hasValidTP) {
          if (side === 'buy' && tpTriggerNum <= currentPrice) {
            console.error('TP trigger must be above entry price for buy orders');
            hasValidTP = false;
          } else if (side === 'sell' && tpTriggerNum >= currentPrice) {
            console.error('TP trigger must be below entry price for sell orders');
            hasValidTP = false;
          }
        }

        if (hasValidSL) {
          if (side === 'buy' && slTriggerNum >= currentPrice) {
            console.error('SL trigger must be below entry price for buy orders');
            hasValidSL = false;
          } else if (side === 'sell' && slTriggerNum <= currentPrice) {
            console.error('SL trigger must be above entry price for sell orders');
            hasValidSL = false;
          }
        }

        // Create TP order (stop-limit order in opposite direction)
        if (hasValidTP) {
          dispatch(createPendingOrder({
            account_id: activeAccountId,
            type: 'stop_limit',
            side: side === 'buy' ? 'sell' : 'buy', // Opposite side to close position
            symbol: activeInstrument,
            quantity: qty,
            trigger_price: tpTriggerNum,
            limit_price: tpLimitNum,
          }));
        }

        // Create SL order (stop-limit order in opposite direction)
        if (hasValidSL) {
          dispatch(createPendingOrder({
            account_id: activeAccountId,
            type: 'stop_limit',
            side: side === 'buy' ? 'sell' : 'buy', // Opposite side to close position
            symbol: activeInstrument,
            quantity: qty,
            trigger_price: slTriggerNum,
            limit_price: slLimitNum,
          }));
        }
      }

    // Reset form after placing order
    setAmount('');
    setPercentage(0);
    // Reset limit price to current price for convenience, keep stop price as is
    setLimitPrice(currentPrice > 0 ? formatPrice(currentPrice) : '');
    // setStopPrice(''); // User might want to reuse stop price
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-full flex flex-col">
      {/* Header with Fee Level */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Trading</h3>

        {/* Fee Level */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium">% Fee Level</span>
          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">
            {feeLevel}%
          </span>
        </div>
      </div>

      {/* Trading Mode Tabs */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1.5">
        {(['spot', 'cross', 'isolated', 'grid'] as TradingMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setTradingMode(mode)}
            className={`flex-1 px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition capitalize ${
              tradingMode === mode
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                // Apply subtle styling for non-spot modes instead of disabling
                : mode !== 'spot'
                ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed' // Less prominent text, not-allowed cursor
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200' // Normal hover for spot
            }`}
            // Add disabled attribute only if interaction should truly be blocked
             disabled={mode !== 'spot'}
            title={mode !== 'spot' ? 'Coming soon' : ''}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Order Type Tabs */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1.5">
        {/* ... Limit, Market, Stop-Limit buttons ... */}
         <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
            orderType === 'limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
            orderType === 'market'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('stop-limit')}
          className={`flex-1 px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
            orderType === 'stop-limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Stop-Limit
        </button>
      </div>

      {/* Recurring and Buy with EUR Toggles */}
      {/* Keep these clickable but indicate they are placeholders */}
      <div className="flex items-center justify-between mb-5 text-sm">
        <label className="flex items-center gap-2.5 cursor-pointer" title="Recurring Order (Coming soon)">
          <div className="relative">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => { setIsRecurring(e.target.checked);}}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
          </div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">Recurring</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer" title="Buy with EUR (Coming soon)">
          <div className="relative">
            <input
              type="checkbox"
              checked={buyWithEUR}
              onChange={(e) => { setBuyWithEUR(e.target.checked);}}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
          </div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">Buy with EUR</span>
        </label>
      </div>

      {/* Available Balance Breakdown */}
       <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-shrink-0">Available Balance</div>
          {/* Account Switcher */}
          <select
            value={activeAccountId || ''}
            onChange={(e) => dispatch(setActiveAccount(e.target.value))}
            className="max-w-[140px] min-w-0 px-1.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={`Account ${accounts.find((acc) => acc.id === activeAccountId)?.account_number}`}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_number} ({account.type === 'live' ? 'LIVE' : 'DEMO'})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">
              {accountCurrency} Balance:
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {accountCurrency}
            </span>
          </div>
          {accountCurrency !== 'USD' && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-500">≈ USD Equivalent:</span>
              <span className="text-slate-600 dark:text-slate-400">
                {usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{baseCurrency} Holdings:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {currentHolding.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {baseCurrency}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Approx Value:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {(usdBalance + currentHolding * (currentPrice > 0 ? currentPrice : 0)).toLocaleString('en-US', { // Use 0 if currentPrice is not yet set
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USD
            </span>
          </div>
        </div>
      </div>


      {/* Order Form */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1"> {/* Added pr-1 for scrollbar */}
        {/* Stop Price (only for stop-limit) */}
         {orderType === 'stop-limit' && (
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Stop Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder={currentPrice > 0 ? formatPrice(currentPrice) : '0.00'}
                min="0" step="any"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}


        {/* Price (not shown for market orders) */}
        {orderType !== 'market' && (
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              {orderType === 'stop-limit' ? 'Limit Price' : 'Price'}
            </label>
            <div className="relative">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice > 0 ? formatPrice(currentPrice) : '0.00'}
                 min="0" step="any"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.0000"
              min="0" // Ensure non-negative input
              step="any" // Allow decimals
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
            <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{baseCurrency}</span>
          </div>
        </div>

        <div>
             <div className="flex gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                <button
                    key={`buy-pct-${pct}`} // Renamed key
                    onClick={() => calculateAmountFromPercentage(pct)} // Simplified onClick
                    className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition ${
                     // Simpler styling check based only on percentage
                     percentage === pct
                        ? 'bg-blue-500 text-white shadow-sm' // Use a neutral color like blue
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    disabled={usdBalance <= 0} // Disable if no USD balance
                >
                    {pct}%
                </button>
                ))}
            </div>
        </div>


        {/* TP/SL Toggle */}
        {/* Make this clickable but indicate placeholder */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <label className="flex items-center justify-between cursor-pointer" title="TP/SL (Coming soon)">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">TP/SL</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={enableTPSL}
                onChange={(e) => { setEnableTPSL(e.target.checked); }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-5"></div>
            </div>
          </label>
        </div>


        {/* TP/SL Advanced Options (Conditional Rendering) */}
         {enableTPSL && (
          <div className="space-y-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            {/* Take Profit */}
            <div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">Take Profit</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">TP Trigger</label>
                  <input
                    type="number" value={tpTrigger} onChange={(e) => setTpTrigger(e.target.value)} placeholder="0.00" min="0" step="any"
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">TP Limit</label>
                  <input
                    type="number" value={tpLimit} onChange={(e) => setTpLimit(e.target.value)} placeholder="0.00" min="0" step="any"
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                   />
                </div>
              </div>
            </div>
             {/* Stop Loss */}
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Stop Loss</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">SL Trigger</label>
                  <input
                     type="number" value={slTrigger} onChange={(e) => setSlTrigger(e.target.value)} placeholder="0.00" min="0" step="any"
                     className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                   />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">SL Limit</label>
                  <input
                     type="number" value={slLimit} onChange={(e) => setSlLimit(e.target.value)} placeholder="0.00" min="0" step="any"
                     className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                   />
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Total & Fee */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
           <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Fee ({feeLevel}%)</span>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {getFeeAmount().toFixed(2)} <span className="text-xs text-slate-500 dark:text-slate-400">{quoteCurrency}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total (incl. fee)</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {getTotal()} <span className="text-sm text-slate-500 dark:text-slate-400">{quoteCurrency}</span>
            </span>
          </div>
        </div>

        {/* Trading Info Block - Lots, Margin, Pip Value */}
        <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg border border-blue-200 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Lots</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {lots.toFixed(tradingMode === 'spot' ? 6 : 2)} {/* More precision for spot */}
              </div>
            </div>
            <div className="text-center border-x border-blue-200 dark:border-slate-700">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Margin</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                 {tradingMode === 'spot' ? 'N/A' : `$${margin.toFixed(2)}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Pip Value</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                 {tradingMode === 'spot' ? 'N/A' : `$${pipValue.toFixed(4)}`}
              </div>
            </div>
          </div>
        </div>


        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
           <button
            onClick={() => handleOrder('buy')}
            className="px-4 py-3 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            // Disable buy if not enough USD balance OR amount is zero/invalid
            disabled={
                parseFloat(amount || '0') <= 0 || // Amount must be positive
                (orderType === 'market' && (isNaN(currentPrice) || currentPrice <= 0)) || // Need valid price for market
                (orderType !== 'market' && (parseFloat(getTotal() || 'Infinity') > usdBalance)) // Check total against balance for limit/stop
            }
          >
            Buy {baseCurrency}
          </button>
          <button
            onClick={() => handleOrder('sell')}
            className="px-4 py-3 text-base font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
             // Disable sell if amount entered is greater than current holding or amount is zero/invalid
             // Also disable if price is needed but invalid (for limit/stop-limit)
            disabled={
                parseFloat(amount || '0') <= 0 || // Amount must be positive
                parseFloat(amount || '0') > currentHolding || // Cannot sell more than held
                (orderType === 'market' && (isNaN(currentPrice) || currentPrice <= 0)) || // Need valid price for market
                ((orderType === 'limit' || orderType === 'stop-limit') && (isNaN(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0)) // Need valid limit price
            }
          >
            Sell {baseCurrency}
          </button>
        </div>
      </div>
    </div>
  );
}
