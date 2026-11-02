# 🍲 CampusChop — DELSU Abraka Multi-Vendor Food Marketplace

> **"Good food. Less stress."**

CampusChop is a production-minded multi-vendor food ordering web application designed specifically for Delta State University (DELSU) students, staff, and the surrounding community in Abraka, Delta State, Nigeria.

The platform connects local food restaurants, eateries, and independent food vendors across DELSU Site 1, Site 2, Site 3, and Abraka town with hungry students through one unified digital marketplace.

---

## 🌟 Key Features

### 🎓 1. Customer / Student Experience
- **Vendor & Food Discovery**: Browse approved campus food vendors and filter dishes by category (Party Jollof & Rice, Swallow & Soups, Fast Food & Shawarma, Grills & Suya, Pastries, Breakfast, Cold Drinks).
- **Single-Vendor Cart Rule with Conflict Resolution**: In adherence to campus delivery logistics, orders are placed from one vendor at a time. Adding items from another vendor triggers an intelligent replacement modal.
- **DELSU Campus Delivery & Pickup**: Select between direct counter pickup or doorstep delivery to DELSU hostels, faculties, and off-campus lodges (Site 1, Site 2, Site 3, Express Gate, Hospital Road, Staff Quarters, Ekrejeta).
- **Flexible Payment Options**:
  - **Online Payment**: Paystack integration via Supabase Edge Functions (Debit card, Bank Transfer, USSD).
  - **Cash on Fulfilment**: Cash on delivery or cash on pickup.
- **Real-Time Order Tracking**: Visual 6-step progress stepper updated in real-time via Supabase Realtime without page reloads.

### 🏪 2. Vendor Portal
- **Onboarding & Approval**: Public vendor registration with `pending` status. Vendors cannot publish products or take orders until verified by platform administrators.
- **Menu Management**: Add, edit, and delete food items with Nigerian Naira (₦) pricing, preparation time, and availability toggles (In Stock vs. Sold Out).
- **Food Photography**: Upload high-resolution food images directly to the Supabase Storage `food-images` bucket.
- **Live Order Fulfillment**: Real-time incoming order notifications, order acceptance/rejection (with reason), and status lifecycle progression: `confirmed` ➔ `preparing` ➔ `ready` ➔ `out_for_delivery` ➔ `completed`.
- **Payment Reconciliation**: One-click confirmation for cash receipt on cash orders.

### ⚙️ 3. Platform Administrator Portal
- **Protected Access**: Admin role enforced strictly by PostgreSQL database Row Level Security (`profiles.role = 'admin'`).
- **Vendor Approval Workflow**: Review business details, Abraka location, contact info, and approve, reject, or suspend vendor stores.
- **Live Order Oversight**: Full platform-wide visibility across all orders, vendors, and delivery statuses.
- **Delivery Zone Management**: Configure campus delivery zones, fee schedules, and estimated delivery times.
- **Category Taxonomy**: Database-driven food categories management.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom African Food Marketplace Design System), Vanilla JavaScript (ES6+ Modules).
- **Build & Dev Tool**: [Vite](https://vitejs.dev/) (Lightweight development server and multi-page production bundler).
- **Backend & Database**: [Supabase](https://supabase.com/)
  - Supabase PostgreSQL Database with UUIDs & indexes
  - Supabase Authentication (Email & Password)
  - Supabase Storage (5MB image upload bucket for food photos)
  - Supabase Realtime (WebSockets for live order updates)
  - Supabase Edge Functions (Deno / TypeScript for Paystack transactions)
- **Client Library**: `@supabase/supabase-js` v2
- **Deployment**: Vercel (Frontend) + Supabase (Backend infrastructure)

---

## 📂 Project Architecture

```text
CampusChop/
├── index.html                   # Public homepage (Hero, Categories, Vendors, Popular Meals)
├── marketplace.html             # Food discovery & search with dual meals/vendor view
├── vendor.html                  # Vendor storefront & restaurant menu
├── cart.html                    # Shopping cart with delivery/pickup fee calculator
├── checkout.html                # Delivery zone selection & payment choice
├── orders.html                  # Live real-time order tracking & order history
├── login.html                   # Universal sign-in with role-based routing
├── register.html                # Customer registration & vendor onboarding application
├── vendor-dashboard.html        # Vendor overview, menu CRUD, and order management
├── admin-dashboard.html         # Admin vendor approval, orders, delivery zones, categories
│
├── css/
│   ├── style.css                # Core design system tokens, navbar, footer, modals, badges
│   ├── auth.css                 # Auth cards, role switcher, input styles
│   ├── marketplace.css          # Product cards, vendor cards, cart layouts, filters
│   ├── dashboard.css            # Sidebar navigation, stats cards, data tables
│   └── responsive.css           # Mobile drawer, bottom navigation bar
│
├── js/
│   ├── config/
│   │   └── supabase.js          # Supabase client resolver (.env + runtime configuration)
│   ├── services/
│   │   ├── auth.service.js      # Auth, profiles, and role guards
│   │   ├── vendors.service.js   # Vendor queries, onboarding and approvals
│   │   ├── products.service.js  # Menu CRUD, availability toggles, categories
│   │   ├── orders.service.js    # Order lifecycle & Supabase Realtime subscriptions
│   │   ├── zones.service.js     # DELSU Abraka delivery zones and fees
│   │   ├── payments.service.js  # Paystack Edge Function caller
│   │   └── storage.service.js   # Supabase Storage image uploader
│   ├── components/
│   │   ├── navbar.js            # Dynamic role-aware navigation bar & live cart badge
│   │   ├── footer.js            # Campus footer with DELSU Abraka student helpdesk
│   │   └── conflict-modal.js    # Single-vendor cart conflict modal
│   ├── pages/
│   │   ├── home.js              # Homepage controller
│   │   ├── marketplace.js       # Marketplace discovery controller
│   │   ├── vendor.js            # Storefront controller
│   │   ├── cart.js              # Cart & delivery calculator controller
│   │   ├── checkout.js          # Checkout & payment controller
│   │   ├── orders.js            # Customer orders & realtime tracker controller
│   │   ├── login.js             # Login controller
│   │   ├── register.js          # Register controller
│   │   ├── vendor-dashboard.js  # Vendor dashboard controller
│   │   └── admin-dashboard.js   # Admin dashboard controller
│   └── utils/
│       ├── cart.js              # Authoritative local cart store with vendor isolation
│       ├── helpers.js           # Currency formatting (₦), dates, badges
│       └── toast.js             # Toast notification system
│
├── supabase/
│   ├── migrations/
│   │   ├── 01_initial_schema.sql          # Tables, constraints, timestamps, indexes
│   │   ├── 02_security_rls.sql             # Row Level Security policies & storage bucket
│   │   └── 03_realtime_and_functions.sql   # Realtime publications & order validation
│   ├── functions/
│   │   ├── paystack-initialize/index.ts   # Edge function to initialize Paystack transactions
│   │   └── paystack-verify/index.ts       # Edge function to verify payments with Service Role
│   └── seed.sql                           # Categories, DELSU Abraka delivery zones
│
├── .env.example                 # Frontend public environment template
├── .gitignore                   # Ignored files
├── package.json                 # Project dependencies & build scripts
├── vercel.json                  # Vercel deployment configuration
├── vite.config.js               # Multi-page build configuration
└── README.md                    # Project documentation
```

---

## 🚀 Setup & Local Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- A free [Supabase](https://supabase.com/) account

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/your-username/campuschop.git
cd campuschop
npm install
```

### 3. Configure Frontend Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Paystack public key for frontend checkout fallback
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** The frontend application also includes a convenient **Live Supabase Credentials Setup Modal** accessible via the top configuration banner. This allows you or reviewers to paste credentials directly in the browser and test instantly without restarting servers.

---

## 🗄️ Supabase Database & Security Setup

### 1. Execute SQL Migrations
In your Supabase project dashboard, navigate to the **SQL Editor** and run the migration files in numerical sequence:

1. **`supabase/migrations/01_initial_schema.sql`**
   - Creates `profiles`, `vendor_profiles`, `categories`, `delivery_zones`, `products`, `orders`, `order_items`, and `payments` tables with constraints, UUID keys, and update triggers.
2. **`supabase/migrations/02_security_rls.sql`**
   - Configures `is_admin()` helper function.
   - Attaches `handle_new_user()` auth trigger to automatically create customer profiles on registration.
   - Enforces strict Row Level Security (RLS) on all 8 tables.
   - Sets up the `food-images` storage bucket and access policies.
3. **`supabase/migrations/03_realtime_and_functions.sql`**
   - Adds `orders`, `order_items`, and `vendor_profiles` to the `supabase_realtime` publication.
   - Implements database-level order status transition validation.
   - Creates the `promote_user_to_admin(email)` helper function.

### 2. Run Seed Data
In the **SQL Editor**, run:
- **`supabase/seed.sql`**
  - Seeds 7 authentic food categories (Party Jollof, Delta Banga/Egusi, Shawarma, Suya, Snacks, Breakfast, Drinks).
  - Seeds 8 specific DELSU Abraka delivery zones (Site 1, Site 2, Site 3, Express Gate, Hospital Road, Staff Quarters, Ekrejeta, Ethiope Resort).

### 3. Create the First Platform Administrator
To uphold strict security, administrator accounts can never be created via ordinary public registration.
1. Sign up a new account on the CampusChop registration page (e.g. `admin@campuschop.ng`).
2. In your Supabase **SQL Editor**, execute:
   ```sql
   SELECT public.promote_user_to_admin('admin@campuschop.ng');
   ```
3. Log in with this account. You will automatically have access to `/admin-dashboard.html`.

---

## 💳 Paystack & Supabase Edge Functions Setup

CampusChop utilizes Supabase Edge Functions to ensure sensitive Paystack secret keys and Supabase Service Role keys are never exposed to the browser.

### 1. Set Edge Function Secrets
Using the Supabase CLI:
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Deploy Edge Functions
Deploy both functions to your Supabase project:
```bash
supabase functions deploy paystack-initialize --no-verify-jwt
supabase functions deploy paystack-verify --no-verify-jwt
```

### 3. Verification Safeguards
- The Edge Function validates that the transaction amount in Kobo matches the exact database order total to prevent client-side amount tampering.
- Duplicate verifications are rejected gracefully.
- The order status updates to `confirmed` and payment status to `paid` via the Supabase Service Role client upon verification.

---

## 🏃 Running Locally

### Development Server:
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### Production Preview:
```bash
npm run build
npm run preview
```
Open [http://localhost:4173/](http://localhost:4173/) in your browser.

---

## 🌐 Deploying to Vercel

1. Push your code to a GitHub or GitLab repository.
2. In your [Vercel Dashboard](https://vercel.com/), click **Add New Project** and import the repository.
3. Vercel automatically detects the Vite configuration and `vercel.json`.
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
   - `VITE_PAYSTACK_PUBLIC_KEY`: (Optional) Your Paystack Public Key.
5. Click **Deploy**. Vercel will bundle all 10 pages and deploy to a global edge CDN.

---

## 🧪 Acceptance Testing Guide

### 1. Customer Flow
1. Register a new account on `/register.html`.
2. Browse approved vendors and meals on `/marketplace.html`.
3. Add food to cart. Test adding from another vendor to confirm the **single-vendor conflict dialog** pops up.
4. Go to `/cart.html`, switch between Delivery and Pickup, and verify the fee calculation updates.
5. Proceed to `/checkout.html`, enter a DELSU hostel address, choose Cash on Delivery, and place the order.
6. Observe redirection to `/orders.html?orderId=...` and verify the live 6-step status stepper.

### 2. Vendor Flow
1. Click "Become a Vendor" or navigate to `/register.html?role=vendor`.
2. Fill out the vendor application form for a local Abraka food business.
3. Observe the `pending` approval status banner.
4. Once approved by the admin, log in to `/vendor-dashboard.html`.
5. Add a new food item with price, category, and photo. Toggle its availability.
6. Receive incoming orders in real time. Accept, prepare, and mark as ready/dispatched.

### 3. Admin Flow
1. Log in with an admin account (promoted via `promote_user_to_admin`).
2. Navigate to `/admin-dashboard.html`.
3. View pending vendor applications and click **Approve**.
4. Monitor all platform orders and payment records.
5. Edit delivery fees for DELSU Site 1, 2, or 3.

---

## 📄 License

Built for Delta State University (DELSU) Abraka campus community. Open-source under the MIT License.
