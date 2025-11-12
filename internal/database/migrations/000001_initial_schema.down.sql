-- Rollback initial schema

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_instruments_updated_at ON public.instruments;
DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON public.kyc_documents;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS update_balances_updated_at ON public.balances;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_auth_user_delete();
DROP FUNCTION IF EXISTS public.handle_user_delete();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.generate_transaction_number();
DROP FUNCTION IF EXISTS public.generate_contract_number();
DROP FUNCTION IF EXISTS public.generate_order_number();
DROP FUNCTION IF EXISTS public.generate_account_number(TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.instruments CASCADE;
DROP TABLE IF EXISTS public.kyc_documents CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.transaction_number_seq;
DROP SEQUENCE IF EXISTS public.contract_number_seq;
DROP SEQUENCE IF EXISTS public.order_number_seq;
DROP SEQUENCE IF EXISTS public.demo_account_seq;
DROP SEQUENCE IF EXISTS public.live_account_seq;

-- Drop types
DROP TYPE IF EXISTS contract_status;
DROP TYPE IF EXISTS contract_side;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS order_type;
DROP TYPE IF EXISTS order_side;
DROP TYPE IF EXISTS kyc_status;
DROP TYPE IF EXISTS kyc_document_type;
DROP TYPE IF EXISTS transaction_status;
DROP TYPE IF EXISTS transaction_type;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS product_type;
DROP TYPE IF EXISTS account_type;
