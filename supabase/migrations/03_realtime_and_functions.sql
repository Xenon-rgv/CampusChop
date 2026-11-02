-- CampusChop Realtime & Business Logic Verification
-- Migration 03: Realtime Publications and Order Validation

-- 1. Enable Supabase Realtime on critical tables
DO $$
BEGIN
  -- Add tables to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vendor_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_profiles;
  END IF;
END $$;

-- 2. Validate Order Status Transitions Trigger
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If order status hasn't changed, allow
  IF NEW.order_status = OLD.order_status THEN
    RETURN NEW;
  END IF;

  -- Allow administrator to override if necessary
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Valid transition checks
  CASE OLD.order_status
    WHEN 'pending' THEN
      IF NEW.order_status NOT IN ('awaiting_payment', 'confirmed', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.order_status;
      END IF;

    WHEN 'awaiting_payment' THEN
      IF NEW.order_status NOT IN ('confirmed', 'cancelled', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status transition from awaiting_payment to %', NEW.order_status;
      END IF;

    WHEN 'confirmed' THEN
      IF NEW.order_status NOT IN ('preparing', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from confirmed to %', NEW.order_status;
      END IF;

    WHEN 'preparing' THEN
      IF NEW.order_status NOT IN ('ready', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from preparing to %', NEW.order_status;
      END IF;

    WHEN 'ready' THEN
      IF NEW.order_status NOT IN ('out_for_delivery', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from ready to %', NEW.order_status;
      END IF;

    WHEN 'out_for_delivery' THEN
      IF NEW.order_status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from out_for_delivery to %', NEW.order_status;
      END IF;

    WHEN 'completed' THEN
      RAISE EXCEPTION 'Cannot modify a completed order';

    WHEN 'rejected' THEN
      RAISE EXCEPTION 'Cannot modify a rejected order';

    WHEN 'cancelled' THEN
      RAISE EXCEPTION 'Cannot modify a cancelled order';

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validate_order_status ON public.orders;
CREATE TRIGGER tr_validate_order_status
  BEFORE UPDATE OF order_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- 3. Secure Admin Promotion Helper Function
-- Run this in the Supabase SQL Editor to promote a user to administrator:
-- SELECT public.promote_user_to_admin('admin@campuschop.ng');
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = LOWER(target_email);
  IF v_user_id IS NULL THEN
    RETURN 'Error: User profile not found for email: ' || target_email;
  END IF;

  UPDATE public.profiles SET role = 'admin' WHERE id = v_user_id;
  RETURN 'Success: User ' || target_email || ' promoted to platform administrator.';
END;
$$;
