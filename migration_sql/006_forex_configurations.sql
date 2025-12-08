create table public.forex_configurations (
  symbol text not null,
  digits integer not null,
  contract_size integer not null,
  pip_size numeric not null,
  min_lot numeric not null,
  max_lot numeric not null,
  lot_step numeric not null,
  max_leverage integer not null,
  margin_currency text not null,
  stop_level integer not null default 0,
  freeze_level integer not null default 0,
  swap_enable boolean not null default false,
  swap_long numeric not null default 0,
  swap_short numeric not null default 0,
  swap_triple_day text not null default 'Wednesday'::text,
  constraint forex_configurations_pkey primary key (symbol),
  constraint forex_configurations_symbol_fkey foreign KEY (symbol) references instruments (symbol) on delete CASCADE,
  constraint forex_configurations_freeze_level_check check ((freeze_level >= 0)),
  constraint forex_configurations_lot_step_check check ((lot_step > (0)::numeric)),
  constraint forex_configurations_max_leverage_check check (
    (
      (max_leverage > 0)
      and (max_leverage <= 1000)
    )
  ),
  constraint forex_configurations_max_lot_check check ((max_lot > (0)::numeric)),
  constraint forex_configurations_min_lot_check check ((min_lot > (0)::numeric)),
  constraint forex_configurations_pip_size_check check ((pip_size > (0)::numeric)),
  constraint forex_configurations_stop_level_check check ((stop_level >= 0)),
  constraint forex_configurations_swap_triple_day_check check (
    (
      swap_triple_day = any (
        array[
          'Monday'::text,
          'Tuesday'::text,
          'Wednesday'::text,
          'Thursday'::text,
          'Friday'::text,
          'Saturday'::text,
          'Sunday'::text
        ]
      )
    )
  ),
  constraint forex_configurations_contract_size_check check ((contract_size > 0)),
  constraint valid_lot_range check ((max_lot >= min_lot)),
  constraint forex_configurations_digits_check check (
    (
      (digits >= 0)
      and (digits <= 10)
    )
  )
) TABLESPACE pg_default;

INSERT INTO "public"."forex_configurations" ("symbol", "digits", "contract_size", "pip_size", "min_lot", "max_lot", "lot_step", "max_leverage", "margin_currency", "stop_level", "freeze_level", "swap_enable", "swap_long", "swap_short", "swap_triple_day") VALUES ('AUDJPY', '3', '100000', '0.001', '0.01', '100', '0.01', '500', 'JPY', '5', '3', 'true', '-0.75', '-0.55', 'Wednesday'), ('AUDUSD', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'USD', '5', '3', 'true', '-0.30', '-0.70', 'Wednesday'), ('CADJPY', '3', '100000', '0.001', '0.01', '100', '0.01', '500', 'JPY', '5', '3', 'true', '-0.85', '-0.65', 'Wednesday'), ('EURGBP', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'GBP', '5', '3', 'true', '-0.45', '-1.10', 'Wednesday'), ('EURJPY', '3', '100000', '0.001', '0.01', '100', '0.01', '500', 'JPY', '5', '3', 'true', '-0.90', '-0.60', 'Wednesday'), ('EURUSD', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'USD', '5', '3', 'true', '-0.50', '-1.50', 'Wednesday'), ('GBPJPY', '3', '100000', '0.001', '0.01', '100', '0.01', '500', 'JPY', '5', '3', 'true', '-1.10', '-0.40', 'Wednesday'), ('GBPUSD', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'USD', '5', '3', 'true', '-0.80', '-1.20', 'Wednesday'), ('NZDUSD', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'USD', '5', '3', 'true', '-0.25', '-0.65', 'Wednesday'), ('USDCAD', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'CAD', '5', '3', 'true', '-0.60', '-0.90', 'Wednesday'), ('USDCHF', '5', '100000', '0.00001', '0.01', '100', '0.01', '500', 'CHF', '5', '3', 'true', '-0.70', '-0.85', 'Wednesday'), ('USDJPY', '3', '100000', '0.001', '0.01', '100', '0.01', '500', 'JPY', '5', '3', 'true', '-1.00', '-0.50', 'Wednesday');