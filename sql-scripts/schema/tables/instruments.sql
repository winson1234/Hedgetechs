--
-- PostgreSQL database dump
--

\restrict vHZpS3QDsoUmZocUylkH2Npj43sDKOULk4Wchj50a6Hk3gElUOFByMibgrh67sI

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
-- Name: instruments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instruments (
    symbol text NOT NULL,
    instrument_type text NOT NULL,
    base_currency text NOT NULL,
    quote_currency text NOT NULL,
    is_tradable boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instruments_instrument_type_check CHECK ((instrument_type = ANY (ARRAY['crypto'::text, 'commodity'::text, 'forex'::text])))
);


--
-- Name: TABLE instruments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.instruments IS 'Master table for all tradable instruments (crypto, forex, commodities)';


--
-- Name: COLUMN instruments.symbol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.instruments.symbol IS 'Unique trading symbol (e.g., BTCUSDT, EURUSD)';


--
-- Name: COLUMN instruments.instrument_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.instruments.instrument_type IS 'Type: crypto, commodity, or forex';


--
-- Name: COLUMN instruments.is_tradable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.instruments.is_tradable IS 'Whether instrument is currently enabled for trading';


--
-- Name: instruments instruments_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instruments
    ADD CONSTRAINT instruments_pkey1 PRIMARY KEY (symbol);


--
-- Name: idx_instruments_base_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instruments_base_currency ON public.instruments USING btree (base_currency);


--
-- Name: idx_instruments_quote_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instruments_quote_currency ON public.instruments USING btree (quote_currency);


--
-- Name: idx_instruments_tradable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instruments_tradable ON public.instruments USING btree (is_tradable);


--
-- Name: idx_instruments_type_tradable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_instruments_type_tradable ON public.instruments USING btree (instrument_type, is_tradable);


--
-- Name: instruments trigger_update_instruments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_instruments_updated_at BEFORE UPDATE ON public.instruments FOR EACH ROW EXECUTE FUNCTION public.update_instruments_updated_at();


--
-- PostgreSQL database dump complete
--

\unrestrict vHZpS3QDsoUmZocUylkH2Npj43sDKOULk4Wchj50a6Hk3gElUOFByMibgrh67sI

