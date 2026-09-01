# Order flow guide

How checkout and live order updates work for **customer**, **merchant**, and **courier** apps.

**See also:** [API reference — Orders](API_DOCUMENTATION.md#orders-consumer) · [Order status screen guide](order_status_guide.md) · [All docs](README.md)

**Base URL:** your server + `/api`.

---

## Part 1 — Customer checkout

### Step 1: Show delivery fee before payment

Call this **before** the customer taps “Place order” so they see the full price including delivery.

**Request:** `GET /api/orders/delivery-fee?merchantId=<store id>&addressId=<address id>`

**Login:** Customer token required.

**What you get back:**

| Field | Meaning |
|-------|---------|
| `fee` | Total delivery charge the customer pays |
| `base_fee` | Normal distance-based fee only |
| `currency` | Usually `NGN` |
| `surge` | Extra charge from traffic or weather (may be zero) |

Example:

```json
{
  "success": true,
  "message": "Delivery fee estimated",
  "data": {
    "fee": 1500,
    "currency": "NGN",
    "base_fee": 1000,
    "surge": {
      "flat": 200,
      "percent": 10,
      "reasons": ["heavy_traffic"]
    }
  }
}
```

**Surge in plain terms:** Sendo may add a small extra amount when the route has heavy traffic or bad weather. Admins set the **maximum** in the dashboard; the API calculates the actual amount per trip. If mapping services are unavailable, surge is zero and `fee` equals `base_fee`.

The same calculation runs again when the order is created, so the customer is not charged a different amount than shown at checkout.

### Step 2: Place the order

**Request:** `POST /api/orders`

**Body example:**

```json
{
  "addressId": "customer-address-id",
  "notes": "Please don't ring the bell",
  "paymentMethod": "wallet"
}
```

Items come from the customer’s **current cart** automatically — you do not send the line items in this call.

---

## Part 2 — Merchant (store) app

### Hear about new orders immediately

Connect to the real-time server (Socket.io) at your API host.

1. Connect to the websocket.  
2. Join the store room: `merchant:<merchantId>`.  
3. Listen for event **`new_order`** — payload is the full order (customer, address, items).

### Accept or decline

| Action | Request |
|--------|---------|
| Accept | `POST /api/merchant/orders/:id/accept` |
| Decline | `POST /api/merchant/orders/:id/decline` with body `{ "reason": "Out of stock" }` |

### Update progress (preparing, ready, etc.)

**Request:** `PUT /api/merchant/orders/:id/status`

**Body example:** `{ "status": "preparing" }`

Common statuses: `preparing`, `ready_for_pickup`, `delivered` (exact values depend on your workflow — match the API reference).

---

## Part 3 — Customer live updates

1. Connect to Socket.io.  
2. Join room: `user:<userId>`.  
3. Listen for **`order_status_changed`** — update the UI when status changes.

For a map when the courier is on the way, also use `GET /api/orders/:orderId/tracking`. See [Order status screen guide](order_status_guide.md).

---

## Related

- [Order history](order_history_api.md) — past orders list  
- [Common API examples](api_usage_guide.md) — search, wallet, support numbers  
- [Operator guide — orders](../../Sendo-v2/docs/operators/02-orders-refunds.md) — how staff use the admin dashboard  
