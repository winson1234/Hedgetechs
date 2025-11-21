-- Trading-related sequences

-- Sequence for order display numbers (ORD-#####)
CREATE SEQUENCE public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Sequence for contract display numbers (CNT-#####)
CREATE SEQUENCE public.contract_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Sequence for transaction display numbers (TXN-#####)
CREATE SEQUENCE public.transaction_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
