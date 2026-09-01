# Sendo Backend API Documentation

Technical reference for all API endpoints. Powers the consumer, merchant, courier, and admin apps.

**Easier starting points (plain language):**

- [Docs index — pick a guide](README.md)
- [Order flow guide](order_system_guide.md) — checkout and live updates
- [Common API examples](api_usage_guide.md) — search, wallet, support numbers

**Base URL:** `{your-server}/api` (local default: `http://localhost:3001/api`).

---

## How responses work

Most calls return JSON like this:

```json
{
  "success": true,
  "message": "Short description",
  "data": { }
}
```

**Logged-in requests** include: `Authorization: Bearer <token from login>`.

**Roles:** Some routes require `consumer`, `merchant`, `courier`, or `admin` — noted in each section below.

**Stack (for developers):** Express + TypeScript, database on Supabase (PostgreSQL).

---
## Table of Contents

1. [Authentication](#authentication)
2. [Consumer Endpoints](#consumer-endpoints)
3. [Store Discovery](#store-discovery-consumer-app)
4. [Products](#products)
5. [Cart](#cart)
6. [Orders (Consumer)](#orders-consumer)
7. [Utility (Public)](#utility-public)
8. [Payments](#payments)
9. [Merchant / Admin](#merchant)
10. [Courier Endpoints](#courier-endpoints)
11. [Real-Time Tracking](#real-time-tracking)
12. [Notifications](#notifications)
13. [Reviews](#reviews)
14. [Coupons](#coupons)
15. [Admin Utility](#admin-utility)

---

## Authentication
*Prefix: `/api/auth`*

We use a custom, unified OTP-based authentication system across all applications.

#### 1. Send OTP
- **POST** `/api/auth/send-otp`
- **Body**: `{ phone: string }`
- **Response**: `{ success: boolean, message: string }`

#### 2. Verify OTP (Login or Start Registration)
- **POST** `/api/auth/verify-otp`
- **Body**: `{ phone: string, otpCode: string }`
- **Responses:**
  - **Existing User**: `{ success: true, token: string, data: User, isNewUser: false }` -> _They are logged in._
  - **New User**: `{ success: true, message: string, isNewUser: true, registrationToken: string }` -> _Proceed to Step 3._

#### 3. Register Profile (New Users Only)

After receiving `isNewUser: true` and the `registrationToken` from Step 2, hit the appropriate registration endpoint to complete onboarding.

**Consumer:**
- **POST** `/api/auth/register-consumer`
- **Body**: `{ registrationToken: string, firstName: string, lastName: string, email?: string }`
- **Response**: `{ success: true, token: string, data: User }`

**Courier:**
- **POST** `/api/auth/register-courier`
- **Body**: 
  ```json
  { 
    "registrationToken": "string", 
    "firstName": "string", 
    "lastName": "string", 
    "vehicleType": "car | bike", 
    "plateNumber": "string",
    "dob": "YYYY-MM-DD",
    "courierName": "string (optional, defaults to first + last name)",
    "email": "string (optional)" 
  }
  ```
- **Response**: `{ success: true, token: string, data: User }`

**Merchant:**
- **POST** `/api/auth/register-merchant`
- **Body**: 
  ```json
  {
    "registrationToken": "string",
    "firstName": "string",
    "lastName": "string",
    "storeName": "string",
    "merchantType": "restaurant | grocery",
    "address": "string",
    "city": "string",
    "state": "string",
    "postalCode": "string",
    "country": "string",
    "latitude": 0,
    "longitude": 0,
    "contactPhone": "string",
    "contactEmail": "string",
    "logoUri": "string",
    "bannerUri": "string (optional)",
    "openingTime": "string (optional)",
    "closingTime": "string (optional)",
    "activeDays": "string[] (optional)",
    "offDays": "string[] (optional)",
    "isPickupOnly": "boolean (optional)",
    "deliveryRadius": "number (optional)",
    "preparationTime": "string (e.g. '15-25 min', optional)",
    "deliveryFee": "number (0 for free, optional)"
  }
  ```
- **Response**: `{ success: true, token: string, data: User }`

---

## Consumer Endpoints
*Prefix: `/api/users`*  
Requires Role: `consumer`

- `GET /api/users/profile` : Fetch profile.
- `PUT /api/users/profile` : Update profile.
- `DELETE /api/users/account` : Hard delete consumer account.

- `GET /api/users/addresses` : Fetch all saved delivery addresses.
- `POST /api/users/addresses` : Add a new address.
- `PUT /api/users/addresses/:id` : Update an existing address.
- `DELETE /api/users/addresses/:id` : Remove an address.

- `GET /api/users/favorites` : Fetch user's favorite stores.
- `POST /api/users/favorites/:storeId` : Add store to favorites.
- `DELETE /api/users/favorites/:storeId` : Remove store from favorites.

---

## Store Discovery (Consumer App)
*Prefix: `/api/stores`*

- `GET /api/stores` : Fetch all stores. Supports paging and filters (`?type=restaurant`, `?lat=&lng=`, `?rating=`, `?city=`).
- `GET /api/stores/nearby` : Fetch restaurants near the user's default delivery address. (Requires Auth)
- `GET /api/stores/featured` : Fetch a shuffled selection of featured restaurants.
- `GET /api/stores/city` : Fetch all restaurants in the user's default delivery address city. (Requires Auth)
- `GET /api/stores/search` : Search stores (e.g. `?q=pizza`).
- `GET /api/stores/:storeId` : Get single store profile.
- `GET /api/stores/:storeId/menu` : Fetch structured menu categories and nested products for a store.
- `GET /api/stores/:storeId/categories` : Fetch list of store categories.
- `GET /api/stores/:storeId/products` : Fetch paginated products directly.

---

## Products
*Prefix: `/api/products`*

- `GET /api/products/:productId` : Fetch single product details (includes extras/add-ons).
- `GET /api/products` : Fetch products globally or via `?storeId=`. Supports pagination.
- `GET /api/products/search` : Search query `?q=` over all products.

---

## Cart
*Prefix: `/api/cart`*  
Requires Role: `consumer`

- `GET /api/cart` : Fetch active cart items.
- `POST /api/cart/items` : Add item to cart. Fails if user attempts to mix items from different stores. (Body: `{ productId, quantity, extras }`)
- `PUT /api/cart/items/:id` : Update item quantity.
- `DELETE /api/cart/items/:id` : Remove item.
- `DELETE /api/cart/clear` : Empty the cart completely.

---

## Orders (Consumer)
*Prefix: `/api/orders`*  
Requires Role: `consumer`

- `POST /api/orders` : Checkout current active cart to a new order.
- `GET /api/orders` : Fetch consumer order history.
- `GET /api/orders/:orderId` : Fetch deep details of a specific order.
- `POST /api/orders/:orderId/cancel` : Cancel pending/accepted orders.
- `POST /api/orders/:orderId/rate` : Submit review & rating once delivered.
- `GET /api/orders/:orderId/tracking` : Fetch current delivery status, including courier live location if dispatched.
- `GET /api/orders/delivery-fee` : Estimate delivery fee for checkout. Query: `merchantId`, `addressId`. Requires auth (`consumer`). Response `data`:
  ```json
  {
    "fee": 1500,
    "currency": "NGN",
    "base_fee": 1000,
    "surge": {
      "flat": 200,
      "percent": 10,
      "score": 0.8,
      "reasons": ["heavy_traffic", "harsh_weather"]
    }
  }
  ```
  Surge uses admin caps from the `utility` table and Google Maps Routes + Weather APIs at quote time. If APIs are unavailable, `surge` values are zero and `fee` equals `base_fee`.

---

## Utility (Public)

Support phone numbers for customer apps. **No login required.**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/utility/contacts` | WhatsApp number and call line |

Example response:

```json
{
  "success": true,
  "data": {
    "whatsapp_number": "+234...",
    "call_line": "+234..."
  }
}
```

Admins update values in the admin dashboard under **Business settings → Contact numbers** and **Surge pricing**.

---
## Payments
*Prefix: `/api/payments`*  
Requires Role: `consumer`

- `POST /api/payments/intent` : Create mock payment intent logic.
- `POST /api/payments/confirm` : Confirm transaction to authorize order execution.
- `GET /api/payments/history` : Consumer transaction log.
- `POST /api/payments/tip` : Add tip transaction attached to existing order.
- `POST /api/payments/refund` : Trigger refund flow.

**Wallet Endpoints** (Role: `consumer`)
- `GET /api/payments/wallet/balance` : Fetch current wallet balance.
- `GET /api/payments/wallet/transactions` : Fetch wallet transaction history.

---

## Merchant
*Prefix: `/api/merchant`*  

A single merchant role governs both Restaurants and Grocery stores. Merchants register under a unified store system.

**Store Management**
- `POST /api/merchant/register` : Onboard a new merchant store.
  - **Body**:
    ```json
    {
      "userId": "string",
      "firstName": "string",
      "lastName": "string",
      "shopName": "string",
      "businessType": "restaurant | grocery",
      "description": "string",
      "contactPhone": "string",
      "contactEmail": "string",
      "address": "string",
      "city": "string",
      "state": "string",
      "postalCode": "string",
      "country": "string",
      "latitude": 0,
      "longitude": 0,
      "logoUri": "string",
      "bannerUri": "string (optional)",
      "openingTime": "string (optional)",
      "closingTime": "string (optional)",
      "activeDays": "string[] (optional)",
      "offDays": "string[] (optional)",
      "isPickupOnly": "boolean (optional)",
      "deliveryRadius": "number (optional)",
      "preparationTime": "string (e.g. '15-25 min', optional)",
      "deliveryFee": "number (0 for free, optional)"
    }
    ```
  - `businessType` must strictly be either `'restaurant'` or `'grocery'`
- `GET /api/merchant/store` : View store configuration. (Requires Role: `merchant`)
- `PUT /api/merchant/store` : Update configurations. (Requires Role: `merchant`)
- `PUT /api/merchant/store/status` : Set store strictly to `open`, `closed`, or `busy`. (Requires Role: `merchant`)

**Category & Product Management**
- `GET /api/merchant/categories` : List all categories for the logged-in merchant.
- `GET /api/merchant/catalog` : Fetch full menu (categories + products) for the merchant.
- `POST /api/merchant/categories` : Create a new category.
- `PUT /api/merchant/products/:id/availability` : Toggle product on/off. (Body: `{ "is_available": boolean }`)
- `DELETE /api/merchant/products/:id` : Remove a product.

**Merchant Orders**
- `GET /api/merchant/orders/incoming` : Reliable fallback feed for new `pending` orders with full payload (`consumer`, `address`, `items`).
- `GET /api/merchant/orders` : Fetch incoming/active store orders.
- `GET /api/merchant/orders/:id` : Order detail.
- `POST /api/merchant/orders/:id/accept` : Mark incoming order as `ACCEPTED`.
- `POST /api/merchant/orders/:id/decline` : Mark incoming order as `CANCELLED` and refund if wallet was used.
- `PUT /api/merchant/orders/:id/status` : Update order status (e.g., `preparing`, `ready_for_pickup`, `delivered`).
- `GET /api/merchant/earnings` : Fetch store total earnings and current balance.

---

## Courier Endpoints
*Prefix: `/api/courier`*  
Requires Role: `courier`

**Profile / Availability**
- `GET /api/courier/profile` : Fetch rider info.
- `PUT /api/courier/profile` : Update rider metadata.
- `POST /api/courier/go-online` : Start shift. Optionally accepts live context payload:
  ```json
  {
    "lat": 6.5244,
    "lng": 3.3792,
    "heading": 240,
    "speed": 8.2,
    "accuracy": 12,
    "batteryLevel": 0.76,
    "deviceId": "courier-device-123",
    "source": "mobile_app"
  }
  ```
- `POST /api/courier/go-offline` : End shift.
- `GET /api/courier/status` : Check online state.

**Delivery Jobs**
- `GET /api/courier/orders/available` : Poll for `READY_FOR_PICKUP` tasks nearby.
- `GET /api/courier/deliveries` : Fetch grouped courier deliveries (`ongoing`, `completed`, `cancelled`).
- `GET /api/courier/deliveries?status=ongoing|completed|cancelled` : Fetch a single delivery bucket.
- `POST /api/courier/orders/:orderId/accept` : Bind order to this courier.
- `POST /api/courier/orders/:orderId/reject` : Exclude from this courier's poll list.

**Delivery Process**
- `POST /api/courier/orders/:orderId/picked-up` : Moves status to `PICKED_UP`.
- `POST /api/courier/orders/:orderId/delivered` : Moves status to `DELIVERED`, computes earnings.
- `POST /api/courier/orders/:orderId/cancel` : Puts package back in available queue if vehicle fails.

**Earnings**
- `GET /api/courier/earnings` : Summary of balances/earnings.
- `GET /api/courier/earnings/history` : History of completed payout ledgers.

---

## Real-Time Tracking
*Prefix: `/api/courier/location`*  
Requires Role: `courier`

- `POST /api/courier/location` : Ping to update current GPS `{ lat, lng }`. (Couriers)

Consumers poll `/api/orders/:orderId/tracking` to pull these updates.

---

## Real-Time Updates (WebSockets)
*Server URL: Base URL (e.g. `http://localhost:3000`)*

The API uses `socket.io` for real-time notifications. Clients should connect and join a room based on their role and ID.

**Rooms:**
- `user:<userId>` : For consumer notifications.
- `merchant:<merchantId>` : For store notifications.

**Events (Sent by Server):**
- `new_order` : Triggered for merchants when a new order is placed. Data is enriched for vendor UI and includes `consumer`, `address`, and `items`.
- `order_status_changed` : Triggered for users when their order status is updated. (Data: `Order` object)
- `earnings_updated` : (Future) Triggered for merchants when earnings change.


## Notifications
*Prefix: `/api/notifications`*

- `GET /api/notifications` : Get user's inbox list.
- `POST /api/notifications/read` : Mark an array of notification IDs as seen.
- `POST /api/notifications/device-token` : Register FCM device token for push dispatches.

---

## Reviews
*Prefix: `/api/reviews` & others*

- `POST /api/reviews` : Generic explicit POST for review creation.
- `GET /api/stores/:storeId/reviews` : Fetch community reviews for a store.
- `GET /api/couriers/:courierId/reviews` : Fetch community reviews for a courier.

---

## Coupons
*Prefix: `/api/coupons`*

- `GET /api/coupons` : Fetch current global promotions.
- `POST /api/coupons/apply` : Validate a coupon code attached to a checkout flow. (Role: `consumer`)

---

## Admin Utility

Contact numbers and surge pricing **caps** (used when calculating delivery fees). Called by the admin dashboard; customer apps read contact numbers via public `/api/utility/contacts`.

### Contact numbers

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| GET | `/api/admin/utility/contacts` | Admin | Read WhatsApp and call line |
| PUT | `/api/admin/utility/contacts` | Super-admin | Update contact numbers |

**PUT body** must include `reason` or `change_note` (at least 3 characters) for audit history.

Example:

```json
{
  "whatsapp_number": "+234...",
  "call_line": "+234...",
  "change_note": "Updated support numbers for Lagos launch"
}
```

### Surge pricing caps

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| GET | `/api/admin/utility/surge-pricing` | Admin | Read surge caps |
| PUT | `/api/admin/utility/surge-pricing` | Super-admin | Update surge caps |

**PUT body** must include `reason` or `change_note` (at least 3 characters) for audit history.

Example:

```json
{
  "surge_price": "500",
  "surge_percentage": "15",
  "change_note": "Raised surge cap for rainy season"
}
```

**Surge:** Admin values are maximums. Actual surge per delivery is computed at quote time using Google Maps (traffic and weather). Set `GOOGLE_MAPS_API_KEY` with Distance Matrix, Routes, and Weather APIs enabled.

**Operator guide:** Business settings in the Sendo admin dashboard (Contact numbers and Surge pricing pages).
