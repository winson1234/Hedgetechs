create table public.forex_klines_1m (
  id uuid null default gen_random_uuid (),
  symbol text not null,
  timestamp timestamp without time zone not null,
  open_bid numeric(18, 5) not null,
  high_bid numeric(18, 5) not null,
  low_bid numeric(18, 5) not null,
  close_bid numeric(18, 5) not null,
  open_ask numeric(18, 5) not null,
  high_ask numeric(18, 5) not null,
  low_ask numeric(18, 5) not null,
  close_ask numeric(18, 5) not null,
  volume integer null default 0,
  created_at timestamp without time zone null default now(),
  constraint forex_klines_1m_symbol_timestamp_key unique (symbol, "timestamp")
)
partition by
  RANGE ("timestamp");

create unique INDEX IF not exists idx_forex_klines_unique on only public.forex_klines_1m using btree (symbol, "timestamp");