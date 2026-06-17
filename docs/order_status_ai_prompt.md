# Frontend AI Prompt: Order Status Integration

**Role**: You are a Frontend Developer (React Native / Expo) working on the Sendo Delivery App.

**Task**: Implement a comprehensive **Order Status Screen** using the data returned from the backend.

### Backend Endpoint
- **Method**: `GET`
- **Path**: `/orders/:orderId`
- **Auth**: Requires standard consumer Bearer Token.

### Data Structure Explained
The API returns a JSON object with the following key fields:

1.  **Core Info**:
    - `status`: Current stage of the order. Map these to UI steps:
        - `pending`: Waiting for merchant
        - `accepted` / `preparing`: Merchant is cooking/gathering items
        - `ready`: Food is ready for pickup
        - `picked_up` / `on_the_way`: Courier has the food and is moving
        - `delivered`: Order completed
        - `cancelled`: Order stopped
    - `total_amount`: Total price in Naira.
    - `estimated_delivery_time`: ISO string, show as "Arriving by HH:MM".

2.  **Merchant (Restaurant)**:
    - `merchant.name`: Display as the title (e.g., "Mega Chicken").
    - `merchant.address`: Show the store location.
    - `merchant.phone`: Provide a "Call Restaurant" button.

3.  **Courier (Driver)**:
    - `courier`: This object is `null` until a driver is assigned.
    - If present, show `courier.full_name` and provide a "Call Driver" button using `courier.phone`.

4.  **Order Items**:
    - `items`: An array of products. Each item has:
        - `product.name`, `quantity`, `price`.
        - `extras`: Array of add-ons (e.g., "Extra Cheese").

5.  **Delivery Address**:
    - `address.address`: Show where the food is going.

### Implementation Guidelines
- Use a **Process Stepper** or Progress Bar to show the transition from "Order Placed" -> "Preparing" -> "On the Way" -> "Delivered".
- Implement **Real-time Updates**: Listen for the `order_status_changed` event on the Socket.io room `user:{userId}` to update the UI without refreshing.
- If the status is `on_the_way`, you should also query the tracking endpoint `GET /orders/:orderId/tracking` to show the courier's live location on a map.
