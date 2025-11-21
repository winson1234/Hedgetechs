--
-- PostgreSQL database dump
--

\restrict 8KSNJm0neePB2plghdFetC5Uef9ejbhlF7PgaIatSeawcmXVHFvynZrWBlucDRQ

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
-- Name: balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balances (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    currency text NOT NULL,
    amount numeric(20,8) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: balances balances_account_id_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_account_id_currency_key UNIQUE (account_id, currency);


--
-- Name: balances balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_pkey PRIMARY KEY (id);


--
-- Name: idx_balances_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balances_account_id ON public.balances USING btree (account_id);


--
-- Name: balances trigger_sync_account_balance_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_account_balance_insert AFTER INSERT ON public.balances FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();


--
-- Name: balances trigger_sync_account_balance_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_account_balance_update AFTER UPDATE ON public.balances FOR EACH ROW WHEN ((old.amount IS DISTINCT FROM new.amount)) EXECUTE FUNCTION public.sync_account_balance();


--
-- Name: balances update_balances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON public.balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--

\unrestrict 8KSNJm0neePB2plghdFetC5Uef9ejbhlF7PgaIatSeawcmXVHFvynZrWBlucDRQ

