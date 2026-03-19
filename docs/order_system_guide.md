# Order System Guide

This guide describes how to integrate the order system into the Sendo Consumer and Merchant apps.

## 1. Consumer Flow (Checkout)

### Step 1: Estimate Delivery Fee
Before the user places an order, fetch the delivery fee to display it on the checkout page.

- **Endpoint**: `GET /orders/delivery-fee`
- **Query Parameters**:
  - `merchantId`: UUID of the merchant
  - `addressId`: UUID of the user's delivery address
- **Response**:
  ```json
  {
    "status": true,
    "message": "Delivery fee estimated",
    "data": {
      "fee": 700,
      "currency": "NGN"
    }
  }
  ```

### Step 2: Create Order
When the user clicks "Place Order", send the order details. The delivery fee will be recalculated and validated on the backend.

- **Endpoint**: `POST /orders`
- **Body**:
  ```json
  {
    "addressId": "uuid",
    "notes": "Please don't ring the bell",
    "paymentMethod": "wallet"
  }
  ```
- **Note**: The items are automatically pulled from the user's active cart.

---

## 2. Merchant Flow (Order Management)

### Step 1: Real-time Notifications
Merchants must connect to the Socket.io server to receive new orders in real-time.

- **Socket Connection**: `wss://your-api-url.com`
- **Join Room**: Upon connecting, the merchant app must join its specific room.
  - `socket.emit('join', 'merchant:{merchantId}')`
- **Listen for New Orders**:
  - Event: `new_order`
  - Payload: The complete order object.

### Step 2: Accept or Decline Order
Merchants can accept or decline an incoming order.

- **Accept Order**: `POST /merchant/orders/:id/accept`
- **Decline Order**: `POST /merchant/orders/:id/decline`
  - Body: `{ "reason": "Out of stock" }`

### Step 3: Update Order Status
As the order progresses, the merchant should update its status.

- **Update Status**: `PUT /merchant/orders/:id/status`
- **Body**: `{ "status": "preparing" }` (Valid statuses: `preparing`, `ready`, `picked_up`, `on_the_way`, `delivered`)

---

## 3. Real-time Status Updates (Consumer)

Consumers should listen for status changes to their orders.

- **Join Room**: `socket.emit('join', 'user:{userId}')`
- **Listen for Changes**:
  - Event: `order_status_changed`
  - Payload: Updated order object.
