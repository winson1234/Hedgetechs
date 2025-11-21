-- Function to generate transaction numbers in format TXN-#####

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
