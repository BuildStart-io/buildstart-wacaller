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
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        new_user_id, new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, 'superadmin-wacaller@buildstart.io')::jsonb, 'email', new_user_id::text, now(), now(), now()
    );

    UPDATE wacaller_customization.user_roles SET role = 'super_admin' WHERE user_id = new_user_id;
END $$;
