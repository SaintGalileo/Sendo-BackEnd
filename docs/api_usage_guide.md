# Common API examples

Short, practical examples for features app developers use often. For the full endpoint list, see [API reference](API_DOCUMENTATION.md).

**Base URL:** your server + `/api` (example: `http://localhost:3001/api`).

---

## 1. Search stores and products

**What it does:** One search finds matching **restaurants/stores** and **menu items**.

**Request:** `GET /api/search?q=pizza&limit=5`

| Query | Required | Meaning |
|-------|----------|---------|
| `q` | Yes | What the user typed |
| `page` | No | Page number (default 1) |
| `limit` | No | Results per page (default 10) |

**Example response:**

```json
{
  "success": true,
  "message": "Search results fetched",
  "data": {
    "stores": [{ "id": "...", "name": "Pizza Palace" }],
    "products": [{ "id": "...", "name": "Pepperoni Pizza", "price": 2500 }],
    "totalStores": 1,
    "totalProducts": 10
  }
}
```

---

## 2. Wallet transaction history

**What it does:** Shows money added to or spent from the customer wallet.

**Request:** `GET /api/payments/wallet/transactions?limit=10`

**Login:** Required — send `Authorization: Bearer <token>`.

| Query | Meaning |
|-------|---------|
| `limit` | How many rows (e.g. 10 or 100) |
| `page` | Page number for older history |

**Example response:**

```json
{
  "success": true,
  "message": "Wallet transactions fetched",
  "data": {
    "items": [
      {
        "id": "...",
        "amount": 5000,
        "type": "credit",
        "description": "SeerBit Funding: 1234567890",
        "created_at": "..."
      }
    ],
    "meta": {
      "totalItems": 45,
      "currentPage": 1,
      "totalPages": 5
    }
  }
}
```

---

## 3. Public support phone numbers

**What it does:** Returns WhatsApp and call-line numbers for the customer app (help screen, contact us, etc.). **No login required.**

**Request:** `GET /api/utility/contacts`

**Example response:**

```json
{
  "success": true,
  "data": {
    "whatsapp_number": "+2348012345678",
    "call_line": "+2348012345678"
  }
}
```

**Who updates these numbers:** Super-admins in the admin dashboard under **Business settings → Utility & contacts**. See the [operator guide](../../Sendo-v2/docs/operators/11-business-settings.md).

**Admin API (logged-in super-admin only):** `GET` and `PUT /api/admin/utility` — details in [API reference — Admin Utility](API_DOCUMENTATION.md#admin-utility).

---

## 4. Register for push notifications

**What it does:** Saves the device token so the app can receive push messages (for example when the wallet is topped up).

**Request:** `POST /api/notifications/device-token`

**Body:**

```json
{
  "token": "YOUR_FCM_DEVICE_TOKEN"
}
```

---

## More guides

- [Order flow (checkout & live updates)](order_system_guide.md)
- [Order history](order_history_api.md)
- [Full API reference](API_DOCUMENTATION.md)
- [All backend docs](README.md)
