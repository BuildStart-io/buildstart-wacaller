#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "DROP SCHEMA IF EXISTS wacaller_customization CASCADE;"
docker exec supabase-db pg_dump -U postgres -d postgres --schema=public -s -O -x > public_schema.sql
sed -i 's/CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS wacaller_customization;/g' public_schema.sql
sed -i 's/ALTER SCHEMA public OWNER TO postgres;/\n/g' public_schema.sql
sed -i 's/SET search_path = public, pg_catalog;/SET search_path = wacaller_customization, pg_catalog;/g' public_schema.sql
sed -i 's/ public\./ wacaller_customization\./g' public_schema.sql
sed -i 's/public\.plan_tier/wacaller_customization.plan_tier/g' public_schema.sql
sed -i 's/public\.app_role/wacaller_customization.app_role/g' public_schema.sql
sed -i 's/public\.has_role/wacaller_customization.has_role/g' public_schema.sql
sed -i "s/'free'::public.plan_tier/'free'::wacaller_customization.plan_tier/g" public_schema.sql
sed -i "s/'staff'::public.app_role/'staff'::wacaller_customization.app_role/g" public_schema.sql
sed -i 's/public\.is_admin/wacaller_customization.is_admin/g' public_schema.sql
sed -i 's/public\.is_staff_of/wacaller_customization.is_staff_of/g' public_schema.sql

# Create schema and tables
docker exec -i supabase-db psql -U postgres -d postgres < public_schema.sql

# Add broadcast tables
docker exec -i supabase-db psql -U postgres -d postgres < 06_add_broadcast_campaigns.sql

# Create triggers for auth.users
cat << 'EOF' > create_triggers_wacaller.sql
DROP TRIGGER IF EXISTS on_auth_user_created_wacaller ON auth.users;
CREATE TRIGGER on_auth_user_created_wacaller
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION wacaller_customization.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_role_wacaller ON auth.users;
CREATE TRIGGER on_auth_user_created_role_wacaller
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION wacaller_customization.handle_new_user_role();

DROP TRIGGER IF EXISTS on_auth_user_created_settings_wacaller ON auth.users;
CREATE TRIGGER on_auth_user_created_settings_wacaller
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION wacaller_customization.handle_new_user_settings();
EOF

docker exec -i supabase-db psql -U postgres -d postgres < create_triggers_wacaller.sql

# Create superadmin
cat << 'EOF' > create_superadmin_wacaller.sql
DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, recovery_sent_at, last_sign_in_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'superadmin-wacaller@buildstart.io', 
        crypt('ZdtY^978uWMG2T', gen_salt('bf')), 
        now(), now(), now(), 
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), 
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        new_user_id, new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, 'superadmin-wacaller@buildstart.io')::jsonb, 'email', now(), now(), now()
    );

    UPDATE wacaller_customization.business_accounts SET is_superadmin = true WHERE id = new_user_id;
END $$;
EOF

docker exec -i supabase-db psql -U postgres -d postgres < create_superadmin_wacaller.sql

