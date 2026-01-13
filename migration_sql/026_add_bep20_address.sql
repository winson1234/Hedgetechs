-- Add BEP-20 Wallet Address to platform_settings
INSERT INTO
    platform_settings (key, value, description)
VALUES (
        'usdt_bep20_wallet_address',
        '0x0000000000000000000000000000000000000000',
        'Platform wallet address for USDT (BEP20) deposits'
    )
ON CONFLICT (key) DO NOTHING;