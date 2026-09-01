# Database setup for admin & API features

**Who this is for:** Developers deploying SENDO-BACKEND on Supabase.

**Plain summary:** Sendo stores data in **Supabase (PostgreSQL)**. SQL files in `supabase/migrations/` create and update tables. Run them on your Supabase project before the admin dashboard and API will work fully.

**Easier guides:** [Backend docs index](../../docs/README.md) · [Backend README](../../README.md)

---

## Quick apply (recommended)

Apply **`202608280001_admin_endpoints_support.sql`** once on Supabase (SQL editor or `supabase db push`). It is idempotent and covers every schema gap for the wired admin create flows.

For **contact numbers and surge pricing**, also apply **`202609010001_utility.sql`** (see [migration list](#migration-files-run-order-if-applying-manually) below).

## Apply

```bash
# Option A — Supabase CLI (from SENDO-BACKEND)
supabase db push

# Option B — paste into Supabase SQL editor
# File: supabase/migrations/202608280001_admin_endpoints_support.sql
```

Verify:

```sql
SELECT to_regclass('public.admin_settings'),
       to_regclass('public.courier_earnings'),
       to_regclass('public.transactions'),
       to_regclass('public.units'),
       to_regclass('public.attributes');
```

All five should be non-null.

---

## What the migration creates / guards

| Admin feature | DB dependency | KV key (if any) |
|---------------|---------------|-----------------|
| Withdraw methods | `admin_settings` | `withdraw_methods` |
| Custom roles | `admin_settings` | `admin_custom_roles` |
| Rental providers/vehicles | `admin_settings` | `rental_providers`, `rental_vehicles` |
| Courier earnings | `courier_earnings` (+ `transactions` fallback) | — |
| Add courier | `users`, `couriers` columns | — |
| Admin self-register | `users.is_admin`, `password_hash`, `is_super_admin` | — |
| Merchant pending/approve | `merchants.status` | — |
| Bulk merchants/items | `merchants`, `users`, catalog `items` | — |
| Units / attributes | `units`, `attributes` | — |
| Utility (contacts & surge caps) | `utility` | — |

**Env (no migration):** `ALLOW_ADMIN_REGISTRATION=true` to allow admin signup when an admin already exists. `GOOGLE_MAPS_API_KEY` with Routes + Weather APIs for surge on delivery-fee quotes.

---

## Migration files (run order if applying manually)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `src/database/migrations/add_admin_auth.sql` | Admin login columns (subset of #5) |
| 2 | `src/database/migrations/add_super_admin.sql` | Super-admin flag |
| 3 | `supabase/migrations/202608200001_admin_settings.sql` | KV table (subset of #5) |
| 4 | `supabase/migrations/202608230001_attributes_units_coupons.sql` | Units/attributes (subset of #5) |
| **5** | **`supabase/migrations/202608280001_admin_endpoints_support.sql`** | **All-in-one; supersedes gaps in 1–4** |
| 6 | `supabase/migrations/202609010001_utility.sql` | Utility table (WhatsApp, call line, surge caps) |

Use **#5 alone** if starting fresh on a DB that already has base Sendo tables (`users`, `couriers`, `merchants`, `items`). Apply **#6** for public contacts and surge pricing.

---

## Backend — routes & services

| Feature | Routes | Service |
|---------|--------|---------|
| Couriers | `src/modules/admin/admin.routes.ts` | `admin.users.service.ts` → `createCourier` |
| Stores bulk / create | `admin.routes.ts` | `admin.stores.service.ts` |
| Items bulk | `admin.routes.ts` | `admin.items.service.ts` |
| Withdraw methods | `admin.routes.ts` | `admin.settings.service.ts` |
| Custom roles | `admin.routes.ts` | `admin.settings.service.ts` |
| Courier earnings | `admin.routes.ts` | `admin.transactions.service.ts` |
| Rental | `admin.routes.ts` | `admin.rental.service.ts` |
| Admin register | `src/modules/auth/auth.routes.ts` | `auth.service.ts` → `registerAdmin` |
| Units | `admin.routes.ts` | `admin.units.service.ts` |
| Attributes | `admin.routes.ts` | `admin.attributes.service.ts` |
| Utility | `admin.routes.ts`, `src/routes/index.ts` (`/utility`) | `utility.service.ts`, `admin.utility.controller.ts` |

---

## Frontend — API proxies & UI

| Feature | Next.js API route | UI |
|---------|-------------------|-----|
| Couriers | `Sendo-v2/app/api/admin/couriers/route.ts` | `admin/users/courier/new/NewCourierClient.tsx` |
| Store bulk | `app/api/admin/stores/bulk-import/route.ts` | `admin/store/bulk-import/` |
| Item bulk | `app/api/admin/items/bulk-import/route.ts` | `admin/item/bulk-import/` |
| Withdraw methods | `app/api/admin/settings/withdraw-methods/` | `transactions/withdraw-method/` |
| Custom roles | `app/api/admin/settings/custom-roles/` | `users/custom-role/create/` |
| Courier earnings | `app/api/admin/transactions/courier/earnings/route.ts` | `transactions/provide-courier-earnings/` |
| Rental | `app/api/admin/rental/` | `admin/rental/provider/`, `vehicle/` |
| Admin register | `app/api/auth/register/route.ts` | `app/register/RegisterForm.tsx` |
| Units | `app/api/admin/units/` | `admin/unit/add/`, `edit/` |
| Attributes | `app/api/admin/attributes/` | `admin/attribute/add/`, `edit/` |
| Utility | `app/api/admin/utility/route.ts` | `admin/business-settings/utility/` |

Lib helpers: `Sendo-v2/app/lib/backendAdmin/{stores,items,users,settings,transactions,rental,utility}.ts`

CSV bulk import: `Sendo-v2/app/lib/csvParse.ts`, templates in `Sendo-v2/public/templates/`

---

## Prerequisites (must already exist)

These base tables are **not** created by the new migration — they come from earlier Sendo setup:

- `public.users`
- `public.couriers`
- `public.merchants`
- `public.items` (catalog)

If any are missing, apply older migrations under `src/database/migrations/` (orders, catalog, etc.) first.

---

## Post-apply checklist

1. Run migration #5 on Supabase.
2. Set `BACKEND_URL` on Vercel (Sendo-v2) pointing at Render/hosted API.
3. Set `ALLOW_ADMIN_REGISTRATION=true` only if you want open admin signup after bootstrap.
4. Smoke-test: create unit → create courier → record courier earning → add withdraw method → bulk-import one merchant row.
