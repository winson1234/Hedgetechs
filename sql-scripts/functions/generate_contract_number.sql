-- Function to generate contract numbers in format CNT-#####

CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
