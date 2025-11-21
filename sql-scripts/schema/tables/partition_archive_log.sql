--
-- PostgreSQL database dump
--

\restrict rwYudlJID3RtDBpge342JW6h5aftsrkoaZ5sqdRj78QSMqg6Cp7Sns6XO2poVaQ

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
-- Name: partition_archive_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partition_archive_log (
    id integer NOT NULL,
    partition_name text NOT NULL,
    archive_date timestamp without time zone DEFAULT now(),
    archive_location text NOT NULL,
    row_count bigint NOT NULL,
    file_size_bytes bigint,
    checksum text,
    archived_by text DEFAULT CURRENT_USER,
    status text DEFAULT 'archived'::text,
    CONSTRAINT partition_archive_log_status_check CHECK ((status = ANY (ARRAY['archived'::text, 'dropped'::text, 'failed'::text])))
);


--
-- Name: partition_archive_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partition_archive_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partition_archive_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partition_archive_log_id_seq OWNED BY public.partition_archive_log.id;


--
-- Name: partition_archive_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partition_archive_log ALTER COLUMN id SET DEFAULT nextval('public.partition_archive_log_id_seq'::regclass);


--
-- Name: partition_archive_log partition_archive_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partition_archive_log
    ADD CONSTRAINT partition_archive_log_pkey PRIMARY KEY (id);


--
-- Name: idx_partition_archive_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partition_archive_log_date ON public.partition_archive_log USING btree (archive_date DESC);


--
-- Name: idx_partition_archive_log_partition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partition_archive_log_partition ON public.partition_archive_log USING btree (partition_name);


--
-- PostgreSQL database dump complete
--

\unrestrict rwYudlJID3RtDBpge342JW6h5aftsrkoaZ5sqdRj78QSMqg6Cp7Sns6XO2poVaQ

