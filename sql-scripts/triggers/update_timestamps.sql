-- Triggers to automatically update updated_at timestamps on table changes

-- Users table
CREATE TRIGGER trigger_users_last_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_last_updated_at();

-- Accounts table
CREATE TRIGGER trigger_accounts_last_updated
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_last_updated();

-- Admins table
CREATE TRIGGER trigger_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_admins_updated_at();

-- Instruments table
CREATE TRIGGER trigger_instruments_updated_at
    BEFORE UPDATE ON instruments
    FOR EACH ROW
    EXECUTE FUNCTION update_instruments_updated_at();

-- Pending registrations table
CREATE TRIGGER trigger_pending_registrations_updated_at
    BEFORE UPDATE ON pending_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_registrations_updated_at();
