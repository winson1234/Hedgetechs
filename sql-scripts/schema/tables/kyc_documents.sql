--
-- PostgreSQL database dump
--

\restrict 4Z0jyzQcLTfyzX4Rxyg0Gpf5N4mHIUEzdP5ceGIoxWDBGbkKa9p0K7PmIFq80Gg

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
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kyc_documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    document_type public.kyc_document_type NOT NULL,
    file_path text NOT NULL,
    status public.kyc_status DEFAULT 'pending'::public.kyc_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- Name: idx_kyc_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kyc_documents_status ON public.kyc_documents USING btree (status);


--
-- Name: idx_kyc_documents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kyc_documents_user_id ON public.kyc_documents USING btree (user_id);


--
-- Name: kyc_documents update_kyc_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_kyc_documents_updated_at BEFORE UPDATE ON public.kyc_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- PostgreSQL database dump complete
--

\unrestrict 4Z0jyzQcLTfyzX4Rxyg0Gpf5N4mHIUEzdP5ceGIoxWDBGbkKa9p0K7PmIFq80Gg

