-- Add bep20 to withdrawal method enum
ALTER TYPE public.withdrawal_method ADD VALUE 'bep20';

-- Update function to calculate withdrawal fee including bep20
CREATE OR REPLACE FUNCTION calculate_withdrawal_fee(
  p_method withdrawal_method,
  p_amount numeric
)
RETURNS numeric AS $$
DECLARE
  fee_amount numeric;
BEGIN
  -- Fee structure (customize as needed)
  CASE p_method
    WHEN 'tron' THEN
      -- Fixed fee for Tron TRC20 (e.g., 1 USDT network fee)
      fee_amount := 1.0;
    WHEN 'bep20' THEN
      -- Fixed fee for BSC BEP20 (e.g., 1 USDT network fee)
      fee_amount := 1.0;
    WHEN 'bank_transfer' THEN
      -- Percentage-based fee (e.g., 0.5% with min $5, max $50)
      fee_amount := GREATEST(5.0, LEAST(50.0, p_amount * 0.005));
    WHEN 'wire' THEN
      -- Fixed fee for wire transfer
      fee_amount := 25.0;
    ELSE
      -- Default fee
      fee_amount := 0.0;
  END CASE;
  
  RETURN fee_amount;
END;
$$ LANGUAGE plpgsql;