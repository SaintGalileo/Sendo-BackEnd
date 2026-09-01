# Sendo Backend API

Express + TypeScript API for **Sendo** — food and grocery delivery, merchants, couriers, orders, payments, and admin settings. Data is stored in **Supabase (PostgreSQL)**.

The **Sendo admin dashboard** (Sendo-v2) calls this API. Customer and merchant mobile apps use the public and authenticated endpoints documented below.

---

## Documentation

All guides are written to be readable on GitHub. Start with the **[docs index](docs/README.md)** if you are unsure which file to open.

| Guide | Who it is for | Link |
|-------|----------------|------|
| **Docs index** | Everyone — pick the right guide | [docs/README.md](docs/README.md) |
| **API reference** | Developers wiring apps to endpoints | [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) |
| **Order flow** | Consumer & merchant app checkout and live updates | [docs/order_system_guide.md](docs/order_system_guide.md) |
| **Order history** | Showing past orders in the customer app | [docs/order_history_api.md](docs/order_history_api.md) |
| **Common examples** | Search, wallet, public support numbers | [docs/api_usage_guide.md](docs/api_usage_guide.md) |
| **Order status screen** | Building the “track my order” UI | [docs/order_status_guide.md](docs/order_status_guide.md) |
| **Database migrations** | DevOps / backend — Supabase schema | [src/database/migrations/ADMIN_MIGRATIONS.md](src/database/migrations/ADMIN_MIGRATIONS.md) |

---

## Requirements

- Node.js 20+
- A Supabase project (URL + anon key)
- Optional: Google Maps API key (delivery distance and surge pricing)

---

## Getting started

```bash
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default `3001`) |
| `JWT_SECRET` | Signs login tokens — use a long random string |
| `SUPABASE_URL` | From Supabase project settings |
| `SUPABASE_ANON_KEY` | From Supabase project settings |
| `GOOGLE_MAPS_API_KEY` | Distance, routes, and weather for delivery fees |

Run migrations on Supabase — see [ADMIN_MIGRATIONS.md](src/database/migrations/ADMIN_MIGRATIONS.md).

```bash
npm run dev
```

API root: [http://localhost:3001/api](http://localhost:3001/api)

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run seed:admin` | Create an admin user (see script for details) |

---

## Key features

### Orders & delivery

- Order lifecycle, status updates, and delivery fee quotes
- **Surge pricing:** extra charge computed at quote time from Google Maps traffic/weather, capped by admin settings

### Utility settings

Stored in the `utility` table (key/value):

| Key | Purpose |
|-----|---------|
| `whatsapp_number` | Public support WhatsApp |
| `call_line` | Public support phone line |
| `surge_price` | Maximum flat surge add-on (NGN) |
| `surge_percentage` | Maximum surge percentage (0–100) |

**Public:** `GET /api/utility/contacts` — no auth, for customer apps

**Admin (separate endpoints):**

| Method | Path | Who |
|--------|------|-----|
| GET/PUT | `/api/admin/utility/contacts` | Admin read / super-admin write |
| GET/PUT | `/api/admin/utility/surge-pricing` | Admin read / super-admin write |

All admin writes require `reason` or `change_note` (min 3 characters) and are recorded in `admin_audit_logs`.

---

## Project layout

```
SENDO-BACKEND/
├── docs/                 # Guides (start at docs/README.md)
├── src/
│   ├── modules/          # Feature code (orders, auth, admin, utility, …)
│   ├── routes/           # API route mounting
│   └── config/           # Supabase client, env
└── supabase/migrations/  # SQL migrations (apply to Supabase)
```

---

## Related

- **Sendo admin dashboard** — separate repo (Sendo-v2) for operator UI
- **Operator guides** — live in the admin repo under `docs/operators/`

---

## License

Private project. Support and licensing are defined by Sendo.
