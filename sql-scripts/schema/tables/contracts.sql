--
-- PostgreSQL database dump
--

\restrict Xq9TpRgL9gyaKgXXcNXn0vhE3GIUjeiSHKgx9AkGZEHgTJTvLb3JNCHniR5jTJr

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
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    symbol text NOT NULL,
    contract_number text NOT NULL,
    side public.contract_side NOT NULL,
    status public.contract_status DEFAULT 'open'::public.contract_status NOT NULL,
    lot_size numeric(20,8) NOT NULL,
    entry_price numeric(20,8) NOT NULL,
    margin_used numeric(20,8) NOT NULL,
    leverage integer DEFAULT 1,
    tp_price numeric(20,8),
    sl_price numeric(20,8),
    close_price numeric(20,8),
    pnl numeric(20,8),
    swap numeric(20,8) DEFAULT 0,
    commission numeric(20,8) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    liquidation_price numeric(20,8),
    pair_id uuid
);


--
-- Name: COLUMN contracts.pair_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contracts.pair_id IS 'Links two contracts that were opened as a hedged pair (dual-position).
Both the long and short positions will share the same pair_id.
NULL for non-hedged positions.';


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: idx_contracts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_account_id ON public.contracts USING btree (account_id);


--
-- Name: idx_contracts_contract_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_contract_number ON public.contracts USING btree (contract_number);


--
-- Name: idx_contracts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_created_at ON public.contracts USING btree (created_at DESC);


--
-- Name: idx_contracts_pair_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_pair_id ON public.contracts USING btree (pair_id) WHERE (pair_id IS NOT NULL);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);


--
-- Name: idx_contracts_status_side; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_status_side ON public.contracts USING btree (status, side) WHERE (status = 'open'::public.contract_status);


--
-- Name: idx_contracts_symbol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_symbol ON public.contracts USING btree (symbol);


--
-- Name: idx_contracts_symbol_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_symbol_status ON public.contracts USING btree (symbol, status) WHERE (status = 'open'::public.contract_status);


--
-- Name: idx_contracts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_user_id ON public.contracts USING btree (user_id);


--
-- Name: contracts update_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contracts contracts_symbol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_symbol_fkey FOREIGN KEY (symbol) REFERENCES public.instruments1(symbol);


--
-- PostgreSQL database dump complete
--

\unrestrict Xq9TpRgL9gyaKgXXcNXn0vhE3GIUjeiSHKgx9AkGZEHgTJTvLb3JNCHniR5jTJr

