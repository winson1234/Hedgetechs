--
-- PostgreSQL database dump
--

\restrict Oi25Ku0cs2y90J09XhwjEfrcfrfikmSGAI6vRJqM82HCNm57sJZC9HhtEhl8Z3G

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
-- Name: pending_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_registrations (
    id bigint NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50) NOT NULL,
    hash_password text NOT NULL,
    country character varying(100) NOT NULL,
    status public.registration_status_enum DEFAULT 'pending'::public.registration_status_enum NOT NULL,
    admin_id bigint,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_registrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_registrations_id_seq OWNED BY public.pending_registrations.id;


--
-- Name: pending_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations ALTER COLUMN id SET DEFAULT nextval('public.pending_registrations_id_seq'::regclass);


--
-- Name: pending_registrations pending_registrations_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_email_key UNIQUE (email);


--
-- Name: pending_registrations pending_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_pkey PRIMARY KEY (id);


--
-- Name: idx_pending_reg_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_admin_id ON public.pending_registrations USING btree (admin_id) WHERE (admin_id IS NOT NULL);


--
-- Name: idx_pending_reg_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_created_at ON public.pending_registrations USING btree (created_at DESC);


--
-- Name: idx_pending_reg_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_email ON public.pending_registrations USING btree (email);


--
-- Name: idx_pending_reg_name_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_name_email_trgm ON public.pending_registrations USING gin (((((((first_name)::text || ' '::text) || (last_name)::text) || ' '::text) || (email)::text)) public.gin_trgm_ops);


--
-- Name: idx_pending_reg_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_status ON public.pending_registrations USING btree (status);


--
-- Name: idx_pending_reg_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_reg_status_created ON public.pending_registrations USING btree (status, created_at DESC) WHERE (status = 'pending'::public.registration_status_enum);


--
-- Name: pending_registrations trigger_pending_registrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_pending_registrations_updated_at BEFORE UPDATE ON public.pending_registrations FOR EACH ROW EXECUTE FUNCTION public.update_pending_registrations_updated_at();


--
-- PostgreSQL database dump complete
--

\unrestrict Oi25Ku0cs2y90J09XhwjEfrcfrfikmSGAI6vRJqM82HCNm57sJZC9HhtEhl8Z3G

