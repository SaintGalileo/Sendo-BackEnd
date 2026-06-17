import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';
import { CartService } from '../cart/cart.service';
import { WalletService } from '../payments/wallet.service';
import { SocketService } from '../notifications/socket.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LocationService } from './location.service';
import { MerchantEarningsService } from '../merchant/earnings.service';

const cartService = new CartService();
const walletService = new WalletService();
const socketService = SocketService.getInstance();
const notificationsService = new NotificationsService();
const locationService = new LocationService();
const earningsService = new MerchantEarningsService();

export class OrdersService {
    private merchantNotificationOrderSelect =
        '*, consumer:users!consumer_id(id, first_name, last_name, phone, email), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))';
    private readonly merchantManagedStatuses = [
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP
    ];

    private async getOrderForMerchant(orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(this.merchantNotificationOrderSelect)
            .eq('id', orderId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    private async getHydratedOrderById(orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), consumer:users!consumer_id(id, first_name, last_name, phone, email), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))')
            .eq('id', orderId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    private async updateEntityAverageRating(entity: 'merchant' | 'courier', entityId: string) {
        const column = entity === 'merchant' ? 'merchant_id' : 'courier_id';
        const table = entity === 'merchant' ? 'merchants' : 'couriers';

        const { data: rows, error: rowsError } = await supabase
            .from('reviews')
            .select('rating')
            .eq(column, entityId);

        if (rowsError) throw new Error(rowsError.message);
        const ratings = rows || [];
        if (ratings.length === 0) return;

        const avg = ratings.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / ratings.length;
        await supabase
            .from(table)
            .update({ rating: Number(avg.toFixed(2)) })
            .eq('id', entityId);
    }

    async createOrder(userId: string, data: any) {
        // Retrieve cart items
        const cartItems = await cartService.getCart(userId);
        if (!cartItems || cartItems.length === 0) {
            throw new Error('Cart is empty');
        }

        const merchantId = cartItems[0].product?.merchant_id;
        let subtotal = 0;

        const orderItemsData = cartItems.map((item: any) => {
            const price = item.product?.price || 0;
            const extraCost = (item.extras || []).reduce((sum: number, ext: any) => sum + (ext.price || 0), 0);
            const itemTotal = (price + extraCost) * item.quantity;
            subtotal += itemTotal;

            return {
                product_id: item.product_id,
                quantity: item.quantity,
                price: price,
                extras: item.extras,
            };
        });

        // 1. Fetch Address Details for snapshot
        const { data: address, error: addressError } = await supabase
            .from('addresses')
            .select('address, latitude, longitude')
            .eq('id', data.addressId)
            .single();

        if (addressError || !address) throw new Error('Delivery address not found');

        const deliveryFee = await this.getDeliveryFeeEstimate(merchantId, data.addressId);
        const totalAmount = subtotal + deliveryFee;
        const paymentMethod = data.paymentMethod || 'wallet';
        // Treat 'online_paid' as fully paid (payment confirmed by user via WebView)
        const isOnlinePaid = paymentMethod === 'online_paid';
        const effectiveMethod = isOnlinePaid ? 'online' : paymentMethod;

        // ... (wallet check remains)

        // 2. Create the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                consumer_id: userId,
                merchant_id: merchantId,
                address_id: data.addressId,
                delivery_address: address.address,
                delivery_lat: address.latitude,
                delivery_lng: address.longitude,
                subtotal,
                delivery_fee: deliveryFee,
                total_price: totalAmount,
                status: OrderStatus.PENDING,
                notes: data.notes || '',
                payment_method: effectiveMethod,
                payment_status: (effectiveMethod === 'wallet' || isOnlinePaid) ? 'paid' : 'pending'
            }])
            .select()
            .single();

        if (orderError) throw new Error(orderError.message);

        // 2. Debit wallet if applicable
        if (effectiveMethod === 'wallet') {
            await walletService.debit(userId, totalAmount, order.id);
        }

        // 3. Insert order items
        const itemsToInsert = orderItemsData.map((item: any) => ({ ...item, order_id: order.id }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

        if (itemsError) throw new Error(itemsError.message);

        // 4. Clear cart
        await cartService.clearCart(userId);

        let fullOrder = null;
        try {
            fullOrder = await this.getOrderForMerchant(order.id);
        } catch (fetchError: any) {
            console.error('[OrdersService] Error fetching full order for notification:', fetchError.message);
        }

        // 6. Notify Merchant via WebSocket
        console.log(`[OrdersService] Emitting new_order to merchant:${merchantId}`);
        socketService.emitToMerchant(merchantId, 'new_order', fullOrder || {
            ...order,
            consumer: null,
            address: {
                id: data.addressId,
                address: address.address,
                latitude: address.latitude,
                longitude: address.longitude
            },
            items: []
        });

        // 7. Send Push Notification to Merchant
        try {
            const { data: merchantUser } = await supabase
                .from('merchants')
                .select('user_id')
                .eq('id', merchantId)
                .single();

            if (merchantUser?.user_id) {
                await notificationsService.sendPushNotification(
                    merchantUser.user_id,
                    'New Order Received!',
                    `You have a new order (#${order.id.toString().slice(0, 8)}) for NGN ${order.total_price}`,
                    { orderId: order.id, type: 'new_order' }
                );
            }
        } catch (pushError: any) {
            console.error('[OrdersService] Failed to send push notification:', pushError.message);
        }

        // 8. Auto-cancel if not accepted within 3 minutes (180,000 ms)
        setTimeout(async () => {
            try {
                // Check if order is still PENDING
                const { data: currentOrder, error: fetchError } = await supabase
                    .from('orders')
                    .select('status, payment_status, total_price, consumer_id, merchant_id')
                    .eq('id', order.id)
                    .single();

                if (!fetchError && currentOrder && currentOrder.status === OrderStatus.PENDING) {
                    // Update status to CANCELLED
                    const { data: updatedOrder, error: updateError } = await supabase
                        .from('orders')
                        .update({ 
                            status: OrderStatus.CANCELLED, 
                            notes: order.notes ? `${order.notes}\nAuto-cancelled: Merchant did not accept in time` : 'Auto-cancelled: Merchant did not accept in time' 
                        })
                        .eq('id', order.id)
                        .select()
                        .single();

                    if (!updateError && updatedOrder) {
                        // Refund if paid
                        if (currentOrder.payment_status === 'paid') {
                            await walletService.credit(currentOrder.consumer_id, currentOrder.total_price, `Refund for unaccepted order ${order.id}`);
                            await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', order.id);
                        }

                        // Get full order for notifications
                        const fullOrder = await this.getHydratedOrderById(order.id);

                        // Notify User via WebSocket
                        socketService.emitToUser(currentOrder.consumer_id, 'order_status_changed', fullOrder);

                        // Notify Merchant via WebSocket to remove from queue
                        socketService.emitToMerchant(currentOrder.merchant_id, 'order_cancelled', { orderId: order.id });

                        // Notify User via Push
                        await notificationsService.sendPushNotification(
                            currentOrder.consumer_id,
                            'Order Cancelled',
                            `Your order #${order.id.toString().slice(0, 8)} was cancelled because the merchant didn't accept it in time. A refund has been issued to your wallet.`,
                            { orderId: order.id, status: OrderStatus.CANCELLED, type: 'order_status_update' }
                        );
                    }
                }
            } catch (err) {
                console.error('[OrdersService] Auto-cancel timeout error:', err);
            }
        }, 3 * 60 * 1000);

        return order;
    }

    async acceptOrder(merchantId: string, orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .update({ status: OrderStatus.ACCEPTED })
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        const fullOrder = await this.getHydratedOrderById(orderId);

        // Notify User via WebSocket
        socketService.emitToUser(data.consumer_id, 'order_status_changed', fullOrder);
        socketService.emitToAvailableDrivers('available_order_cancelled', { orderId: data.id });

        // Notify User via Push
        try {
            await notificationsService.sendPushNotification(
                data.consumer_id,
                'Order Accepted!',
                `Your order #${orderId.toString().slice(0, 8)} has been accepted and is being processed.`,
                { orderId, status: OrderStatus.ACCEPTED, type: 'order_status_update' }
            );
        } catch (pushError: any) {
            console.error('[OrdersService] Failed to send push notification:', pushError.message);
        }

        return fullOrder;
    }

    async declineOrder(merchantId: string, orderId: string, reason?: string) {
        const order = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (order.error) throw new Error(order.error.message);

        const { data, error } = await supabase
            .from('orders')
            .update({ status: OrderStatus.CANCELLED, notes: reason ? `${order.data.notes}\nDecline Reason: ${reason}` : order.data.notes })
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        const fullOrder = await this.getHydratedOrderById(orderId);

        // If paid via wallet, refund the user
        if (order.data.payment_method === 'wallet' && order.data.payment_status === 'paid') {
            await walletService.credit(order.data.consumer_id, order.data.total_price, `Refund for declined order ${orderId}`);
            await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', orderId);
        }

        // Notify User via WebSocket
        socketService.emitToUser(data.consumer_id, 'order_status_changed', fullOrder);

        // Notify User via Push
        try {
            await notificationsService.sendPushNotification(
                data.consumer_id,
                'Order Declined',
                `Sorry, your order #${orderId.toString().slice(0, 8)} was declined. ${reason ? 'Reason: ' + reason : ''}`,
                { orderId, status: OrderStatus.CANCELLED, type: 'order_status_update' }
            );
        } catch (pushError: any) {
            console.error('[OrdersService] Failed to send push notification:', pushError.message);
        }

        return fullOrder;
    }

    async updateOrderStatus(merchantId: string, orderId: string, status: OrderStatus) {
        if (!this.merchantManagedStatuses.includes(status)) {
            throw new Error('Merchants can only move orders to accepted, preparing, or ready_for_pickup');
        }

        const { data: existingOrder, error: existingOrderError } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .single();

        if (existingOrderError) throw new Error(existingOrderError.message);

        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        const fullOrder = await this.getHydratedOrderById(orderId);

        // Notify User via WebSocket
        socketService.emitToUser(data.consumer_id, 'order_status_changed', fullOrder);

        // Notify User via Push
        let title = 'Order Update';
        let body = `Your order status has changed to ${status.replace('_', ' ')}`;

        switch (status) {
            case OrderStatus.ACCEPTED:
                title = 'Order accepted!';
                body = 'The merchant has accepted your order.';
                break;
            case OrderStatus.PREPARING:
                title = 'Order is being prepared!';
                body = 'The merchant is now preparing your delicious meal.';
                break;
            case OrderStatus.READY_FOR_PICKUP:
                title = 'Order ready for pickup!';
                body = 'Your order is ready and waiting for a courier.';
                // Re-notify drivers if order still has no courier
                if (!data.courier_id) {
                    const fullOrderForDrivers = fullOrder;
                    socketService.emitToAvailableDrivers('new_available_order', fullOrderForDrivers);
                }
                break;
            case OrderStatus.PICKED_UP:
                title = 'Order picked up!';
                body = 'A courier has picked up your order and is heading your way.';
                break;
            case OrderStatus.ON_THE_WAY:
                title = 'Order on the way!';
                body = 'Your courier is nearby and will arrive shortly.';
                break;
            case OrderStatus.DELIVERED:
                title = 'Order Delivered!';
                body = 'Enjoy your delivery! Please rate your experience.';
                socketService.emitToAvailableDrivers('available_order_cancelled', { orderId: data.id });
                break;
        }

        try {
            await notificationsService.sendPushNotification(
                data.consumer_id,
                title,
                body,
                { orderId, status, type: 'order_status_update' }
            );
        } catch (pushError: any) {
            console.error('[OrdersService] Failed to send push notification:', pushError.message);
        }

        // --- Earnings Distribution ---
        if (status === OrderStatus.DELIVERED && existingOrder?.status !== OrderStatus.DELIVERED) {
            try {
                // Calculation: Merchant gets subtotal minus platform commission (e.g., 10%)
                // Delivery fee is excluded as it normally goes to the courier.
                const commissionRate = 0.10; // 10% Platform Commission
                const subtotal = data.subtotal || 0;
                const merchantShare = subtotal * (1 - commissionRate);

                console.log(`[OrdersService] Distributing earnings for order ${orderId}: Subtotal=${subtotal}, MerchantShare=${merchantShare}`);
                await earningsService.addEarning(data.merchant_id, merchantShare);
            } catch (earnError: any) {
                console.error('[OrdersService] Failed to distribute merchant earnings:', earnError.message);
            }
        }

        return fullOrder;
    }

    async getOrders(userId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), items:order_items(*, product:products(*))', { count: 'exact' })
            .eq('consumer_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getOrderById(userId: string, orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))')
            .eq('id', orderId)
            .eq('consumer_id', userId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async cancelOrder(userId: string, orderId: string) {
        const order = await this.getOrderById(userId, orderId);

        if (![OrderStatus.PENDING, OrderStatus.ACCEPTED].includes(order.status)) {
            throw new Error(`Cannot cancel order in ${order.status} status`);
        }

        const { data, error } = await supabase
            .from('orders')
            .update({ status: OrderStatus.CANCELLED })
            .eq('id', orderId)
            .eq('consumer_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        socketService.emitToAvailableDrivers('available_order_cancelled', { orderId: data.id });
        return this.getHydratedOrderById(orderId);
    }

    async rateOrder(userId: string, orderId: string, ratingData: any) {
        const order = await this.getOrderById(userId, orderId);

        if (order.status !== OrderStatus.DELIVERED) {
            throw new Error('Can only rate delivered orders');
        }

        const merchantRating = Number(ratingData.merchantRating ?? ratingData.rating);
        const courierRating = ratingData.courierRating !== undefined ? Number(ratingData.courierRating) : null;
        const comment = ratingData.comment || '';
        const createdReviews: any[] = [];

        if (merchantRating < 1 || merchantRating > 5) {
            throw new Error('merchantRating must be between 1 and 5');
        }

        const { data: existingMerchantReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('order_id', orderId)
            .eq('user_id', userId)
            .eq('merchant_id', order.merchant_id)
            .maybeSingle();

        if (!existingMerchantReview) {
            const { data: merchantReview, error: merchantReviewError } = await supabase
                .from('reviews')
                .insert([{
                    user_id: userId,
                    order_id: orderId,
                    merchant_id: order.merchant_id,
                    rating: merchantRating,
                    comment,
                }])
                .select()
                .single();
            if (merchantReviewError) throw new Error(merchantReviewError.message);
            createdReviews.push(merchantReview);
        }

        if (order.courier_id && courierRating !== null) {
            if (courierRating < 1 || courierRating > 5) {
                throw new Error('courierRating must be between 1 and 5');
            }

            const { data: existingCourierReview } = await supabase
                .from('reviews')
                .select('id')
                .eq('order_id', orderId)
                .eq('user_id', userId)
                .eq('courier_id', order.courier_id)
                .maybeSingle();

            if (!existingCourierReview) {
                const { data: courierReview, error: courierReviewError } = await supabase
                    .from('reviews')
                    .insert([{
                        user_id: userId,
                        order_id: orderId,
                        courier_id: order.courier_id,
                        rating: courierRating,
                        comment,
                    }])
                    .select()
                    .single();
                if (courierReviewError) throw new Error(courierReviewError.message);
                createdReviews.push(courierReview);
            }
        }

        await this.updateEntityAverageRating('merchant', order.merchant_id);
        if (order.courier_id) {
            await this.updateEntityAverageRating('courier', order.courier_id);
        }

        return {
            orderId,
            createdCount: createdReviews.length,
            reviews: createdReviews
        };
    }

    async getOrderTracking(userId: string, orderId: string) {
        const order = await this.getOrderById(userId, orderId);

        let trackingData: any = {
            order_id: orderId,
            status: order.status,
            courier_location: null,
            estimated_delivery_time: order.estimated_delivery_time || null,
        };

        if (order.courier_id && [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY].includes(order.status)) {
            // Fetch Courier Location from 'couriers' or a tracking table
            const { data: courierLoc } = await supabase
                .from('courier_locations')
                .select('lat, lng, updated_at')
                .eq('courier_id', order.courier_id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (courierLoc) {
                trackingData.courier_location = courierLoc;
            }
        }

        return trackingData;
    }

    async getDeliveryFeeEstimate(merchantId: string, addressId: string): Promise<number> {
        // Fetch Merchant Location
        const { data: merchant, error: mError } = await supabase
            .from('merchants')
            .select('latitude, longitude')
            .eq('id', merchantId)
            .single();

        if (mError || !merchant) throw new Error('Merchant location not found');

        // Fetch Address Location
        const { data: address, error: aError } = await supabase
            .from('addresses')
            .select('latitude, longitude')
            .eq('id', addressId)
            .single();

        if (aError || !address) throw new Error('Delivery address coordinates not found');

        if (merchant.latitude === null || merchant.longitude === null ||
            address.latitude === null || address.longitude === null) {
            // Fallback to a flat fee if coordinates are missing
            return 500;
        }

        const distanceKm = await locationService.calculateDistance(
            { lat: merchant.latitude, lng: merchant.longitude },
            { lat: address.latitude, lng: address.longitude }
        );

        return locationService.calculateDeliveryFee(distanceKm);
    }
}
