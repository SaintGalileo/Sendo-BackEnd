/**
 * Values of Postgres enum `public.order_status` (column `orders.status`).
 * Verified against live DB — do NOT invent labels like `out_for_delivery`
 * or `searching_for_deliverymen` as query filters; use UI buckets instead.
 */
export enum OrderStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    PREPARING = 'preparing',
    READY_FOR_PICKUP = 'ready_for_pickup',
    PICKED_UP = 'picked_up',
    ON_THE_WAY = 'on_the_way',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled'
}
