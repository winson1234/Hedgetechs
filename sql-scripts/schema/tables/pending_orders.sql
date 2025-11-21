--
-- PostgreSQL database dump
--

\restrict sDADshJAy2JzLgBPKIt7SSLxg7YeToqvlozi3y3tSS9jiZUT00LgUn6SZcXFOfO

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
-- Name: pending_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    symbol text NOT NULL,
    type public.order_execution_type NOT NULL,
    side public.order_side NOT NULL,
    quantity numeric(20,8) NOT NULL,
    trigger_price numeric(20,8) NOT NULL,
    limit_price numeric(20,8),
    status public.pending_order_status DEFAULT 'pending'::public.pending_order_status NOT NULL,
    executed_at timestamp with time zone,
    executed_price numeric(20,8),
    failure_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    order_number text,
    leverage integer DEFAULT 1 NOT NULL,
    product_type public.product_type DEFAULT 'spot'::public.product_type NOT NULL,
    CONSTRAINT pending_orders_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT pending_orders_trigger_price_check CHECK ((trigger_price > (0)::numeric)),
    CONSTRAINT valid_limit_price CHECK ((((type = 'limit'::public.order_execution_type) AND (limit_price IS NOT NULL)) OR (type = 'stop_limit'::public.order_execution_type)))
);


--
-- Name: TABLE pending_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.pending_orders IS 'Pending limit/stop-limit orders awaiting execution by event-driven processor';


--
-- Name: COLUMN pending_orders.trigger_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pending_orders.trigger_price IS 'Price threshold at which order should be triggered';


--
-- Name: COLUMN pending_orders.limit_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pending_orders.limit_price IS 'Maximum buy/minimum sell price for limit orders';


--
-- Name: pending_orders pending_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_orders
    ADD CONSTRAINT pending_orders_pkey PRIMARY KEY (id);


--
-- Name: idx_pending_orders_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_account_id ON public.pending_orders USING btree (account_id);


--
-- Name: idx_pending_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_created_at ON public.pending_orders USING btree (created_at DESC);


--
-- Name: idx_pending_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_order_number ON public.pending_orders USING btree (order_number);


--
-- Name: idx_pending_orders_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_product_type ON public.pending_orders USING btree (product_type);


--
-- Name: idx_pending_orders_status_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_status_symbol ON public.pending_orders USING btree (status, symbol) WHERE (status = 'pending'::public.pending_order_status);


--
-- Name: idx_pending_orders_symbol_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_symbol_status ON public.pending_orders USING btree (symbol, status) WHERE (status = 'pending'::public.pending_order_status);


--
-- Name: INDEX idx_pending_orders_symbol_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_pending_orders_symbol_status IS 'CRITICAL INDEX: Enables fast O(1) lookup for event-driven order processing';


--
-- Name: idx_pending_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_orders_user_id ON public.pending_orders USING btree (user_id);


--
-- Name: pending_orders update_pending_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pending_orders_updated_at BEFORE UPDATE ON public.pending_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--

\unrestrict sDADshJAy2JzLgBPKIt7SSLxg7YeToqvlozi3y3tSS9jiZUT00LgUn6SZcXFOfO

