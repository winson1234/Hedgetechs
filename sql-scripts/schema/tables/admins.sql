--
-- PostgreSQL database dump
--

\restrict rZuwuM2pNlYdaKWyot5hRQM3G1YSWka0tYdaKWlcnFt5mxcjpCbtaZhumS4PbSn

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
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    admin_id bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50),
    hash_password character varying(255) NOT NULL,
    role public.admin_role_enum DEFAULT 'admin'::public.admin_role_enum NOT NULL,
    last_login timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admins_admin_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_admin_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_admin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_admin_id_seq OWNED BY public.admins.admin_id;


--
-- Name: admins admin_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN admin_id SET DEFAULT nextval('public.admins_admin_id_seq'::regclass);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_id_key UNIQUE (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (admin_id);


--
-- Name: admins admins_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_username_key UNIQUE (username);


--
-- Name: idx_admins_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_created_at ON public.admins USING btree (created_at DESC);


--
-- Name: idx_admins_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_email ON public.admins USING btree (email);


--
-- Name: idx_admins_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_id ON public.admins USING btree (id);


--
-- Name: idx_admins_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_is_active ON public.admins USING btree (is_active);


--
-- Name: idx_admins_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_role ON public.admins USING btree (role);


--
-- Name: idx_admins_role_active_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_role_active_created ON public.admins USING btree (role, is_active, created_at DESC);


--
-- Name: idx_admins_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_username ON public.admins USING btree (username);


--
-- Name: idx_admins_username_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admins_username_email_trgm ON public.admins USING gin (((((username)::text || ' '::text) || (email)::text)) public.gin_trgm_ops);


--
-- Name: admins trigger_admins_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_admins_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_admins_updated_at();


--
-- PostgreSQL database dump complete
--

\unrestrict rZuwuM2pNlYdaKWyot5hRQM3G1YSWka0tYdaKWlcnFt5mxcjpCbtaZhumS4PbSn

