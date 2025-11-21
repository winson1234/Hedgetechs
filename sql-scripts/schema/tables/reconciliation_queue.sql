--
-- PostgreSQL database dump
--

\restrict T5cYnHh9SXNIgDxPaoWcCNQsRCm4vhzQpeILIoGKUoy0bJGy0j6CeyMaRju96oS

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
-- Name: reconciliation_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lp_route_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    discrepancy_details jsonb,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE reconciliation_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reconciliation_queue IS 'Queue for reconciling LP-executed orders. Background worker processes pending items
to verify fills, detect discrepancies, and ensure internal positions match LP execution.';


--
-- Name: reconciliation_queue reconciliation_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_queue
    ADD CONSTRAINT reconciliation_queue_pkey PRIMARY KEY (id);


--
-- Name: idx_reconciliation_queue_next_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconciliation_queue_next_attempt ON public.reconciliation_queue USING btree (next_attempt_at) WHERE (status = 'pending'::text);


--
-- Name: idx_reconciliation_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reconciliation_queue_status ON public.reconciliation_queue USING btree (status);


--
-- Name: reconciliation_queue reconciliation_queue_lp_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_queue
    ADD CONSTRAINT reconciliation_queue_lp_route_id_fkey FOREIGN KEY (lp_route_id) REFERENCES public.lp_routes(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict T5cYnHh9SXNIgDxPaoWcCNQsRCm4vhzQpeILIoGKUoy0bJGy0j6CeyMaRju96oS

