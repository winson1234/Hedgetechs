-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL UNIQUE,
    type account_type NOT NULL,
    product_type product_type NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
    equity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    margin_used DECIMAL(20, 8) NOT NULL DEFAULT 0,
    margin_free DECIMAL(20, 8) NOT NULL DEFAULT 0,
    margin_level DECIMAL(10, 2),
    leverage INTEGER NOT NULL DEFAULT 100,
    status account_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- Create balances table
CREATE TABLE IF NOT EXISTS public.balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, currency)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side order_side NOT NULL,
    type order_type NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    stop_price DECIMAL(20, 8),
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    average_fill_price DECIMAL(20, 8),
    status order_status NOT NULL DEFAULT 'pending',
    leverage INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pending_orders table
CREATE TABLE IF NOT EXISTS public.pending_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side order_side NOT NULL,
    type order_type NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    trigger_price DECIMAL(20, 8) NOT NULL,
    limit_price DECIMAL(20, 8),
    leverage INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side contract_side NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    leverage INTEGER NOT NULL DEFAULT 1,
    liquidation_price DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    status contract_status NOT NULL DEFAULT 'open',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    close_price DECIMAL(20, 8),
    realized_pnl DECIMAL(20, 8)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency TEXT NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deposits table
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount DECIMAL(20, 8) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_method TEXT,
    payment_id TEXT,
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

