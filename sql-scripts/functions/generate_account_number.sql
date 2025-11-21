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

    RETURN new_account_number;
END;
$$;
