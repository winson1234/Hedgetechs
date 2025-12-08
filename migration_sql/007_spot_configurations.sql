create table public.spot_configurations (
  symbol text not null,
  base_precision integer not null,
  quote_precision integer not null,
  tick_size numeric not null,
  step_size numeric not null,
  min_quantity numeric not null,
  max_quantity numeric not null,
  min_notional numeric not null,
  max_notional numeric not null,
  maker_fee_rate numeric not null default 0.001,
  taker_fee_rate numeric not null default 0.001,
  constraint spot_configurations_pkey primary key (symbol),
  constraint spot_configurations_symbol_fkey foreign KEY (symbol) references instruments (symbol) on delete CASCADE,
  constraint spot_configurations_max_notional_check check ((max_notional > (0)::numeric)),
  constraint spot_configurations_max_quantity_check check ((max_quantity > (0)::numeric)),
  constraint spot_configurations_min_notional_check check ((min_notional > (0)::numeric)),
  constraint spot_configurations_min_quantity_check check ((min_quantity > (0)::numeric)),
  constraint spot_configurations_quote_precision_check check (
    (
      (quote_precision >= 0)
      and (quote_precision <= 18)
    )
  ),
  constraint spot_configurations_step_size_check check ((step_size > (0)::numeric)),
  constraint spot_configurations_taker_fee_rate_check check (
    (
      (taker_fee_rate >= (0)::numeric)
      and (taker_fee_rate <= (1)::numeric)
    )
  ),
  constraint spot_configurations_tick_size_check check ((tick_size > (0)::numeric)),
  constraint valid_notional_range check ((max_notional >= min_notional)),
  constraint spot_configurations_base_precision_check check (
    (
      (base_precision >= 0)
      and (base_precision <= 18)
    )
  ),
  constraint valid_quantity_range check ((max_quantity >= min_quantity)),
  constraint spot_configurations_maker_fee_rate_check check (
    (
      (maker_fee_rate >= (0)::numeric)
      and (maker_fee_rate <= (1)::numeric)
    )
  )
) TABLESPACE pg_default;

INSERT INTO "public"."spot_configurations" ("symbol", "base_precision", "quote_precision", "tick_size", "step_size", "min_quantity", "max_quantity", "min_notional", "max_notional", "maker_fee_rate", "taker_fee_rate") VALUES ('ADAUSDT', '8', '4', '0.0001', '0.1', '0.1', '10000000', '10', '10000000', '0.001', '0.001'), ('APTUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('ARBUSDT', '8', '4', '0.0001', '0.1', '0.1', '10000000', '10', '10000000', '0.001', '0.001'), ('ATOMUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('AVAXUSDT', '8', '2', '0.01', '0.001', '0.001', '100000', '10', '10000000', '0.001', '0.001'), ('BNBUSDT', '8', '2', '0.01', '0.001', '0.001', '100000', '10', '10000000', '0.001', '0.001'), ('BTCUSDT', '8', '2', '0.01', '0.00001', '0.00001', '1000', '10', '10000000', '0.001', '0.001'), ('DOGEUSDT', '8', '5', '0.00001', '1', '1', '100000000', '10', '10000000', '0.001', '0.001'), ('DOTUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('ETHUSDT', '8', '2', '0.01', '0.0001', '0.0001', '10000', '10', '10000000', '0.001', '0.001'), ('FILUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('ICPUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('LINKUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('LTCUSDT', '8', '2', '0.01', '0.001', '0.001', '100000', '10', '10000000', '0.001', '0.001'), ('NEARUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('OPUSDT', '8', '4', '0.0001', '0.1', '0.1', '10000000', '10', '10000000', '0.001', '0.001'), ('PAXGUSDT', '8', '2', '0.01', '0.0001', '0.0001', '1000', '10', '10000000', '0.002', '0.002'), ('SHIBUSDT', '8', '8', '0.00000001', '1000', '1000', '1000000000', '10', '10000000', '0.001', '0.001'), ('SOLUSDT', '8', '2', '0.01', '0.001', '0.001', '100000', '10', '10000000', '0.001', '0.001'), ('STXUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('SUIUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('TONUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('UNIUSDT', '8', '3', '0.001', '0.01', '0.01', '1000000', '10', '10000000', '0.001', '0.001'), ('XRPUSDT', '8', '4', '0.0001', '0.1', '0.1', '10000000', '10', '10000000', '0.001', '0.001');