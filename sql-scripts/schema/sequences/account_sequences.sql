-- Account-related sequences

-- Sequence for account display numbers (ACC-########)
CREATE SEQUENCE public.account_number_seq
    START WITH 10000000
    INCREMENT BY 1
    MINVALUE 10000000
    MAXVALUE 99999999
    CACHE 1;

-- Sequence for live account IDs (1000000-4999999)
CREATE SEQUENCE public.live_account_seq
    START WITH 1000000
    INCREMENT BY 1
    MINVALUE 1000000
    MAXVALUE 4999999
    CACHE 1;

-- Sequence for demo account IDs (5000000-9999999)
CREATE SEQUENCE public.demo_account_seq
    START WITH 5000000
    INCREMENT BY 1
    MINVALUE 5000000
    MAXVALUE 9999999
    CACHE 1;

-- Main accounts table ID sequence
CREATE SEQUENCE public.accounts_account_id_seq
    START WITH 5000006
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
