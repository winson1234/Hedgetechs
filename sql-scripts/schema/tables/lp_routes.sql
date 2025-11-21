--
-- PostgreSQL database dump
--

\restrict jFiBeW7I0Dxebxv3dH3RigDBZCjabChcmwFodXzwF7REzjAJFkDsfA3Pb7hBaNI

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
-- Name: lp_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lp_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    lp_provider text NOT NULL,
    lp_order_id text NOT NULL,
    lp_fill_price numeric(20,8),
    lp_fill_quantity numeric(20,8),
    lp_fee numeric(20,8),
    status text DEFAULT 'pending'::text NOT NULL,
    routed_at timestamp with time zone DEFAULT now() NOT NULL,
    filled_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lp_routes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lp_routes IS 'Tracks orders routed to external liquidity providers (A-Book execution).
Records fill details, timing, and reconciliation status.';


--
-- Name: lp_routes lp_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lp_routes
    ADD CONSTRAINT lp_routes_pkey PRIMARY KEY (id);


--
-- Name: idx_lp_routes_lp_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_routes_lp_provider ON public.lp_routes USING btree (lp_provider);


--
-- Name: idx_lp_routes_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_routes_order_id ON public.lp_routes USING btree (order_id);


--
-- Name: idx_lp_routes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lp_routes_status ON public.lp_routes USING btree (status);


--
-- Name: lp_routes lp_routes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lp_routes
    ADD CONSTRAINT lp_routes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jFiBeW7I0Dxebxv3dH3RigDBZCjabChcmwFodXzwF7REzjAJFkDsfA3Pb7hBaNI

