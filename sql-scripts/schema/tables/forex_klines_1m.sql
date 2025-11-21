--
-- PostgreSQL database dump
--

\restrict yqgUxYbW9i2Ze7MQIg23LpcZUB4oGVhRIVhi0OCeFVEJpjcoiwzcbSjWz3xm0n9

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

--
-- Name: forex_klines_1m; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_klines_1m (
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
)
PARTITION BY RANGE ("timestamp");


--
-- Name: forex_klines_1m forex_klines_1m_symbol_timestamp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_klines_1m
    ADD CONSTRAINT forex_klines_1m_symbol_timestamp_key UNIQUE (symbol, "timestamp");


--
-- Name: idx_forex_klines_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_forex_klines_unique ON ONLY public.forex_klines_1m USING btree (symbol, "timestamp");


--
-- PostgreSQL database dump complete
--

\unrestrict yqgUxYbW9i2Ze7MQIg23LpcZUB4oGVhRIVhi0OCeFVEJpjcoiwzcbSjWz3xm0n9

