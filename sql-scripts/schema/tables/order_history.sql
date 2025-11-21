--
-- PostgreSQL database dump
--

\restrict iedyCbGvrm5pFtar9rSeISYpocxSjXYdRR3d4M6ey44oWqOVuXsB5CtPXLk3Uuq

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
-- Name: order_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id text NOT NULL,
    account_id uuid NOT NULL,
    symbol text NOT NULL,
    volume numeric(20,8) NOT NULL,
    type text NOT NULL,
    tp numeric(20,8),
    sl numeric(20,8),
    open_time timestamp without time zone NOT NULL,
    close_time timestamp without time zone,
    open_price numeric(20,8) NOT NULL,
    close_price numeric(20,8),
    profit numeric(20,8),
    change numeric(10,4),
    status text DEFAULT 'pending'::text,
    CONSTRAINT order_history_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'pending'::text, 'unsuccessful'::text]))),
    CONSTRAINT order_history_type_check CHECK ((type = ANY (ARRAY['buy'::text, 'sell'::text]))),
    CONSTRAINT order_history_volume_check CHECK ((volume > (0)::numeric))
);


--
-- Name: TABLE order_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_history IS 'Completed and closed trades with full lifecycle tracking';


--
-- Name: order_history order_history_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_history
    ADD CONSTRAINT order_history_order_id_key UNIQUE (order_id);


--
-- Name: order_history order_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_history
    ADD CONSTRAINT order_history_pkey PRIMARY KEY (id);


--
-- Name: idx_order_history_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_account_id ON public.order_history USING btree (account_id);


--
-- Name: idx_order_history_account_open_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_account_open_time ON public.order_history USING btree (account_id, open_time DESC);


--
-- Name: idx_order_history_close_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_close_time ON public.order_history USING btree (close_time DESC);


--
-- Name: idx_order_history_open_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_open_time ON public.order_history USING btree (open_time DESC);


--
-- Name: idx_order_history_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_order_id ON public.order_history USING btree (order_id);


--
-- Name: idx_order_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_status ON public.order_history USING btree (status);


--
-- Name: idx_order_history_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_history_symbol ON public.order_history USING btree (symbol);


--
-- PostgreSQL database dump complete
--

\unrestrict iedyCbGvrm5pFtar9rSeISYpocxSjXYdRR3d4M6ey44oWqOVuXsB5CtPXLk3Uuq

