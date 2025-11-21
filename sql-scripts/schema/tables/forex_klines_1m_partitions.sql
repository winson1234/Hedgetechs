--
-- PostgreSQL database dump
--

\restrict rjAh56hjVGCDVZwDNw1crRE6llhPisqanTYN1bdv8UcDvcufie869M5dHfEXVaj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: forex_klines_1m_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m_2025_09 (
    id uuid DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    open_bid numeric(18,5) NOT NULL,
    high_bid numeric(18,5) NOT NULL,
    low_bid numeric(18,5) NOT NULL,
    close_bid numeric(18,5) NOT NULL,
    open_ask numeric(18,5) NOT NULL,
    high_ask numeric(18,5) NOT NULL,
    low_ask numeric(18,5) NOT NULL,
    close_ask numeric(18,5) NOT NULL,
    volume integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: forex_klines_1m_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m_2025_10 (
    id uuid DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    open_bid numeric(18,5) NOT NULL,
    high_bid numeric(18,5) NOT NULL,
    low_bid numeric(18,5) NOT NULL,
    close_bid numeric(18,5) NOT NULL,
    open_ask numeric(18,5) NOT NULL,
    high_ask numeric(18,5) NOT NULL,
    low_ask numeric(18,5) NOT NULL,
    close_ask numeric(18,5) NOT NULL,
    volume integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: forex_klines_1m_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m_2025_11 (
    id uuid DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    open_bid numeric(18,5) NOT NULL,
    high_bid numeric(18,5) NOT NULL,
    low_bid numeric(18,5) NOT NULL,
    close_bid numeric(18,5) NOT NULL,
    open_ask numeric(18,5) NOT NULL,
    high_ask numeric(18,5) NOT NULL,
    low_ask numeric(18,5) NOT NULL,
    close_ask numeric(18,5) NOT NULL,
    volume integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: forex_klines_1m_2025_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m_2025_12 (
    id uuid DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    open_bid numeric(18,5) NOT NULL,
    high_bid numeric(18,5) NOT NULL,
    low_bid numeric(18,5) NOT NULL,
    close_bid numeric(18,5) NOT NULL,
    open_ask numeric(18,5) NOT NULL,
    high_ask numeric(18,5) NOT NULL,
    low_ask numeric(18,5) NOT NULL,
    close_ask numeric(18,5) NOT NULL,
    volume integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: forex_klines_1m_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m_2026_01 (
    id uuid DEFAULT gen_random_uuid(),
    symbol text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    open_bid numeric(18,5) NOT NULL,
    high_bid numeric(18,5) NOT NULL,
    low_bid numeric(18,5) NOT NULL,
    close_bid numeric(18,5) NOT NULL,
    open_ask numeric(18,5) NOT NULL,
    high_ask numeric(18,5) NOT NULL,
    low_ask numeric(18,5) NOT NULL,
    close_ask numeric(18,5) NOT NULL,
    volume integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: forex_klines_1m_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m ATTACH PARTITION public.forex_klines_1m_2025_09 FOR VALUES FROM ('2025-09-01 00:00:00') TO ('2025-10-01 00:00:00');


--
-- Name: forex_klines_1m_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m ATTACH PARTITION public.forex_klines_1m_2025_10 FOR VALUES FROM ('2025-10-01 00:00:00') TO ('2025-11-01 00:00:00');


--
-- Name: forex_klines_1m_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m ATTACH PARTITION public.forex_klines_1m_2025_11 FOR VALUES FROM ('2025-11-01 00:00:00') TO ('2025-12-01 00:00:00');


--
-- Name: forex_klines_1m_2025_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m ATTACH PARTITION public.forex_klines_1m_2025_12 FOR VALUES FROM ('2025-12-01 00:00:00') TO ('2026-01-01 00:00:00');


--
-- Name: forex_klines_1m_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m ATTACH PARTITION public.forex_klines_1m_2026_01 FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');


--
-- Name: forex_klines_1m_2025_09 forex_klines_1m_2025_09_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m_2025_09
    ADD CONSTRAINT forex_klines_1m_2025_09_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_10 forex_klines_1m_2025_10_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m_2025_10
    ADD CONSTRAINT forex_klines_1m_2025_10_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_11 forex_klines_1m_2025_11_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m_2025_11
    ADD CONSTRAINT forex_klines_1m_2025_11_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_12 forex_klines_1m_2025_12_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m_2025_12
    ADD CONSTRAINT forex_klines_1m_2025_12_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: forex_klines_1m_2026_01 forex_klines_1m_2026_01_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m_2026_01
    ADD CONSTRAINT forex_klines_1m_2026_01_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_09_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forex_klines_1m_2025_09_symbol_timestamp_idx ON public.forex_klines_1m_2025_09 USING btree (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_10_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forex_klines_1m_2025_10_symbol_timestamp_idx ON public.forex_klines_1m_2025_10 USING btree (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_11_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forex_klines_1m_2025_11_symbol_timestamp_idx ON public.forex_klines_1m_2025_11 USING btree (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_12_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forex_klines_1m_2025_12_symbol_timestamp_idx ON public.forex_klines_1m_2025_12 USING btree (symbol, "timestamp");


--
-- Name: forex_klines_1m_2026_01_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forex_klines_1m_2026_01_symbol_timestamp_idx ON public.forex_klines_1m_2026_01 USING btree (symbol, "timestamp");


--
-- Name: forex_klines_1m_2025_09_symbol_timestamp_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_forex_klines_unique ATTACH PARTITION public.forex_klines_1m_2025_09_symbol_timestamp_idx;


--
-- Name: forex_klines_1m_2025_09_symbol_timestamp_key; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.forex_klines_1m_symbol_timestamp_key ATTACH PARTITION public.forex_klines_1m_2025_09_symbol_timestamp_key;


--
-- Name: forex_klines_1m_2025_10_symbol_timestamp_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_forex_klines_unique ATTACH PARTITION public.forex_klines_1m_2025_10_symbol_timestamp_idx;


--
-- Name: forex_klines_1m_2025_10_symbol_timestamp_key; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.forex_klines_1m_symbol_timestamp_key ATTACH PARTITION public.forex_klines_1m_2025_10_symbol_timestamp_key;


--
-- Name: forex_klines_1m_2025_11_symbol_timestamp_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_forex_klines_unique ATTACH PARTITION public.forex_klines_1m_2025_11_symbol_timestamp_idx;


--
-- Name: forex_klines_1m_2025_11_symbol_timestamp_key; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.forex_klines_1m_symbol_timestamp_key ATTACH PARTITION public.forex_klines_1m_2025_11_symbol_timestamp_key;


--
-- Name: forex_klines_1m_2025_12_symbol_timestamp_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_forex_klines_unique ATTACH PARTITION public.forex_klines_1m_2025_12_symbol_timestamp_idx;


--
-- Name: forex_klines_1m_2025_12_symbol_timestamp_key; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.forex_klines_1m_symbol_timestamp_key ATTACH PARTITION public.forex_klines_1m_2025_12_symbol_timestamp_key;


--
-- Name: forex_klines_1m_2026_01_symbol_timestamp_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_forex_klines_unique ATTACH PARTITION public.forex_klines_1m_2026_01_symbol_timestamp_idx;


--
-- Name: forex_klines_1m_2026_01_symbol_timestamp_key; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.forex_klines_1m_symbol_timestamp_key ATTACH PARTITION public.forex_klines_1m_2026_01_symbol_timestamp_key;


--
-- PostgreSQL database dump complete
--

\unrestrict rjAh56hjVGCDVZwDNw1crRE6llhPisqanTYN1bdv8UcDvcufie869M5dHfEXVaj

