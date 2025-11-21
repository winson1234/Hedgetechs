-- Trigger function: Auto-delete public.users when auth.users is deleted
-- Note: This is for Supabase Auth integration. May not be needed with custom auth.

CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from public.users
    -- This ensures public records don't become orphaned
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_delete();
