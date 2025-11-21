--
-- PostgreSQL database dump
--

\restrict 8wd7btvmsp4T1uAnLZfOMB0MzR7l93hbAImGgZKBP7WcBlCMIBrXYT4t3TCfrrF

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
-- Name: lp_routing_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lp_routing_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    config_value jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lp_routing_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lp_routing_config IS 'Configuration for LP routing decision engine. Supports feature flags,
thresholds, and provider selection.';


--
-- Name: lp_routing_config lp_routing_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lp_routing_config
    ADD CONSTRAINT lp_routing_config_config_key_key UNIQUE (config_key);


--
-- Name: lp_routing_config lp_routing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lp_routing_config
    ADD CONSTRAINT lp_routing_config_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict 8wd7btvmsp4T1uAnLZfOMB0MzR7l93hbAImGgZKBP7WcBlCMIBrXYT4t3TCfrrF

