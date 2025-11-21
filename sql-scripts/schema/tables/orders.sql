--
-- PostgreSQL database dump
--

\restrict CWiJZY16TTgLuDFZr8XI12b3CplgGoeaAJNVMazPYqEEh0TCcWB2rNLrI2IemwH

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
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    symbol text NOT NULL,
    order_number text NOT NULL,
    side public.order_side NOT NULL,
    type public.order_type NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    amount_base numeric(20,8) NOT NULL,
    limit_price numeric(20,8),
    stop_price numeric(20,8),
    filled_amount numeric(20,8) DEFAULT 0,
    average_fill_price numeric(20,8),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    leverage integer DEFAULT 1 NOT NULL,
    product_type public.product_type DEFAULT 'spot'::public.product_type NOT NULL,
    execution_strategy public.execution_strategy DEFAULT 'b_book'::public.execution_strategy NOT NULL
);


--
-- Name: COLUMN orders.execution_strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.execution_strategy IS 'Execution routing strategy:
- b_book: Executed internally (default)
- a_book: Routed to external liquidity provider';


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: idx_orders_account_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_account_created ON public.orders USING btree (account_id, created_at DESC);


--
-- Name: idx_orders_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_account_id ON public.orders USING btree (account_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_execution_strategy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_execution_strategy ON public.orders USING btree (execution_strategy);


--
-- Name: idx_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: idx_orders_product_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_product_type ON public.orders USING btree (product_type);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_symbol ON public.orders USING btree (symbol);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders orders_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_symbol_fkey FOREIGN KEY (symbol) REFERENCES public.instruments1(symbol);


--
-- PostgreSQL database dump complete
--

\unrestrict CWiJZY16TTgLuDFZr8XI12b3CplgGoeaAJNVMazPYqEEh0TCcWB2rNLrI2IemwH

