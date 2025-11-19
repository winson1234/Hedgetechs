-- ================================================================
-- COMPLETE SUPABASE DATABASE SCHEMA
-- ================================================================
-- Execute this single file in Supabase SQL Editor
-- Project: Brokerage Trading Platform
-- This file contains everything: tables, functions, policies, seed data
-- ================================================================

-- ================================================================
-- 1. EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. CUSTOM TYPES (ENUMS)
-- ================================================================

-- Account type: live or demo
CREATE TYPE account_type AS ENUM ('live', 'demo');

-- Product type: spot, cfd, or futures
CREATE TYPE product_type AS ENUM ('spot', 'cfd', 'futures');

-- Account status
CREATE TYPE account_status AS ENUM ('active', 'deactivated', 'suspended');

-- Transaction type
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'position_close');

-- Transaction status
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');

-- KYC document type
CREATE TYPE kyc_document_type AS ENUM ('passport', 'drivers_license', 'national_id', 'proof_of_address', 'selfie');

-- KYC status
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');

-- Order side (buy/sell)
CREATE TYPE order_side AS ENUM ('buy', 'sell');

-- Order type
CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');

-- Order status
CREATE TYPE order_status AS ENUM ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected');

-- Contract side
CREATE TYPE contract_side AS ENUM ('long', 'short');

-- Contract status
CREATE TYPE contract_status AS ENUM ('open', 'closed', 'liquidated');

-- ================================================================
-- 3. SEQUENCES FOR DISPLAY NUMBERS
-- ================================================================

-- Account number sequences (separate for live and demo)
-- Live accounts: 1000000 - 4999999
CREATE SEQUENCE IF NOT EXISTS public.live_account_seq
    START WITH 1000000
    INCREMENT BY 1
    MINVALUE 1000000
    MAXVALUE 4999999
    CACHE 1;

-- Demo accounts: 5000000 - 9999999
CREATE SEQUENCE IF NOT EXISTS public.demo_account_seq
    START WITH 5000000
    INCREMENT BY 1
    MINVALUE 5000000
    MAXVALUE 9999999
    CACHE 1;

-- Order number sequence (for ORD-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CACHE 1;

-- Contract number sequence (for CNT-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CACHE 1;

-- Transaction number sequence (for TXN-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    CACHE 1;

-- Grant usage to authenticated users
GRANT USAGE ON SEQUENCE public.live_account_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.demo_account_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.order_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.contract_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.transaction_number_seq TO authenticated;

-- ================================================================
-- 4. USERS TABLE (extends Supabase auth.users)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    country TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ================================================================
-- 5. ACCOUNTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL UNIQUE,
    type account_type NOT NULL,
    product_type product_type NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status account_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON public.accounts(account_number);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own accounts" ON public.accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- 6. BALANCES TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_balances_account_id ON public.balances(account_id);

ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balances" ON public.balances
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = balances.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own balances" ON public.balances
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = balances.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own balances" ON public.balances
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = balances.account_id
            AND accounts.user_id = auth.uid()
        )
    );

-- ================================================================
-- 7. KYC_DOCUMENTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    document_type kyc_document_type NOT NULL,
    file_path TEXT NOT NULL,
    status kyc_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON public.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON public.kyc_documents(status);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own KYC documents" ON public.kyc_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC documents" ON public.kyc_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending KYC documents" ON public.kyc_documents
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- ================================================================
-- 8. INSTRUMENTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.instruments (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    base_currency TEXT,
    quote_currency TEXT,
    instrument_type TEXT,
    is_tradeable BOOLEAN NOT NULL DEFAULT true,
    leverage_cap INTEGER DEFAULT 1,
    spread_adjustment_bps INTEGER DEFAULT 0,
    min_order_size DECIMAL(20, 8),
    max_order_size DECIMAL(20, 8),
    tick_size DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instruments_tradeable ON public.instruments(is_tradeable);
CREATE INDEX IF NOT EXISTS idx_instruments_type ON public.instruments(instrument_type);

ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read instruments" ON public.instruments
    FOR SELECT USING (true);

-- ================================================================
-- 9. ORDERS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL REFERENCES public.instruments(symbol),
    order_number TEXT NOT NULL UNIQUE,  -- Human-readable: ORD-00001
    side order_side NOT NULL,
    type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    amount_base DECIMAL(20, 8) NOT NULL,
    limit_price DECIMAL(20, 8),
    stop_price DECIMAL(20, 8),
    filled_amount DECIMAL(20, 8) DEFAULT 0,
    average_fill_price DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON public.orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON public.orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON public.orders
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = orders.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- 10. CONTRACTS TABLE (Open Positions)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL REFERENCES public.instruments(symbol),
    contract_number TEXT NOT NULL UNIQUE,  -- Human-readable: CNT-00001
    side contract_side NOT NULL,
    status contract_status NOT NULL DEFAULT 'open',
    lot_size DECIMAL(20, 8) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    margin_used DECIMAL(20, 8) NOT NULL,
    leverage INTEGER DEFAULT 1,
    tp_price DECIMAL(20, 8),
    sl_price DECIMAL(20, 8),
    close_price DECIMAL(20, 8),
    pnl DECIMAL(20, 8),
    swap DECIMAL(20, 8) DEFAULT 0,
    commission DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_account_id ON public.contracts(account_id);
CREATE INDEX IF NOT EXISTS idx_contracts_symbol ON public.contracts(symbol);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON public.contracts(contract_number);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own contracts" ON public.contracts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contracts" ON public.contracts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = contracts.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own contracts" ON public.contracts
    FOR UPDATE USING (auth.uid() = user_id);

-- ================================================================
-- 11. TRANSACTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_number TEXT NOT NULL UNIQUE,  -- Human-readable: TXN-00001
    type transaction_type NOT NULL,
    currency TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    target_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_target_account_id ON public.transactions(target_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contract_id ON public.transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_number ON public.transactions(transaction_number);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON public.transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = transactions.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = transactions.account_id
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own transactions" ON public.transactions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.accounts
            WHERE accounts.id = transactions.account_id
            AND accounts.user_id = auth.uid()
        )
    );

-- ================================================================
-- 12. HELPER FUNCTIONS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate account numbers
-- Live accounts: 1000000-4999999
-- Demo accounts: 5000000-9999999
CREATE OR REPLACE FUNCTION public.generate_account_number(p_account_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_val BIGINT;
    new_account_number TEXT;
BEGIN
    -- Get next sequence value based on account type
    IF p_account_type = 'live' THEN
        SELECT nextval('public.live_account_seq') INTO next_val;
    ELSIF p_account_type = 'demo' THEN
        SELECT nextval('public.demo_account_seq') INTO next_val;
    ELSE
        RAISE EXCEPTION 'Invalid account type: %. Must be ''live'' or ''demo''.', p_account_type;
    END IF;

    -- Convert to text
    new_account_number := next_val::TEXT;

    -- Verify uniqueness (safety check)
    IF EXISTS (SELECT 1 FROM accounts WHERE account_number = new_account_number) THEN
        RAISE EXCEPTION 'Account number collision detected: %. This should not happen.', new_account_number;
    END IF;

    RETURN new_account_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_account_number(TEXT) TO authenticated;

-- Function to generate order numbers (ORD-00001 format)
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_val BIGINT;
    new_order_number TEXT;
BEGIN
    SELECT nextval('public.order_number_seq') INTO next_val;
    new_order_number := 'ORD-' || LPAD(next_val::TEXT, 5, '0');

    IF EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) THEN
        RAISE EXCEPTION 'Order number collision detected: %', new_order_number;
    END IF;

    RETURN new_order_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;

-- Function to generate contract numbers (CNT-00001 format)
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_val BIGINT;
    new_contract_number TEXT;
BEGIN
    SELECT nextval('public.contract_number_seq') INTO next_val;
    new_contract_number := 'CNT-' || LPAD(next_val::TEXT, 5, '0');

    IF EXISTS (SELECT 1 FROM contracts WHERE contract_number = new_contract_number) THEN
        RAISE EXCEPTION 'Contract number collision detected: %', new_contract_number;
    END IF;

    RETURN new_contract_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_contract_number() TO authenticated;

-- Function to generate transaction numbers (TXN-00001 format)
CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_val BIGINT;
    new_transaction_number TEXT;
BEGIN
    SELECT nextval('public.transaction_number_seq') INTO next_val;
    new_transaction_number := 'TXN-' || LPAD(next_val::TEXT, 5, '0');

    IF EXISTS (SELECT 1 FROM transactions WHERE transaction_number = new_transaction_number) THEN
        RAISE EXCEPTION 'Transaction number collision detected: %', new_transaction_number;
    END IF;

    RETURN new_transaction_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_transaction_number() TO authenticated;

-- ================================================================
-- 13. TRIGGERS
-- ================================================================

-- Updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at
    BEFORE UPDATE ON public.balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at
    BEFORE UPDATE ON public.kyc_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instruments_updated_at
    BEFORE UPDATE ON public.instruments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON public.contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, country)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'country'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Auto-delete auth user when public user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from auth.users
    -- This ensures auth records don't become orphaned
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_public_user_deleted
    AFTER DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();

-- Auto-delete public user when auth user is deleted (reverse direction)
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from public.users
    -- This ensures public records don't become orphaned
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_delete();

-- ================================================================
-- 14. SEED DATA FOR INSTRUMENTS
-- ================================================================
-- These 24 crypto instruments match the WebSocket streams in config.go
-- All pairs are crypto/USDT with consistent trading parameters

INSERT INTO public.instruments (symbol, name, base_currency, quote_currency, instrument_type, is_tradeable, leverage_cap, min_order_size, max_order_size, tick_size, spread_adjustment_bps) VALUES
    -- Major Cryptos (7)
    ('BTCUSDT', 'Bitcoin / Tether', 'BTC', 'USDT', 'crypto', true, 10, 0.00001, 100, 0.01, 10),
    ('ETHUSDT', 'Ethereum / Tether', 'ETH', 'USDT', 'crypto', true, 10, 0.0001, 1000, 0.01, 10),
    ('BNBUSDT', 'Binance Coin / Tether', 'BNB', 'USDT', 'crypto', true, 10, 0.001, 1000, 0.01, 10),
    ('SOLUSDT', 'Solana / Tether', 'SOL', 'USDT', 'crypto', true, 10, 0.001, 10000, 0.001, 10),
    ('XRPUSDT', 'Ripple / Tether', 'XRP', 'USDT', 'crypto', true, 10, 1, 1000000, 0.0001, 10),
    ('ADAUSDT', 'Cardano / Tether', 'ADA', 'USDT', 'crypto', true, 10, 1, 1000000, 0.0001, 10),
    ('AVAXUSDT', 'Avalanche / Tether', 'AVAX', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.01, 10),

    -- DeFi/Layer2 (8)
    ('MATICUSDT', 'Polygon / Tether', 'MATIC', 'USDT', 'crypto', true, 10, 1, 1000000, 0.0001, 10),
    ('LINKUSDT', 'Chainlink / Tether', 'LINK', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.01, 10),
    ('UNIUSDT', 'Uniswap / Tether', 'UNI', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),
    ('ATOMUSDT', 'Cosmos / Tether', 'ATOM', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),
    ('DOTUSDT', 'Polkadot / Tether', 'DOT', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),
    ('ARBUSDT', 'Arbitrum / Tether', 'ARB', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.0001, 10),
    ('OPUSDT', 'Optimism / Tether', 'OP', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.001, 10),
    ('APTUSDT', 'Aptos / Tether', 'APT', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),

    -- Altcoins (9)
    ('DOGEUSDT', 'Dogecoin / Tether', 'DOGE', 'USDT', 'crypto', true, 10, 1, 10000000, 0.00001, 10),
    ('LTCUSDT', 'Litecoin / Tether', 'LTC', 'USDT', 'crypto', true, 10, 0.001, 1000, 0.01, 10),
    ('SHIBUSDT', 'Shiba Inu / Tether', 'SHIB', 'USDT', 'crypto', true, 10, 1000, 1000000000, 0.00000001, 10),
    ('NEARUSDT', 'NEAR Protocol / Tether', 'NEAR', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.001, 10),
    ('ICPUSDT', 'Internet Computer / Tether', 'ICP', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),
    ('FILUSDT', 'Filecoin / Tether', 'FIL', 'USDT', 'crypto', true, 10, 0.01, 10000, 0.001, 10),
    ('SUIUSDT', 'Sui / Tether', 'SUI', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.0001, 10),
    ('STXUSDT', 'Stacks / Tether', 'STX', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.0001, 10),
    ('TONUSDT', 'Toncoin / Tether', 'TON', 'USDT', 'crypto', true, 10, 0.1, 100000, 0.001, 10)
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    base_currency = EXCLUDED.base_currency,
    quote_currency = EXCLUDED.quote_currency,
    instrument_type = EXCLUDED.instrument_type,
    is_tradeable = EXCLUDED.is_tradeable,
    leverage_cap = EXCLUDED.leverage_cap,
    min_order_size = EXCLUDED.min_order_size,
    max_order_size = EXCLUDED.max_order_size,
    tick_size = EXCLUDED.tick_size,
    spread_adjustment_bps = EXCLUDED.spread_adjustment_bps,
    updated_at = NOW();

-- ================================================================
-- SCHEMA COMPLETE
-- ================================================================
-- All tables, functions, policies, and seed data are included
--
-- Account Numbers:
-- - Live accounts: 1000000 - 4999999
-- - Demo accounts: 5000000 - 9999999
--
-- Display Numbers:
-- - Orders: ORD-00001, ORD-00002...
-- - Contracts: CNT-00001, CNT-00002...
-- - Transactions: TXN-00001, TXN-00002...
-- ================================================================
