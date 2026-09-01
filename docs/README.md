# Sendo Backend — Documentation

Welcome. These guides explain how the Sendo API works and how to connect apps to it.

**New here?** Read [Order flow guide](order_system_guide.md) first if you are building checkout or live order updates. Use [API reference](API_DOCUMENTATION.md) when you need the full list of URLs and fields.

---

## Pick the guide you need

| I want to… | Open this guide |
|------------|-----------------|
| See every API endpoint | [API reference](API_DOCUMENTATION.md) |
| Build checkout (delivery fee → place order) | [Order flow guide](order_system_guide.md) |
| Show “My orders” in the customer app | [Order history](order_history_api.md) |
| Build the order tracking / status screen | [Order status screen guide](order_status_guide.md) |
| Add search, wallet history, or support phone numbers | [Common API examples](api_usage_guide.md) |
| Set up the database on Supabase | [Admin migrations](../src/database/migrations/ADMIN_MIGRATIONS.md) |

---

## Guides in plain language

### [API reference](API_DOCUMENTATION.md)

Complete list of endpoints: sign-in, stores, cart, orders, payments, couriers, public contact numbers, and admin utility settings. Use this as the technical reference when you already know what you are looking for.

### [Order flow guide](order_system_guide.md)

Walkthrough for the happy path:

1. Customer sees delivery fee before paying  
2. Customer places order  
3. Merchant gets live notifications and accepts or declines  
4. Customer sees status changes in real time  

Includes how **surge pricing** (extra charge in bad traffic or weather) appears in the delivery fee response.

### [Order history](order_history_api.md)

How to load a customer’s past orders with paging — what to send and what comes back.

### [Order status screen guide](order_status_guide.md)

What fields to show on a “Track my order” screen (restaurant, driver, items, address) and how live updates work.

### [Common API examples](api_usage_guide.md)

Short examples for:

- Searching stores and products  
- Wallet transaction history  
- Public WhatsApp and phone line (no login required)  
- Registering a device for push notifications  

### [Admin migrations](../src/database/migrations/ADMIN_MIGRATIONS.md)

For developers deploying the backend: which SQL files to run on Supabase, in what order, and what each one sets up (including the **utility** table for contact numbers and surge limits).

---

## How the API behaves (basics)

**Base URL:** your server + `/api` (local default: `http://localhost:3001/api`).

**Most responses look like:**

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { }
}
```

**Signed-in requests** send the login token in the header:

```
Authorization: Bearer <token>
```

Different apps use different roles: **consumer** (customer), **merchant** (store), **courier** (driver), **admin**. The API reference notes which role each endpoint needs.

**Public endpoints** (no login) include support contact numbers: `GET /api/utility/contacts`.

---

## Admin dashboard docs (separate folder)

Staff who run the web admin use guides in the Sendo-v2 repo:

- [Operator manuals index](../../Sendo-v2/docs/operators/README.md)  
- [Business settings (contacts & surge)](../../Sendo-v2/docs/operators/11-business-settings.md)

Those guides are also visible inside the admin app under **Guides** (`/admin/help`).

---

## Repo links

- [Sendo-v2 README](../../Sendo-v2/README.md) — admin dashboard  
- [Root README](../../README.md) — documentation index for the whole monorepo  
