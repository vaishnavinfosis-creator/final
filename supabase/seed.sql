-- Create 1 user per role for testing in plugus

-- First, enable pgcrypto if it isn't already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Clean up existing test users if they exist
-- This cascade-deletes their profiles and associated records (vendor applications, bookings, etc.)
DELETE FROM auth.users 
WHERE email IN (
  'plugus@superadmin.com',
  'admin@test.com',
  'vendor@test.com',
  'customer@test.com'
);

-- We need location and category IDs for admin and vendor users
DO $$
DECLARE
  v_mumbai_id uuid;
  v_laundry_id uuid;
  v_super_admin_id uuid := 'd0000000-0000-0000-0000-000000000001';
  v_admin_id uuid       := 'd0000000-0000-0000-0000-000000000002';
  v_vendor_id uuid      := 'd0000000-0000-0000-0000-000000000003';
  v_customer_id uuid    := 'd0000000-0000-0000-0000-000000000004';
  v_pass_hash text;
BEGIN
  -- Generate password hash for 'password123' using bcrypt (standard Supabase auth hash format)
  v_pass_hash := extensions.crypt('password123', extensions.gen_salt('bf', 10));

  -- Get reference IDs from seeded tables
  SELECT id INTO v_mumbai_id FROM public.locations WHERE name = 'Mumbai' LIMIT 1;
  SELECT id INTO v_laundry_id FROM public.service_categories WHERE name = 'Laundry' LIMIT 1;

  -- -------------------------------------------------------------
  -- 1. Create Super Admin User & Identity
  -- -------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_super_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'plugus@superadmin.com',
    v_pass_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"super_admin","name":"Super Admin"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_super_admin_id,
    v_super_admin_id,
    json_build_object('sub', v_super_admin_id, 'email', 'plugus@superadmin.com')::jsonb,
    'email',
    v_super_admin_id,
    now(),
    now(),
    now()
  );

  -- -------------------------------------------------------------
  -- 2. Create Admin User & Identity
  -- -------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    v_pass_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin","name":"Mumbai Admin"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_admin_id,
    v_admin_id,
    json_build_object('sub', v_admin_id, 'email', 'admin@test.com')::jsonb,
    'email',
    v_admin_id,
    now(),
    now(),
    now()
  );

  -- -------------------------------------------------------------
  -- 3. Create Vendor User & Identity
  -- -------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_vendor_id,
    '00000000-0000-0000-0000-000000000000',
    'vendor@test.com',
    v_pass_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"vendor","name":"Express Laundry Vendor"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_vendor_id,
    v_vendor_id,
    json_build_object('sub', v_vendor_id, 'email', 'vendor@test.com')::jsonb,
    'email',
    v_vendor_id,
    now(),
    now(),
    now()
  );

  -- -------------------------------------------------------------
  -- 4. Create Customer User & Identity
  -- -------------------------------------------------------------
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_customer_id,
    '00000000-0000-0000-0000-000000000000',
    'customer@test.com',
    v_pass_hash,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"customer","name":"John Customer"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_customer_id,
    v_customer_id,
    json_build_object('sub', v_customer_id, 'email', 'customer@test.com')::jsonb,
    'email',
    v_customer_id,
    now(),
    now(),
    now()
  );

  -- -------------------------------------------------------------
  -- Post-Creation Profile Updates
  -- -------------------------------------------------------------

  -- Update Admin Profile to set location_id (since trigger handle_new_user doesn't map metadata location_id)
  UPDATE public.profiles
  SET location_id = v_mumbai_id,
      address = 'Mumbai Municipal Office, Fort'
  WHERE id = v_admin_id;

  -- Update Customer Profile to add a default test address
  UPDATE public.profiles
  SET address = '123 Test Lane, Bandra, Mumbai'
  WHERE id = v_customer_id;

  -- -------------------------------------------------------------
  -- Vendor Setup (Approved Application & Services)
  -- -------------------------------------------------------------

  -- Create a vendor application as pending first
  INSERT INTO public.vendor_applications (
    id,
    owner_name,
    category_id,
    location_id,
    detailed_address,
    description,
    status
  ) VALUES (
    v_vendor_id,
    'Express Laundry Shop',
    v_laundry_id,
    v_mumbai_id,
    'Shop 12, Neon Plaza, Bandra West, Mumbai',
    'Professional laundry, dry cleaning, and steam pressing services with quick turnaround.',
    'pending'
  );

  -- Update application to 'approved' to fire on_vendor_application_approved trigger 
  -- and automatically update role to 'vendor' in public.profiles
  UPDATE public.vendor_applications
  SET status = 'approved'
  WHERE id = v_vendor_id;

  -- Seed a default service for the Vendor to make testing their dashboard/bookings easier
  INSERT INTO public.vendor_services (
    vendor_id,
    name,
    price,
    description
  ) VALUES (
    v_vendor_id,
    'Premium Wash & Fold',
    15.50,
    'Includes washing, fabric softener, tumble drying, and neat folding. Per 5kg load.'
  );

END $$;
