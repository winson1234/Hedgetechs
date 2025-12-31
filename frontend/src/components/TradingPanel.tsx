import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveAccount, fetchAccounts, updateAccountBalanceOptimistic } from '../store/slices/accountSlice';
import { createPendingOrder, executeMarketOrder, fetchOrders, fetchPendingOrders } from '../store/slices/orderSlice';
import { addToast, /* setSelectedProductType, */ triggerPositionsRefresh, setActiveMarketTab } from '../store/slices/uiSlice';
import { formatPrice } from '../utils/priceUtils';
import { formatAccountId } from '../utils/formatters';
// import { ProductType } from '../types'; // Commented out - not used when CFD is disabled

type OrderType = 'limit' | 'market' | 'stop-limit';

export default function TradingPanel() {
  // Access Redux store
  const dispatch = useAppDispatch();
  const activeInstrument = useAppSelector((state) => state.ui.activeInstrument);
  const selectedProductType = useAppSelector((state) => state.ui.selectedProductType);
  const { accounts, activeAccountId } = useAppSelector((state) => state.account);
  const { currentPrices } = useAppSelector((state) => state.price);
  const { isPlacingOrder } = useAppSelector((state) => state.order);

  // Get active account
  const activeAccount = accounts.find((acc) => acc.id === activeAccountId);

  // Get combined USD + USDT balance (treated as equivalent 1:1)
  const accountBalance = useMemo(() => {
    if (!activeAccount || !activeAccount.balances) return 0;
    const usdBal = activeAccount.balances.find((b) => b.currency === 'USD')?.amount || 0;
    const usdtBal = activeAccount.balances.find((b) => b.currency === 'USDT')?.amount || 0;
    return usdBal + usdtBal; // Combine USD + USDT
  }, [activeAccount]);

  const accountCurrency = 'USD'; // Display as USD (includes USDT)

  // Get crypto holdings from account balances
  const cryptoHoldings: Record<string, number> = useMemo(() => {
    if (!activeAccount || !activeAccount.balances) return {};
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
      dispatch(fetchOrders(activeAccountId));
      dispatch(fetchPendingOrders(activeAccountId));
    }
  }, [activeAccountId, dispatch]);

  // Trading settings
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [enableTPSL, setEnableTPSL] = useState<boolean>(false);
  const feeLevel = 0.1; // 0.1% default fee

  // Leverage state (for CFD/Futures)
  const [leverage, setLeverage] = useState<number>(1);

  // Derive trading mode from selected product type
  const isCFD = selectedProductType === 'cfd' || selectedProductType === 'futures';
  const isSpot = selectedProductType === 'spot';

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
    // This runs when currentPrice updates (on mount or instrument change)
    // By excluding limitPrice from dependencies, we allow users to clear the field without it auto-resetting
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
      // Lots calculation
      // For crypto: 1 lot = the actual quantity (e.g., 0.1 BTC = 0.1 lots)
      // For forex: 1 lot = 100,000 units
      const isForex = baseCurrency.length === 6; // Forex pairs like EURUSD
      const calculatedLots = isForex ? qty / 100000 : qty;
      setLots(calculatedLots);

      // Margin calculation (for leveraged trading)
      const totalValue = qty * priceForCalc;
      const calculatedMargin = isCFD ? totalValue / leverage : totalValue; // CFD uses leverage, Spot doesn't
      setMargin(calculatedMargin);

      // Pip value calculation
      // For crypto: pip value = (lot size × $1 per point) - represents the value of a $1 price movement
      // For forex: pip value = (lot size × pip size) / exchange rate
      let calculatedPipValue: number;
      if (isForex) {
        const pipSize = quoteCurrency === 'JPY' ? 0.01 : 0.0001;
        calculatedPipValue = calculatedLots * 100000 * pipSize;
      } else {
        // For crypto: pip value represents value of $1 price change per lot
        calculatedPipValue = qty; // Each $1 price change = qty × $1
      }
      setPipValue(calculatedPipValue);
    } else {
      setLots(0);
      setMargin(0);
      setPipValue(0);
    }
  }, [amount, limitPrice, currentPrice, orderType, leverage, isCFD, isSpot, quoteCurrency, baseCurrency]);

  // Calculate fee amount
  const getFeeAmount = useCallback((): number => {
    let priceForFee = currentPrice;
    if ((orderType === 'limit' || orderType === 'stop-limit')) {
      const parsedLimitPrice = parseFloat(limitPrice);
      if (!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
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
    if ((orderType === 'limit' || orderType === 'stop-limit')) {
      const parsedLimitPrice = parseFloat(limitPrice);
      if (!isNaN(parsedLimitPrice) && parsedLimitPrice > 0) {
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
        leverage: isCFD ? leverage : 1, // Pass leverage for CFD/Futures
        product_type: selectedProductType, // NEW: Pass product type at order level
      }))
        .unwrap()
        .then(() => {
          console.log('Pending order placed successfully');
          // Show success toast with detailed information
          const orderTypeText = orderType === 'stop-limit' ? 'Stop-Limit' : 'Limit';
          const triggerPriceText = orderType === 'stop-limit' ? `stop at $${stopPrice}` : `at $${limitPrice}`;
          const orderDetails = isCFD
            ? `${orderTypeText} ${side.toUpperCase()}: ${qty.toFixed(8)} ${baseCurrency} ${triggerPriceText} (${leverage}x leverage)`
            : `${orderTypeText} ${side.toUpperCase()}: ${qty.toFixed(8)} ${baseCurrency} ${triggerPriceText}`;

          dispatch(addToast({
            type: 'success',
            message: `✓ Order Placed - ${orderDetails}`,
            duration: 7000,
          }));

          // Navigate to positions tab after successful order (for CFD)
          if (isCFD) {
            dispatch(setActiveMarketTab('positions'));
          }

          // Reset input fields after successful order
          setAmount('');
          setLimitPrice('');
          setStopPrice('');
          setPercentage(0);
        })
        .catch((error) => {
          console.error('Failed to place pending order:', error);
          // Show error toast
          dispatch(addToast({
            type: 'error',
            message: `✗ Order Failed - ${error}`,
            duration: 7000,
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

      // Calculate balance delta for optimistic update
      let balanceDelta = 0;
      if (isSpot) {
        // SPOT: Full order value affects balance
        const orderValue = qty * currentPrice;
        balanceDelta = side === 'buy' ? -orderValue : orderValue;
      } else {
        // CFD/Futures: Only margin affects balance
        const margin = (qty * currentPrice) / leverage;
        balanceDelta = -margin; // Margin is locked (deducted) for both buy and sell
      }

      // Optimistic update: Update UI immediately for instant feedback
      dispatch(updateAccountBalanceOptimistic({
        accountId: activeAccountId,
        balanceDelta: balanceDelta,
      }));

      // Execute market order via backend
      dispatch(executeMarketOrder({
        account_id: activeAccountId,
        symbol: activeInstrument,
        side,
        amount_base: qty,
        current_price: currentPrice,
        leverage: isCFD ? leverage : 1, // Pass leverage for CFD/Futures
        product_type: selectedProductType, // NEW: Pass product type at order level
      }))
        .unwrap()
        .then(() => {
          // Show success toast with detailed information
          const orderDetails = isCFD
            ? `${selectedProductType.toUpperCase()} ${side.toUpperCase()}: ${qty.toFixed(8)} ${baseCurrency} at $${currentPrice.toFixed(2)} (${leverage}x leverage)`
            : `${selectedProductType.toUpperCase()} ${side.toUpperCase()}: ${qty.toFixed(8)} ${baseCurrency} at $${currentPrice.toFixed(2)}`;

          dispatch(addToast({
            type: 'success',
            message: `✓ Order Executed - ${orderDetails}`,
            duration: 7000, // Longer duration for better visibility
          }));

          // Refresh account balances
          dispatch(fetchAccounts());

          // Refresh order history
          if (activeAccountId) {
            dispatch(fetchOrders(activeAccountId));
          }

          // Trigger positions refresh (for CFD orders)
          dispatch(triggerPositionsRefresh());

          // Navigate to positions tab after successful order
          if (isCFD) {
            dispatch(setActiveMarketTab('positions'));
          }

          // Reset input fields after successful order
          setAmount('');
          setPercentage(0);
        })
        .catch((error) => {
          // Revert optimistic balance update on error
          dispatch(updateAccountBalanceOptimistic({
            accountId: activeAccountId,
            balanceDelta: -balanceDelta, // Revert by negating the delta
          }));

          // Show error toast with details
          console.error('Failed to execute market order:', error);
          dispatch(addToast({
            type: 'error',
            message: `✗ Order Failed - ${error}`,
            duration: 7000,
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
          leverage: isCFD ? leverage : 1,
          product_type: selectedProductType,
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
          leverage: isCFD ? leverage : 1,
          product_type: selectedProductType,
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

  // Handle Hedge Order (Both Buy and Sell)
  const handleHedgeOrder = async () => {
    const price = currentPrice;
    const qty = parseFloat(amount);

    // Basic Validations
    if (isNaN(qty) || qty <= 0) {
      console.error('Invalid amount entered.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      console.error('Invalid current price.');
      dispatch(addToast({
        type: 'error',
        message: 'Cannot execute hedge order: Invalid current price',
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

    // Optimistic update: Deduct margin for both legs
    const marginPerLeg = (qty * price) / leverage;
    const totalMargin = marginPerLeg * 2;

    dispatch(updateAccountBalanceOptimistic({
      accountId: activeAccountId,
      balanceDelta: -totalMargin,
    }));

    try {
      // Generate pair ID for linking hedged positions
      const pairId = self.crypto.randomUUID();

      // Execute both Buy and Sell orders in parallel
      const buyPromise = dispatch(executeMarketOrder({
        account_id: activeAccountId,
        symbol: activeInstrument,
        side: 'buy',
        amount_base: qty,
        current_price: currentPrice,
        leverage: leverage,
        product_type: selectedProductType,
        pair_id: pairId,
      })).unwrap();

      const sellPromise = dispatch(executeMarketOrder({
        account_id: activeAccountId,
        symbol: activeInstrument,
        side: 'sell',
        amount_base: qty,
        current_price: currentPrice,
        leverage: leverage,
        product_type: selectedProductType,
        pair_id: pairId,
      })).unwrap();

      await Promise.all([buyPromise, sellPromise]);

      // Success
      const orderDetails = `${selectedProductType.toUpperCase()} HEDGE: ${qty.toFixed(8)} ${baseCurrency} at ~$${currentPrice.toFixed(2)} (${leverage}x)`;

      dispatch(addToast({
        type: 'success',
        message: `✓ Hedge Executed - ${orderDetails}`,
        duration: 7000,
      }));

      // Refresh data
      dispatch(fetchAccounts());
      dispatch(fetchOrders(activeAccountId));
      dispatch(triggerPositionsRefresh());
      dispatch(setActiveMarketTab('positions'));

      // Reset form
      setAmount('');
      setPercentage(0);
      setLimitPrice(currentPrice > 0 ? formatPrice(currentPrice) : '');

    } catch (error) {
      // Revert optimistic update
      dispatch(updateAccountBalanceOptimistic({
        accountId: activeAccountId,
        balanceDelta: totalMargin,
      }));

      console.error('Failed to execute hedge order:', error);
      dispatch(addToast({
        type: 'error',
        message: `✗ Hedge Failed - ${error}`,
        duration: 7000,
      }));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 h-full flex flex-col">
      {/* Header with Fee Level */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Trading</h3>

        {/* Fee Level */}
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">Fee</span>
          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">
            {feeLevel}%
          </span>
        </div>
      </div>

      {/* NEW: Product Type Selector (Universal Accounts) - DISABLED */}
      {/* <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Product Type
        </label>
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-1.5">
          {(['spot', 'cfd', 'futures'] as ProductType[]).map((product) => (
            <button
              key={product}
              onClick={() => dispatch(setSelectedProductType(product))}
              disabled={product === 'futures'}
              className={`flex-1 px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition uppercase ${
                selectedProductType === product
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : product === 'futures'
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={product === 'futures' ? 'Coming soon' : ''}
            >
              {product}
            </button>
          ))}
        </div>
        {selectedProductType !== 'spot' && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⚠ Hedged Position: Opens both Long and Short positions simultaneously
          </p>
        )}
      </div> */}

      {/* Order Type Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 bg-white dark:bg-slate-900">
        {/* ... Limit, Market, Stop-Limit buttons ... */}
        <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition ${orderType === 'limit'
            ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition ${orderType === 'market'
            ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('stop-limit')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition ${orderType === 'stop-limit'
            ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
        >
          Stop-Limit
        </button>
      </div>

      {/* Available Balance Breakdown */}
      <div className="mb-4 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">Available Balance</div>
          {/* Account Switcher */}
          <select
            value={activeAccountId || ''}
            onChange={(e) => dispatch(setActiveAccount(e.target.value))}
            className="max-w-[140px] min-w-0 px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-[#00C0A2]"
            title={`Account ${formatAccountId(accounts.find((acc) => acc.id === activeAccountId)?.account_id, accounts.find((acc) => acc.id === activeAccountId)?.type)}`}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatAccountId(account.account_id, account.type)} ({account.type === 'live' ? 'LIVE' : 'DEMO'})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 text-xs">
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
          {isSpot && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">{baseCurrency} Holdings:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {currentHolding.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {baseCurrency}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Approx Value:</span>
                <span className="font-bold text-[#00C0A2] dark:text-[#00C0A2]">
                  {(usdBalance + currentHolding * (currentPrice > 0 ? currentPrice : 0)).toLocaleString('en-US', { // Use 0 if currentPrice is not yet set
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  USD
                </span>
              </div>
            </>
          )}
          {isCFD && (
            <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">Total Balance:</span>
              <span className="font-bold text-green-600 dark:text-green-400">
                {accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {accountCurrency}
              </span>
            </div>
          )}
        </div>
      </div>


      {/* Order Form */}
      <div className="flex-1 flex flex-col gap-3 px-4 overflow-y-auto"> {/* Added pr-1 for scrollbar */}
        {/* Stop Price (only for stop-limit) */}
        {orderType === 'stop-limit' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Stop Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder={currentPrice > 0 ? formatPrice(currentPrice) : '0.00'}
                min="0" step="any"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-[#00C0A2] text-slate-900 dark:text-slate-100"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}


        {/* Price (not shown for market orders) */}
        {orderType !== 'market' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {orderType === 'stop-limit' ? 'Limit Price' : 'Price'}
            </label>
            <div className="relative">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice > 0 ? formatPrice(currentPrice) : '0.00'}
                min="0" step="any"
                className="
                w-full px-3 py-2 text-sm
                bg-white dark:bg-slate-800
                border border-slate-300 dark:border-slate-700
                rounded
                focus:outline-none focus:ring-1 focus:ring-[#00C0A2] focus:border-[#00C0A2]
                text-slate-900 dark:text-slate-100
              "
              />

              <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-[#00C0A2] text-slate-900 dark:text-slate-100"
            />
            <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">{baseCurrency}</span>
          </div>
        </div>

        <div>
          <div className="flex gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={`buy-pct-${pct}`} // Renamed key
                onClick={() => calculateAmountFromPercentage(pct)} // Simplified onClick
                className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition ${
                  // Simpler styling check based only on percentage
                  percentage === pct
                    ? 'bg-[#00C0A2] hover:bg-[#00a085] text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                  }`}
                disabled={usdBalance <= 0} // Disable if no USD balance
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Selector (only for CFD accounts) */}
        {isCFD && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Leverage
            </label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded 
              bg-white text-slate-900 border border-slate-300 
              focus:outline-none focus:ring-1 focus:ring-[#00C0A2] focus:border-[#00C0A2]
              
              dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
            >
              <option value="1">1x (No Leverage)</option>
              <option value="5">5x</option>
              <option value="10">10x</option>
              <option value="20">20x</option>
              <option value="50">50x</option>
              <option value="100">100x</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              Margin Required: {formatPrice(margin)} {accountCurrency}
            </p>
          </div>
        )}


        {/* TP/SL Toggle */}
        {/* Make this clickable but indicate placeholder */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <label
            className="flex items-center justify-between cursor-pointer"
            title="TP/SL (Coming soon)"
          >
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              TP/SL
            </span>

            <div className="relative">
              <input
                type="checkbox"
                checked={enableTPSL}
                onChange={(e) => setEnableTPSL(e.target.checked)}
                className="sr-only peer"
              />

              {/* Track */}
              <div className="
        w-11 h-6 rounded-full transition
        bg-slate-300 peer-checked:bg-[#00C0A2]
        dark:bg-slate-700 dark:peer-checked:bg-[#00C0A2]
      "></div>

              {/* Thumb */}
              <div className="
        absolute left-0.5 top-0.5 w-5 h-5 rounded-full transition
        bg-white peer-checked:translate-x-5
        shadow
      "></div>
            </div>
          </label>
        </div>



        {/* TP/SL Advanced Options (Conditional Rendering) */}
        {enableTPSL && (
          <div className="space-y-3 p-2.5 rounded border
    bg-slate-100 border-slate-300
    dark:bg-slate-800/50 dark:border-slate-700
  ">
            {/* Take Profit */}
            <div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                Take Profit
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-slate-600 dark:text-slate-400">
                    TP Trigger
                  </label>
                  <input
                    type="number"
                    value={tpTrigger}
                    onChange={(e) => setTpTrigger(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full px-2 py-1.5 text-xs rounded
              bg-white text-slate-900 border border-slate-300
              focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500
              dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700
            "
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-xs mb-1 text-slate-600 dark:text-slate-400">
                    TP Limit
                  </label>
                  <input
                    type="number"
                    value={tpLimit}
                    onChange={(e) => setTpLimit(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full px-2 py-1.5 text-xs rounded
              bg-white text-slate-900 border border-slate-300
              focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500
              dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700
            "
                  />
                </div>
              </div>
            </div>

            {/* Stop Loss */}
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                Stop Loss
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs mb-1 text-slate-600 dark:text-slate-400">
                    SL Trigger
                  </label>
                  <input
                    type="number"
                    value={slTrigger}
                    onChange={(e) => setSlTrigger(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full px-2 py-1.5 text-xs rounded
              bg-white text-slate-900 border border-slate-300
              focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500
              dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700
            "
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-xs mb-1 text-slate-600 dark:text-slate-400">
                    SL Limit
                  </label>
                  <input
                    type="number"
                    value={slLimit}
                    onChange={(e) => setSlLimit(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="any"
                    className="w-full px-2 py-1.5 text-xs rounded
              bg-white text-slate-900 border border-slate-300
              focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500
              dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700
            "
                  />
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Total & Fee */}
        <div className="pt-2.5 border-t border-slate-300 dark:border-slate-800">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Fee ({feeLevel}%)
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
              {getFeeAmount().toFixed(2)}
              <span className="text-xs text-slate-500 ml-1">{quoteCurrency}</span>
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Total (incl. fee)
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {getTotal()}
              <span className="text-xs text-slate-500 ml-1">{quoteCurrency}</span>
            </span>
          </div>
        </div>


        {/* Trading Info Block */}
        <div className="p-3 rounded border
                  bg-slate-100 border-slate-300
                  dark:bg-slate-800/50 dark:border-slate-700
                ">
          {isSpot ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="text-center">
                <div className="text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Lots
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {lots.toFixed(6)}
                </div>
              </div>

              <div className="text-center border-l border-slate-300 dark:border-slate-700">
                <div className="text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Total Value
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  ${getTotal()}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="text-center">
                <div className="text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Lots
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {lots.toFixed(2)}
                </div>
              </div>

              <div className="text-center border-x border-slate-300 dark:border-slate-700">
                <div className="text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Margin
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  ${margin.toFixed(2)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-slate-600 dark:text-slate-400 mb-1 font-medium">
                  Pip Value
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  ${pipValue.toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Single Hedge Button */}
        <div className="pt-2 pb-4">
          {isCFD ? (
            /* Single Hedge Button for CFD/Forex - executes BOTH buy and sell */
            <button
              onClick={handleHedgeOrder}
              disabled={
                isPlacingOrder ||
                parseFloat(amount || '0') <= 0 ||
                (orderType === 'market' && (isNaN(currentPrice) || currentPrice <= 0)) ||
                (orderType !== 'market' && (parseFloat(getTotal() || 'Infinity') * 2 > usdBalance)) || // *2 for hedge margin
                ((orderType === 'limit' || orderType === 'stop-limit') &&
                  (isNaN(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0))
              }
              className="
        w-full px-4 py-3 text-base font-bold rounded-lg transition shadow-sm
        flex items-center justify-center gap-2
        bg-[#00C0A2] hover:bg-[#00a085] text-white
        disabled:opacity-50 disabled:cursor-not-allowed
      "
            >
              Hedge
            </button>
          ) : (
            /* Regular Buy/Sell Buttons for Spot */
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleOrder('buy')}
                disabled={
                  isPlacingOrder ||
                  parseFloat(amount || '0') <= 0 ||
                  (orderType === 'market' && (isNaN(currentPrice) || currentPrice <= 0)) ||
                  (orderType !== 'market' && (parseFloat(getTotal() || 'Infinity') > usdBalance))
                }
                className="
                  px-4 py-3 text-base font-bold rounded-lg transition shadow-sm
                  flex items-center justify-center gap-2
                  bg-green-500 hover:bg-green-600 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed
                  dark:bg-green-600 dark:hover:bg-green-500
                "
              >
                {`Buy ${baseCurrency}`}
              </button>

              <button
                onClick={() => handleOrder('sell')}
                disabled={
                  isPlacingOrder ||
                  parseFloat(amount || '0') <= 0 ||
                  (isSpot && parseFloat(amount || '0') > currentHolding) ||
                  (orderType === 'market' && (isNaN(currentPrice) || currentPrice <= 0)) ||
                  ((orderType === 'limit' || orderType === 'stop-limit') &&
                    (isNaN(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0))
                }
                className="
                  px-4 py-3 text-base font-bold rounded-lg transition shadow-sm
                  flex items-center justify-center gap-2
                  bg-red-500 hover:bg-red-600 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed
                  dark:bg-red-600 dark:hover:bg-red-500
                "
              >
                {`Sell ${baseCurrency}`}
              </button>
            </div>
          )}
        </div>

        {/* Order Processing Overlay - Centered */}
        {isPlacingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm mx-4 transform transition-all duration-300 scale-100 opacity-100">
              <div className="flex flex-col items-center gap-6">
                {/* Animated Spinner */}
                <div className="relative">
                  <svg className="animate-spin h-16 w-16 text-[#00C0A2]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 bg-[#00C0A2] rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Processing Text */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    ORDER PROCESSING
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Please wait while we process your order...
                  </p>
                </div>

                {/* Progress Dots */}
                <div className="flex gap-2">
                  <div className="h-2 w-2 bg-[#00C0A2] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="h-2 w-2 bg-[#00C0A2] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="h-2 w-2 bg-[#00C0A2] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

