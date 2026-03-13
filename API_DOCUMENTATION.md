# Sendo Backend API Documentation

Welcome to the Sendo Backend API documentation. This API powers the consumer, merchant, and courier applications for a comprehensive food and grocery delivery platform. 

The API follows RESTful principles, uses JSON format for requests and responses, and relies on standard HTTP methods and status codes.

---

## Architecture Details

- **Framework:** Express + Node.js with TypeScript
- **Database Backend:** Supabase (PostgreSQL)
- **Response Format:** All API requests return a standard structure:
  ```json
  {
      "success": boolean,
      "message": string,
      "data": any (optional)
  }
  ```
- **Authentication:** Bearer token (JWT)
  `Authorization: Bearer <token>`
- **Roles:** Specific endpoints require specific roles (`consumer`, `merchant`, `courier`). Role verification is managed by `roleMiddleware`.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Consumer Endpoints](#consumer-endpoints)
3. [Store Discovery](#store-discovery-consumer-app)
4. [Products](#products)
5. [Cart](#cart)
6. [Orders (Consumer)](#orders-consumer)
7. [Payments](#payments)
8. [Merchant / Admin](#merchant)
9. [Courier Endpoints](#courier-endpoints)
10. [Real-Time Tracking](#real-time-tracking)
11. [Notifications](#notifications)
12. [Reviews](#reviews)
13. [Coupons](#coupons)

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
- **Body**: `{ registrationToken: string, firstName: string, lastName: string, vehicleType: string, email?: string }`
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
- `POST /api/courier/go-online` : Start shift.
- `POST /api/courier/go-offline` : End shift.
- `GET /api/courier/status` : Check online state.

**Delivery Jobs**
- `GET /api/courier/orders/available` : Poll for `READY_FOR_PICKUP` tasks nearby.
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
- `new_order` : Triggered for merchants when a new order is placed. (Data: `Order` object)
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
