-- Create the profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  role text not null check (role in ('customer', 'vendor', 'admin', 'super_admin')),
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

-- Create policies for profiles
drop policy if exists "Allow public read access to profiles" on public.profiles;
create policy "Allow public read access to profiles"
  on public.profiles for select
  using (true);

drop policy if exists "Allow individual insert to own profile" on public.profiles;
create policy "Allow individual insert to own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Allow individual update to own profile" on public.profiles;
create policy "Allow individual update to own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Allow individual delete to own profile" on public.profiles;
create policy "Allow individual delete to own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- -------------------------------------------------------------
-- NEW: Locations and Service Categories Tables
-- -------------------------------------------------------------

-- Create locations (cities)
create table if not exists public.locations (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create service categories
create table if not exists public.service_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Alter profiles to add location assignment for admins
alter table public.profiles 
add column if not exists location_id uuid references public.locations(id) on delete set null;

-- Create vendor applications
create table if not exists public.vendor_applications (
  id uuid references public.profiles(id) on delete cascade primary key,
  owner_name text not null,
  category_id uuid references public.service_categories(id) on delete cascade not null,
  location_id uuid references public.locations(id) on delete cascade not null,
  detailed_address text not null,
  description text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for new tables
alter table public.locations enable row level security;
alter table public.service_categories enable row level security;
alter table public.vendor_applications enable row level security;

-- Policies for locations
drop policy if exists "Allow public read locations" on public.locations;
create policy "Allow public read locations" on public.locations for select using (true);

drop policy if exists "Allow super admin write locations" on public.locations;
create policy "Allow super admin write locations" on public.locations for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'));

-- Policies for service categories
drop policy if exists "Allow public read categories" on public.service_categories;
create policy "Allow public read categories" on public.service_categories for select using (true);

drop policy if exists "Allow super admin write categories" on public.service_categories;
create policy "Allow super admin write categories" on public.service_categories for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'));

-- Policies for vendor applications
drop policy if exists "Allow read vendor applications" on public.vendor_applications;
create policy "Allow read vendor applications" on public.vendor_applications for select
  using (
    status = 'approved' or
    auth.uid() = id or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') or
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin' and p.location_id = location_id
    )
  );

drop policy if exists "Allow insert own vendor applications" on public.vendor_applications;
create policy "Allow insert own vendor applications" on public.vendor_applications for insert
  with check (auth.uid() = id);

drop policy if exists "Allow update vendor applications status" on public.vendor_applications;
create policy "Allow update vendor applications status" on public.vendor_applications for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') or
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin' and p.location_id = location_id
    )
  );

-- -------------------------------------------------------------
-- Triggers and Functions
-- -------------------------------------------------------------

-- Create a function to handle new user registration automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, name, location_id, phone)
  values (
    new.id,
    new.email,
    case 
      when new.email = 'plugus@superadmin.com' then 'super_admin'
      else coalesce(new.raw_user_meta_data->>'role', 'customer')
    end,
    coalesce(new.raw_user_meta_data->>'name', ''),
    NULLIF(new.raw_user_meta_data->>'location_id', '')::uuid,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create a trigger that calls the function after a user is created in auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create a function to automatically upgrade approved vendor applications to vendor role
create or replace function public.handle_vendor_approval()
returns trigger as $$
begin
  if new.status = 'approved' and (old.status is null or old.status != 'approved') then
    update public.profiles
    set role = 'vendor'
    where id = new.id;
  elsif new.status = 'rejected' and (old.status is null or old.status = 'approved') then
    update public.profiles
    set role = 'customer'
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create a trigger that calls the function after a vendor application status updates
drop trigger if exists on_vendor_application_approved on public.vendor_applications;
create trigger on_vendor_application_approved
  after update on public.vendor_applications
  for each row execute procedure public.handle_vendor_approval();

-- -------------------------------------------------------------
-- Seed Data & Profile Column Adjustments
-- -------------------------------------------------------------

-- Seed default locations
insert into public.locations (name) values 
  ('Mumbai'),
  ('Delhi'),
  ('Bangalore')
on conflict (name) do nothing;

-- Seed default service categories
insert into public.service_categories (name) values 
  ('Laundry'),
  ('Electrician'),
  ('Plumbing'),
  ('Housecleaning')
on conflict (name) do nothing;

-- Add address column to profiles table if it doesn't exist
alter table public.profiles add column if not exists address text;

-- Add phone column to profiles table if it doesn't exist
alter table public.profiles add column if not exists phone text;

-- Add is_visible column to profiles if it doesn't exist
alter table public.profiles add column if not exists is_visible boolean default true;

-- Create vendor_services table
create table if not exists public.vendor_services (
  id uuid default gen_random_uuid() primary key,
  vendor_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  price numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for vendor_services
alter table public.vendor_services enable row level security;

-- Policies for vendor_services
drop policy if exists "Allow public read vendor services" on public.vendor_services;
create policy "Allow public read vendor services" on public.vendor_services for select using (true);

drop policy if exists "Allow vendor insert own services" on public.vendor_services;
create policy "Allow vendor insert own services" on public.vendor_services for insert
  with check (auth.uid() = vendor_id);

drop policy if exists "Allow vendor update own services" on public.vendor_services;
create policy "Allow vendor update own services" on public.vendor_services for update
  using (auth.uid() = vendor_id);

drop policy if exists "Allow vendor delete own services" on public.vendor_services;
create policy "Allow vendor delete own services" on public.vendor_services for delete
  using (auth.uid() = vendor_id);

-- Create bookings table
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.profiles(id) on delete cascade not null,
  service_id uuid references public.vendor_services(id) on delete cascade not null,
  customer_phone text not null,
  customer_address text not null,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'completed')) default 'pending',
  estimated_time text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for bookings
alter table public.bookings enable row level security;

-- Policies for bookings
drop policy if exists "Allow users read own bookings" on public.bookings;
create policy "Allow users read own bookings" on public.bookings for select
  using (auth.uid() = customer_id or auth.uid() = vendor_id);

drop policy if exists "Allow customer insert bookings" on public.bookings;
create policy "Allow customer insert bookings" on public.bookings for insert
  with check (auth.uid() = customer_id);

drop policy if exists "Allow update bookings status and time" on public.bookings;
create policy "Allow update bookings status and time" on public.bookings for update
  using (auth.uid() = customer_id or auth.uid() = vendor_id);

-- Add is_blocked column to profiles table if it doesn't exist
alter table public.profiles add column if not exists is_blocked boolean default false;

-- Create reviews table
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade unique not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for reviews
alter table public.reviews enable row level security;

-- Policies for reviews
drop policy if exists "Allow public read reviews" on public.reviews;
create policy "Allow public read reviews" on public.reviews for select using (true);

drop policy if exists "Allow customer insert reviews" on public.reviews;
create policy "Allow customer insert reviews" on public.reviews for insert
  with check (auth.uid() = customer_id);

-- Create complaints table
create table if not exists public.complaints (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  vendor_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  description text not null,
  status text not null check (status in ('pending', 'resolved')) default 'pending',
  admin_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for complaints
alter table public.complaints enable row level security;

-- Policies for complaints
drop policy if exists "Allow read complaints" on public.complaints;
create policy "Allow read complaints" on public.complaints for select
  using (
    auth.uid() = customer_id or
    auth.uid() = vendor_id or
    exists (
      select 1 from public.profiles p
      join public.vendor_applications v on v.id = vendor_id
      where p.id = auth.uid() and p.role = 'admin' and p.location_id = v.location_id
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );

drop policy if exists "Allow customer insert complaints" on public.complaints;
create policy "Allow customer insert complaints" on public.complaints for insert
  with check (auth.uid() = customer_id);

drop policy if exists "Allow admin update complaints" on public.complaints;
create policy "Allow admin update complaints" on public.complaints for update
  using (
    exists (
      select 1 from public.profiles p
      join public.vendor_applications v on v.id = vendor_id
      where p.id = auth.uid() and p.role = 'admin' and p.location_id = v.location_id
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );
