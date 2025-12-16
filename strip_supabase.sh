#!/bin/bash
# Strip Supabase-specific features from migration file

INPUT="sql-scripts/migrations/000001_initial_schema.up.sql"
OUTPUT="sql-scripts/migrations/000001_initial_schema_postgres.up.sql"

# Create PostgreSQL-compatible version
sed '
# Remove GRANT statements to authenticated role
/GRANT.*TO authenticated/d
/GRANT EXECUTE.*TO authenticated/d

# Remove RLS enable statements
/ALTER TABLE.*ENABLE ROW LEVEL SECURITY/d

# Remove all CREATE POLICY statements (multi-line)
/^CREATE POLICY/,/;$/d

# Fix users table - make id a UUID primary key instead of referencing auth.users
s/id UUID PRIMARY KEY REFERENCES auth\.users(id) ON DELETE CASCADE/id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY/

# Remove triggers and functions that reference auth.users
/CREATE TRIGGER on_auth_user_created/,/EXECUTE FUNCTION public\.handle_new_user();$/d
/CREATE TRIGGER on_public_user_deleted/,/EXECUTE FUNCTION public\.handle_user_delete();$/d
/CREATE TRIGGER on_auth_user_deleted/,/EXECUTE FUNCTION public\.handle_auth_user_delete();$/d
/CREATE OR REPLACE FUNCTION public\.handle_new_user/,/\$\$ LANGUAGE plpgsql SECURITY DEFINER;$/d
/CREATE OR REPLACE FUNCTION public\.handle_user_delete/,/\$\$ LANGUAGE plpgsql SECURITY DEFINER;$/d
/CREATE OR REPLACE FUNCTION public\.handle_auth_user_delete/,/\$\$ LANGUAGE plpgsql SECURITY DEFINER;$/d
' "$INPUT" > "$OUTPUT"

echo "Created PostgreSQL-compatible migration at: $OUTPUT"
