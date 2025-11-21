-- Function to generate order numbers in format ORD-########

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_val BIGINT;
    new_order_number TEXT;
BEGIN
    next_val := nextval('order_number_seq');
    -- Changed from 5-digit to 8-digit padding
    new_order_number := 'ORD-' || LPAD(next_val::TEXT, 8, '0');
    RETURN new_order_number;
END;
$$;
