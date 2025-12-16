-- Fix: Ensure all required sequences and functions exist
-- Run this script if you encounter any "failed to generate..." errors
--
-- This script creates:
-- - Transaction number generation (TXN-00001)
-- - Deposit reference generation (DEP-20251212-000001)
-- - Order number generation (ORD-00001)
-- - Contract number generation (CNT-00001)

-- ============================================================================
-- Transaction Number Generation (for deposits, withdrawals, trades, etc.)
-- ============================================================================

-- Create transaction number sequence (for TXN-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

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

-- ============================================================================
-- Deposit Reference ID Generation
-- ============================================================================

-- Create sequence for deposit reference counter (per day)
CREATE SEQUENCE IF NOT EXISTS deposit_reference_counter
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Function to generate unique deposit reference ID (DEP-YYYYMMDD-XXXXXX)
CREATE OR REPLACE FUNCTION generate_deposit_reference_id()
RETURNS text AS $$
DECLARE
  date_prefix text;
  counter_val bigint;
  reference_id text;
BEGIN
  -- Format: DEP-YYYYMMDD-XXXXXX (6 digits for counter)
  date_prefix := 'DEP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
  
  -- Get next counter value
  counter_val := nextval('deposit_reference_counter');
  
  -- Format counter as 6-digit zero-padded number
  reference_id := date_prefix || LPAD(counter_val::text, 6, '0');
  
  RETURN reference_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Order Number Generation
-- ============================================================================

-- Create order number sequence (for ORD-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

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

-- ============================================================================
-- Contract Number Generation
-- ============================================================================

-- Create contract number sequence (for CNT-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

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

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Transaction Number Function: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_transaction_number'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Deposit Reference Function: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_deposit_reference_id'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Order Number Function: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_order_number'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Contract Number Function: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_contract_number'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Transaction Number Sequence: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_sequences WHERE sequencename = 'transaction_number_seq'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Deposit Reference Sequence: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_sequences WHERE sequencename = 'deposit_reference_counter'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Order Number Sequence: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_sequences WHERE sequencename = 'order_number_seq'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

SELECT 'Contract Number Sequence: ' || CASE WHEN EXISTS (
    SELECT 1 FROM pg_sequences WHERE sequencename = 'contract_number_seq'
) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END;

