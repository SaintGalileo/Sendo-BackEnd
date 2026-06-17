# Sendo API Usage Guide

This guide explains how to use the newly implemented search and transaction history endpoints.

## 1. Unified Search
Search for restaurants (stores) and food items (products) in a single request.

- **Endpoint**: `GET /api/search`
- **Query Parameter**: `q` (required) - The search term.
- **Pagination Parameters**: `page` (default: 1), `limit` (default: 10).

### Example Request
`GET /api/search?q=pizza&limit=5`

### Example Response
```json
{
  "success": true,
  "message": "Search results fetched",
  "data": {
    "stores": [
      { "id": "...", "name": "Pizza Palace", ... }
    ],
    "products": [
      { "id": "...", "name": "Pepperoni Pizza", "price": 2500, ... }
    ],
    "totalStores": 1,
    "totalProducts": 10
  }
}
```

---

## 2. Wallet Transaction History
View your wallet funding and spending history.

- **Endpoint**: `GET /api/payments/wallet/transactions`
- **Authentication**: Bearer Token required.
- **Pagination Parameters**: 
  - `limit`: Number of items to return. Use `10` for "First 10" or a larger number for "All".
  - `page`: Page number.

### Example: Get First 10 Transactions
`GET /api/payments/wallet/transactions?limit=10`

### Example: Get All Transactions (or next page)
`GET /api/payments/wallet/transactions?limit=100`

### Example Response
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
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 5,
      "currentPage": 1
    }
  }
}
```

---

## 3. Registering FCM Token
Required for receiving push notifications when your wallet is funded.

- **Endpoint**: `POST /api/notifications/fcm-token`
- **Body**:
```json
{
  "token": "YOUR_FCM_DEVICE_TOKEN"
}
```
