# Order status screen guide

How to build the **“Track my order”** screen in the customer app: what the API returns and how to keep it up to date.

**See also:** [Order flow guide](order_system_guide.md) · [API reference](API_DOCUMENTATION.md) · [All docs](README.md)

---

## Load order details

**Request:** `GET /api/orders/:orderId`

**Login:** Customer token required.

---

## What to show on screen

### 1. Order progress

Use field **`status`** to drive a stepper or progress bar:

| Status | What it means for the customer |
|--------|--------------------------------|
| `pending` | Waiting for the store to accept |
| `accepted` / `preparing` | Store is preparing the order |
| `ready` | Ready for courier pickup |
| `picked_up` / `on_the_way` | Courier is delivering |
| `delivered` | Completed |
| `cancelled` | Order was cancelled |

Suggested steps: **Order placed → Preparing → On the way → Delivered**.

Also show:

- **`total_amount`** — total price (NGN)  
- **`estimated_delivery_time`** — show as “Arriving by …” if present  

### 2. Restaurant (store)

From **`merchant`**:

- Name (title)  
- Address  
- Phone — add a “Call restaurant” button  

### 3. Courier (driver)

**`courier`** is empty until someone is assigned.

When present, show name and a “Call driver” button using **`courier.phone`**.

### 4. Items ordered

**`items`** — each row: product name, quantity, price, and any **extras** (add-ons).

### 5. Delivery address

**`address.address`** — where the order is going.

---

## Live updates (no refresh needed)

1. Connect to the real-time server (Socket.io).  
2. Join room **`user:<userId>`**.  
3. Listen for **`order_status_changed`** and update the stepper when it fires.

Details: [Order flow guide — Part 3](order_system_guide.md#part-3--customer-live-updates).

---

## Map while courier is on the way

When status is **`on_the_way`** (or **`picked_up`**), call:

**`GET /api/orders/:orderId/tracking`**

Use the courier location in the response to show a map pin if coordinates are available.

---

## Support phone numbers

For a “Contact support” button, use public numbers (no login):

**`GET /api/utility/contacts`** — see [Common API examples](api_usage_guide.md#3-public-support-phone-numbers).

Numbers are managed in the admin dashboard under **Business settings → Contact numbers**.
