--
-- PostgreSQL database dump
--

\restrict R9Z2QAg7SrohJt21JaAWvDepnMV1ObHQ55KuediKJ06lR78vGgCnFtKEtwEhncc

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
-- Name: forex_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forex_configurations (
    symbol text NOT NULL,
    digits integer NOT NULL,
    contract_size integer NOT NULL,
    pip_size numeric NOT NULL,
    min_lot numeric NOT NULL,
    max_lot numeric NOT NULL,
    lot_step numeric NOT NULL,
    max_leverage integer NOT NULL,
    margin_currency text NOT NULL,
    stop_level integer DEFAULT 0 NOT NULL,
    freeze_level integer DEFAULT 0 NOT NULL,
    swap_enable boolean DEFAULT false NOT NULL,
    swap_long numeric DEFAULT 0 NOT NULL,
    swap_short numeric DEFAULT 0 NOT NULL,
    swap_triple_day text DEFAULT 'Wednesday'::text NOT NULL,
    CONSTRAINT forex_configurations_contract_size_check CHECK ((contract_size > 0)),
    CONSTRAINT forex_configurations_digits_check CHECK (((digits >= 0) AND (digits <= 10))),
    CONSTRAINT forex_configurations_freeze_level_check CHECK ((freeze_level >= 0)),
    CONSTRAINT forex_configurations_lot_step_check CHECK ((lot_step > (0)::numeric)),
    CONSTRAINT forex_configurations_max_leverage_check CHECK (((max_leverage > 0) AND (max_leverage <= 1000))),
    CONSTRAINT forex_configurations_max_lot_check CHECK ((max_lot > (0)::numeric)),
    CONSTRAINT forex_configurations_min_lot_check CHECK ((min_lot > (0)::numeric)),
    CONSTRAINT forex_configurations_pip_size_check CHECK ((pip_size > (0)::numeric)),
    CONSTRAINT forex_configurations_stop_level_check CHECK ((stop_level >= 0)),
    CONSTRAINT forex_configurations_swap_triple_day_check CHECK ((swap_triple_day = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text, 'Sunday'::text]))),
    CONSTRAINT valid_lot_range CHECK ((max_lot >= min_lot))
);


--
-- Name: TABLE forex_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.forex_configurations IS 'Trading configurations for forex pairs';


--
-- Name: COLUMN forex_configurations.contract_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forex_configurations.contract_size IS 'Standard lot size';


--
-- Name: COLUMN forex_configurations.pip_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forex_configurations.pip_size IS 'Price increment per pip';


--
-- Name: COLUMN forex_configurations.swap_triple_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.forex_configurations.swap_triple_day IS 'Day when swap is charged 3x (usually Wednesday)';


--
-- Name: forex_configurations forex_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_configurations
    ADD CONSTRAINT forex_configurations_pkey PRIMARY KEY (symbol);


--
-- Name: forex_configurations forex_configurations_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forex_configurations
    ADD CONSTRAINT forex_configurations_symbol_fkey FOREIGN KEY (symbol) REFERENCES public.instruments(symbol) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict R9Z2QAg7SrohJt21JaAWvDepnMV1ObHQ55KuediKJ06lR78vGgCnFtKEtwEhncc

