-- ============================================================================
-- CAMPUSCHOP SEED DATA (DELSU Abraka Food Marketplace)
-- ============================================================================

-- 1. SEED FOOD CATEGORIES
INSERT INTO public.categories (name, slug, description, icon, image_url, display_order)
VALUES
  (
    'Rice & Meals',
    'rice-and-meals',
    'Smoky DELSU campus party jollof, fried rice, coconut rice and native stew specials.',
    'bowl-food',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    1
  ),
  (
    'Swallow & Soups',
    'swallow-and-soups',
    'Authentic Delta Banga soup, rich Egusi, Ogbono with hot Pounded Yam, Eba or Semo.',
    'pot',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
    2
  ),
  (
    'Grills & Suya',
    'grills-and-suya',
    'Sizzling Abraka beef suya, spicy asun, grilled catfish point & kill, peppered wings.',
    'flame',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    3
  ),
  (
    'Fast Food & Shawarma',
    'fast-food',
    'Loaded beef and chicken shawarma, crispy burgers, french fries and chicken combos.',
    'sandwich',
    'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80',
    4
  ),
  (
    'Snacks & Pastries',
    'snacks-and-pastries',
    'Flaky meat pies, golden puff puff, sausage rolls, scotch eggs and sweet snacks.',
    'cookie',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    5
  ),
  (
    'Breakfast & Combos',
    'breakfast-and-combos',
    'Student saver Indomie specials, spicy fried egg, akara with custard and tea combos.',
    'coffee',
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
    6
  ),
  (
    'Drinks & Beverages',
    'drinks-and-beverages',
    'Cold natural Zobo with cloves and pineapple, freshly squeezed juices, malt and soda.',
    'cup-soda',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    7
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  image_url = EXCLUDED.image_url,
  display_order = EXCLUDED.display_order;


-- 2. SEED DELSU ABRAKA DELIVERY ZONES
INSERT INTO public.delivery_zones (name, description, fee, estimated_delivery_minutes, is_active)
VALUES
  (
    'DELSU Site 1 (Old Campus)',
    'Convocation arena, administrative buildings, and surrounding student hostels.',
    300.00,
    25,
    true
  ),
  (
    'DELSU Site 2 (Arts & Social Sciences)',
    'Faculty of Arts, Social Sciences, Abraka Hall, and nearby off-campus lodges.',
    350.00,
    30,
    true
  ),
  (
    'DELSU Site 3 (Main / Permanent Site)',
    'Faculties of Science, Engineering, Law, College of Health Sciences, and New Hostels.',
    400.00,
    35,
    true
  ),
  (
    'Abraka Express & Campus Gate',
    'Main highway junction, commercial motor park, and campus main gate area.',
    300.00,
    20,
    true
  ),
  (
    'Hospital Road & Police Station Axis',
    'General Hospital road, Police station quarters, and surrounding residential communities.',
    400.00,
    35,
    true
  ),
  (
    'Staff Quarters & Urhuoka Town',
    'University Senior Staff Quarters, Urhuoka primary school axis and student lodges.',
    450.00,
    40,
    true
  ),
  (
    'Ekrejeta Junction & College Road',
    'Ekrejeta market area, College road lodges and private student accommodations.',
    500.00,
    45,
    true
  ),
  (
    'Ethiope River Resort & Motel Axis',
    'River Ethiope hotels, tourist spots, and outer Abraka student residential zones.',
    600.00,
    50,
    true
  );

-- ============================================================================
-- NOTE ON VENDOR & USER SEEDING:
-- In Supabase, users must be registered via Supabase Auth (or Supabase Auth Admin API)
-- so their passwords are cryptographically hashed.
--
-- To create an Administrator:
-- 1. Register a user in the CampusChop signup page (e.g., admin@campuschop.ng).
-- 2. In your Supabase SQL Editor, run:
--    SELECT public.promote_user_to_admin('admin@campuschop.ng');
--
-- To test as a Vendor:
-- 1. Register a user in the CampusChop signup page (e.g., vendor@delsuchop.com).
-- 2. On the website, click "Become a Vendor" and submit the vendor application.
-- 3. Log in as the Admin on /admin-dashboard.html and click "Approve".
-- ============================================================================
