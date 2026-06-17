# Order History API Documentation

This documentation provides details for the order history endpoint to be implemented in the frontend.

## Fetch Order History

Retrieves a paginated list of orders for the authenticated consumer.

- **URL**: `/orders/history` (or `/orders`)
- **Method**: `GET`
- **Authentication**: Required (`Authorization: Bearer <token>`)

### Query Parameters

| Parameter | Type    | Required | Default | Description                   |
| :-------- | :------ | :------- | :------ | :---------------------------- |
| `page`    | integer | No       | `1`     | The page number to retrieve.  |
| `limit`   | integer | No       | `10`    | Number of items per page.     |

### Sample Request
`GET /orders/history?page=1&limit=5`

---

### Sample Response

```json
{
  "success": true,
  "message": "Order history fetched successfully",
  "data": {
    "items": [
      {
        "id": "uuid-v4-string",
        "order_number": "ORD-20240319-X72A",
        "consumer_id": "user-uuid",
        "merchant_id": "merchant-uuid",
        "total_price": 5500.00,
        "status": "delivered",
        "payment_method": "wallet",
        "payment_status": "paid",
        "delivery_address": "123 Main St, Lagos",
        "created_at": "2024-03-19T10:00:00Z",
        "merchant": {
          "id": "merchant-uuid",
          "name": "Greasy Spoon Restaurant",
          "image_url": "https://example.com/merchant.jpg"
        },
        "items": [
          {
            "id": "item-uuid",
            "product_id": "product-uuid",
            "quantity": 2,
            "price": 2500.00,
            "product": {
              "name": "Jollof Rice Special",
              "image_url": "https://example.com/rice.jpg"
            }
          }
        ]
      }
    ],
    "meta": {
      "totalItems": 25,
      "itemCount": 1,
      "itemsPerPage": 10,
      "totalPages": 3,
      "currentPage": 1
    }
  }
}
```

> [!NOTE]
> The `items` array includes full merchant details and item-level details (nested) to make it easy for your AI editor to build the UI cards.
