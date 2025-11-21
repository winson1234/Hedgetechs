--
-- PostgreSQL database dump
--

\restrict xAqgV9qfiIfxkVf4BQrrfMmkKb38ONucCj1Incb3pBWhMOINgRlbYUgWelRkcYS

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
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_type public.account_type_enum NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    balance numeric(20,2) DEFAULT 0.00 NOT NULL,
    status public.account_status_enum DEFAULT 'active'::public.account_status_enum NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    account_id bigint DEFAULT nextval('public.accounts_account_id_seq'::regclass) NOT NULL,
    CONSTRAINT accounts_balance_check CHECK ((balance >= (0)::numeric))
);


--
-- Name: TABLE accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.accounts IS 'User trading accounts (live and demo)';


--
-- Name: COLUMN accounts.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.id IS 'UUID primary key (internal use)';


--
-- Name: COLUMN accounts.account_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.account_type IS 'Account type: live or demo';


--
-- Name: COLUMN accounts.currency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.currency IS 'Account currency (USD only for now)';


--
-- Name: COLUMN accounts.balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.balance IS 'Account balance with 8 decimal precision to match balances table';


--
-- Name: COLUMN accounts.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.status IS 'Account status: active or deactivated';


--
-- Name: COLUMN accounts.account_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.account_id IS 'Auto-incrementing account number (bigint)';


--
-- Name: accounts accounts_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_account_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_account_type ON public.accounts USING btree (account_type);


--
-- Name: idx_accounts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_created_at ON public.accounts USING btree (created_at DESC);


--
-- Name: idx_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_status ON public.accounts USING btree (status);


--
-- Name: idx_accounts_status_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_status_type ON public.accounts USING btree (status, account_type);


--
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);


--
-- Name: idx_accounts_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_user_status ON public.accounts USING btree (user_id, status);


--
-- Name: idx_accounts_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_user_type ON public.accounts USING btree (user_id, account_type);


--
-- Name: accounts trigger_update_accounts_last_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_accounts_last_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_accounts_last_updated();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict xAqgV9qfiIfxkVf4BQrrfMmkKb38ONucCj1Incb3pBWhMOINgRlbYUgWelRkcYS

