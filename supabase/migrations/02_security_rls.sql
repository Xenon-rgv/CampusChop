-- CampusChop Security & Row Level Security (RLS)
-- Migration 02: Helper Functions, Auth Triggers, and RLS Policies

-- 1. Helper function: Check if current user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Helper function: Get current user's vendor_id
CREATE OR REPLACE FUNCTION public.get_my_vendor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendor_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 3. Automatic Profile Creation Trigger on Sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_role TEXT;
BEGIN
  -- Extract full name from raw_user_meta_data or fallback to email prefix
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Always default role to customer to prevent unauthorized privilege escalation
  v_role := 'customer';

  INSERT INTO public.profiles (id, full_name, email, phone, role, avatar_url)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_role,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Prevent Non-Admins From Elevating Their Own Role
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is changing, ensure caller is an admin
  IF NEW.role <> OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only an administrator can modify user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_role_escalation ON public.profiles;
CREATE TRIGGER tr_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Any authenticated user can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Users can view vendor owner profiles (for storefront info)
CREATE POLICY "Public can view basic vendor user info"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (
    id IN (SELECT user_id FROM public.vendor_profiles WHERE status = 'approved')
  );

-- Users can update their own permitted profile fields
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Admins can manage all profiles
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- VENDOR PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Public can view approved vendors
CREATE POLICY "Public can view approved vendors"
  ON public.vendor_profiles FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Owners can view their own vendor profile (any status)
CREATE POLICY "Owners can view own vendor profile"
  ON public.vendor_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Authenticated users can register as a vendor (pending status)
CREATE POLICY "Users can submit vendor application"
  ON public.vendor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    status = 'pending'
  );

-- Vendor owners can update their operational details (not status or rejection)
CREATE POLICY "Vendors can update own profile details"
  ON public.vendor_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    (user_id = auth.uid() AND status = (SELECT vp.status FROM public.vendor_profiles vp WHERE vp.id = vendor_profiles.id))
    OR public.is_admin()
  );

-- Admins can update any vendor profile (e.g., status changes)
CREATE POLICY "Admins can manage vendor profiles"
  ON public.vendor_profiles FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- CATEGORIES POLICIES
-- ----------------------------------------------------------------------------
-- Anyone can read categories
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can modify categories
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- DELIVERY ZONES POLICIES
-- ----------------------------------------------------------------------------
-- Anyone can view active delivery zones
CREATE POLICY "Anyone can view active delivery zones"
  ON public.delivery_zones FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

-- Admins can manage delivery zones
CREATE POLICY "Admins can manage delivery zones"
  ON public.delivery_zones FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- ----------------------------------------------------------------------------
-- Public can view available products from approved vendors
CREATE POLICY "Public can view available products of approved vendors"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles WHERE status = 'approved'
    )
  );

-- Vendors can view all their own products
CREATE POLICY "Vendors can view own products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- Approved vendors can insert products for their vendor profile
CREATE POLICY "Approved vendors can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.is_admin()
  );

-- Approved vendors can update their own products
CREATE POLICY "Approved vendors can update own products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.is_admin()
  );

-- Approved vendors can delete their own products
CREATE POLICY "Approved vendors can delete own products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles
      WHERE user_id = auth.uid() AND status = 'approved'
    )
    OR public.is_admin()
  );

-- Admins can manage all products
CREATE POLICY "Admins have full access to products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- ORDERS POLICIES
-- ----------------------------------------------------------------------------
-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Vendors can view orders placed with their business
CREATE POLICY "Vendors can view their incoming orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Customers can insert orders for themselves
CREATE POLICY "Customers can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() AND
    vendor_id IN (SELECT id FROM public.vendor_profiles WHERE status = 'approved')
  );

-- Vendors can update order status for their orders
CREATE POLICY "Vendors can update order status for their store"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Customers can cancel their own pending/unpaid orders
CREATE POLICY "Customers can cancel pending orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid() AND
    order_status IN ('pending', 'awaiting_payment')
  )
  WITH CHECK (
    customer_id = auth.uid() AND
    order_status = 'cancelled'
  );

-- Admins have full access to orders
CREATE POLICY "Admins can manage orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- ORDER ITEMS POLICIES
-- ----------------------------------------------------------------------------
-- Customers can view order items for their own orders
CREATE POLICY "Customers can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
  );

-- Vendors can view order items for orders placed with their business
CREATE POLICY "Vendors can view order items for their orders"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.vendor_profiles vp ON o.vendor_id = vp.id
      WHERE vp.user_id = auth.uid()
    )
  );

-- Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Customers can insert order items when creating their order
CREATE POLICY "Customers can insert items for their orders"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
  );

-- Admins have full access to order items
CREATE POLICY "Admins can manage order items"
  ON public.order_items FOR ALL
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- ----------------------------------------------------------------------------
-- Customers can view their own payments
CREATE POLICY "Customers can view own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Vendors can view payment status for their orders
CREATE POLICY "Vendors can view payments for their orders"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.vendor_profiles vp ON o.vendor_id = vp.id
      WHERE vp.user_id = auth.uid()
    )
  );

-- Admins can view and manage all payments
CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Customers can initiate payment records
CREATE POLICY "Customers can initiate payment"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() AND
    status = 'pending'
  );


-- ============================================================================
-- STORAGE CONFIGURATION (food-images bucket)
-- ============================================================================

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-images',
  'food-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage bucket RLS Policies
DROP POLICY IF EXISTS "Public can view food images" ON storage.objects;
CREATE POLICY "Public can view food images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'food-images');

DROP POLICY IF EXISTS "Approved vendors can upload food images" ON storage.objects;
CREATE POLICY "Approved vendors can upload food images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'food-images' AND
    (
      EXISTS (
        SELECT 1 FROM public.vendor_profiles
        WHERE user_id = auth.uid()
      )
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Vendors can delete own uploaded images" ON storage.objects;
CREATE POLICY "Vendors can delete own uploaded images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'food-images' AND
    (
      owner = auth.uid()
      OR public.is_admin()
    )
  );
