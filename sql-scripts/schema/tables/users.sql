--
-- PostgreSQL database dump
--

\restrict eAiYn1Pf2oQkIf6WrtUAGBkq4xNNvhTZpUabADhUmC0XYi27VieeG6EX3X5c94f

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
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    hash_password text NOT NULL,
    phone_number character varying(50) NOT NULL,
    country character varying(100) NOT NULL,
    kyc_status public.kyc_status_enum DEFAULT 'pending'::public.kyc_status_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_key UNIQUE (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_users_active_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active_created ON public.users USING btree (is_active, created_at DESC) WHERE (is_active = true);


--
-- Name: idx_users_active_kyc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active_kyc ON public.users USING btree (is_active, kyc_status);


--
-- Name: idx_users_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_country ON public.users USING btree (country) WHERE (country IS NOT NULL);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_id ON public.users USING btree (id);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_kyc_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_kyc_created ON public.users USING btree (kyc_status, created_at DESC);


--
-- Name: idx_users_kyc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_kyc_status ON public.users USING btree (kyc_status);


--
-- Name: idx_users_name_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_name_email_trgm ON public.users USING gin (((((((first_name)::text || ' '::text) || (last_name)::text) || ' '::text) || (email)::text)) public.gin_trgm_ops);


--
-- Name: users trigger_users_last_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_users_last_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_last_updated_at();


--
-- PostgreSQL database dump complete
--

\unrestrict eAiYn1Pf2oQkIf6WrtUAGBkq4xNNvhTZpUabADhUmC0XYi27VieeG6EX3X5c94f

