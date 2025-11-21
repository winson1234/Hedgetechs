--
-- PostgreSQL database dump
--

\restrict RxbrVOsoIyjzabITvFClGCCz9cCnpvcQnG3KTDLZ1PisXWpYB26Hfc9Pc3MXGer

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
-- Name: spot_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spot_configurations (
    symbol text NOT NULL,
    base_precision integer NOT NULL,
    quote_precision integer NOT NULL,
    tick_size numeric NOT NULL,
    step_size numeric NOT NULL,
    min_quantity numeric NOT NULL,
    max_quantity numeric NOT NULL,
    min_notional numeric NOT NULL,
    max_notional numeric NOT NULL,
    maker_fee_rate numeric DEFAULT 0.001 NOT NULL,
    taker_fee_rate numeric DEFAULT 0.001 NOT NULL,
    CONSTRAINT spot_configurations_base_precision_check CHECK (((base_precision >= 0) AND (base_precision <= 18))),
    CONSTRAINT spot_configurations_maker_fee_rate_check CHECK (((maker_fee_rate >= (0)::numeric) AND (maker_fee_rate <= (1)::numeric))),
    CONSTRAINT spot_configurations_max_notional_check CHECK ((max_notional > (0)::numeric)),
    CONSTRAINT spot_configurations_max_quantity_check CHECK ((max_quantity > (0)::numeric)),
    CONSTRAINT spot_configurations_min_notional_check CHECK ((min_notional > (0)::numeric)),
    CONSTRAINT spot_configurations_min_quantity_check CHECK ((min_quantity > (0)::numeric)),
    CONSTRAINT spot_configurations_quote_precision_check CHECK (((quote_precision >= 0) AND (quote_precision <= 18))),
    CONSTRAINT spot_configurations_step_size_check CHECK ((step_size > (0)::numeric)),
    CONSTRAINT spot_configurations_taker_fee_rate_check CHECK (((taker_fee_rate >= (0)::numeric) AND (taker_fee_rate <= (1)::numeric))),
    CONSTRAINT spot_configurations_tick_size_check CHECK ((tick_size > (0)::numeric)),
    CONSTRAINT valid_notional_range CHECK ((max_notional >= min_notional)),
    CONSTRAINT valid_quantity_range CHECK ((max_quantity >= min_quantity))
);


--
-- Name: TABLE spot_configurations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.spot_configurations IS 'Trading configurations for spot instruments (crypto & commodities)';


--
-- Name: COLUMN spot_configurations.tick_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spot_configurations.tick_size IS 'Minimum price increment';


--
-- Name: COLUMN spot_configurations.step_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spot_configurations.step_size IS 'Minimum quantity increment';


--
-- Name: COLUMN spot_configurations.min_notional; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.spot_configurations.min_notional IS 'Minimum order value (price × quantity)';


--
-- Name: spot_configurations spot_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spot_configurations
    ADD CONSTRAINT spot_configurations_pkey PRIMARY KEY (symbol);


--
-- Name: spot_configurations spot_configurations_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spot_configurations
    ADD CONSTRAINT spot_configurations_symbol_fkey FOREIGN KEY (symbol) REFERENCES public.instruments(symbol) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict RxbrVOsoIyjzabITvFClGCCz9cCnpvcQnG3KTDLZ1PisXWpYB26Hfc9Pc3MXGer

