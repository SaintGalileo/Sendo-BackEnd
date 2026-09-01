# Order history

How to load a customer’s **past orders** in the app (paginated list).

**See also:** [Order flow guide](order_system_guide.md) · [API reference](API_DOCUMENTATION.md) · [All docs](README.md)

---

## What this endpoint does

Returns a page of orders for the logged-in customer, newest first. Each order includes store name, items, totals, and status — enough to build “My orders” cards without extra calls.

---

## Request

**URL:** `GET /api/orders` (or `/api/orders/history` if your client uses that alias)

**Login:** Required — `Authorization: Bearer <customer token>`

| Query | Required | Default | Meaning |
|-------|----------|---------|---------|
| `page` | No | `1` | Which page of results |
| `limit` | No | `10` | Orders per page |

**Example:** `GET /api/orders?page=1&limit=5`

---

## Example response

```json
{
  "success": true,
  "message": "Order history fetched successfully",
  "data": {
    "items": [
      {
        "id": "order-uuid",
        "order_number": "ORD-20240319-X72A",
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

---

## UI tips

- Use `meta.totalPages` and `meta.currentPage` for “Load more” or page numbers.  
- Show `merchant.name`, first item image, `total_price`, `status`, and `created_at` on each card.  
- Tapping a row should open order detail: `GET /api/orders/:orderId` — see [Order status screen guide](order_status_guide.md).
