-- Trigger function: Auto-delete auth.users when public.users is deleted
-- Note: This is for Supabase Auth integration. May not be needed with custom auth.

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from auth.users
    -- This ensures auth records don't become orphaned
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_public_user_deleted
    AFTER DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();
