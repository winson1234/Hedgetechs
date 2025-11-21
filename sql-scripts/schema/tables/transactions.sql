--
-- PostgreSQL database dump
--

\restrict UgGW6MhZ6pumdHujMMe6MisPi8Ciub7WvsviRHGlaQ4BEkgFkv5WDU410cBd2DV

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
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    transaction_number text NOT NULL,
    type public.transaction_type NOT NULL,
    currency text NOT NULL,
    amount numeric(20,8) NOT NULL,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status NOT NULL,
    target_account_id uuid,
    contract_id uuid,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_transaction_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_number_key UNIQUE (transaction_number);


--
-- Name: idx_transactions_account_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_account_created ON public.transactions USING btree (account_id, created_at DESC);


--
-- Name: idx_transactions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_contract_id ON public.transactions USING btree (contract_id);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at DESC);


--
-- Name: idx_transactions_target_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_target_account_id ON public.transactions USING btree (target_account_id);


--
-- Name: idx_transactions_transaction_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_transaction_number ON public.transactions USING btree (transaction_number);


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions transactions_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict UgGW6MhZ6pumdHujMMe6MisPi8Ciub7WvsviRHGlaQ4BEkgFkv5WDU410cBd2DV

