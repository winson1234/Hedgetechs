-- Function to log audit events for security and compliance tracking

CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id,
        ip_address, user_agent, metadata, status, error_message
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_ip_address, p_user_agent, p_metadata, p_status, p_error_message
    ) RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
