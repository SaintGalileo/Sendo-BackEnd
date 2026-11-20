import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';
import { CartService } from '../cart/cart.service';
import { WalletService } from '../payments/wallet.service';
import { SocketService } from '../notifications/socket.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BASE_DELIVERY_FEE, locationService, parseLatLng } from './location.service';
import { MerchantEarningsService } from '../merchant/earnings.service';
import { UtilityService } from '../utility/utility.service';
import { SurgeService } from '../utility/surge.service';
import { computeProductSurgePrice } from '../utility/product-surge.util';
import { PaystackService } from '../payments/paystack.service';
import { EmailService } from '../notifications/email.service';
import { orderSettlementService } from './settlement.service';

const cartService = new CartService();
const walletService = new WalletService();
const socketService = SocketService.getInstance();
const notificationsService = new NotificationsService();
const earningsService = new MerchantEarningsService();
const utilityService = new UtilityService();
const surgeService = new SurgeService();
const paystackService = new PaystackService();
const emailService = new EmailService();

const DELIVERY_QUOTE_CACHE_TTL_MS = 10 * 60 * 1000;

export type DeliveryFeeEstimate = {
    fee: number;
    currency: string;
    base_fee: number;
    surge: { flat: number; percent: number; score: number; reasons: string[] };
    pickup_distance_km: number;
    dropoff_distance_km: number;
    total_distance_km: number;
    estimated_courier_earning: number;
    includes_courier_pickup_distance: boolean;
};

export class OrdersService {
    private readonly deliveryQuoteCache = new Map<
        string,
        { estimate: DeliveryFeeEstimate; expiresAt: number }
    >();
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
        const order = data as any;
        return {
            ...order,
            order_type: order?.fulfillment_type || order?.order_type || 'delivery',
        };
    }

    private async getHydratedOrderById(orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), consumer:users!consumer_id(id, first_name, last_name, phone, email), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))')
            .eq('id', orderId)
            .single();

        if (error) throw new Error(error.message);
        // Compat alias for vendor app (expects order_type)
        const order = data as any;
        return {
            ...order,
            order_type: order?.fulfillment_type || order?.order_type || 'delivery',
        };
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
        const fulfillmentType =
            String(data.fulfillmentType || data.fulfillment_type || 'delivery').toLowerCase() === 'pickup'
                ? 'pickup'
                : 'delivery';

        // Only verified merchants can receive live orders
        let merchantModes: 'pickup' | 'delivery' | 'both' = 'delivery';
        let merchantStore: {
            id: string;
            name?: string;
            address?: string | null;
            latitude?: number | null;
            longitude?: number | null;
        } | null = null;
        if (merchantId) {
            const { data: merchant, error: merchantErr } = await supabase
                .from('merchants')
                .select('id, status, name, address, latitude, longitude, is_online, is_pickup_only, fulfillment_modes')
                .eq('id', merchantId)
                .single();
            if (merchantErr || !merchant) throw new Error('Merchant not found');
            merchantStore = merchant;
            const st = String(merchant.status || '').toLowerCase();
            if (st !== 'verified' && st !== 'active' && st !== 'approved') {
                throw new Error(
                    'This merchant is not verified yet and cannot receive orders. Please choose another store.',
                );
            }
            if (merchant.is_online === false) {
                throw new Error('This store is currently closed and cannot receive orders.');
            }

            const rawModes = String(merchant.fulfillment_modes || '').toLowerCase();
            if (rawModes === 'pickup' || rawModes === 'delivery' || rawModes === 'both') {
                merchantModes = rawModes;
            } else if (merchant.is_pickup_only === true) {
                merchantModes = 'pickup';
            }

            if (fulfillmentType === 'pickup' && merchantModes === 'delivery') {
                throw new Error('This store does not offer pickup.');
            }
            if (fulfillmentType === 'delivery' && merchantModes === 'pickup') {
                throw new Error('This store only offers pickup.');
            }
        }

        let subtotal = 0;
        let merchantSubtotal = 0;
        const surgePercentage = await utilityService.getProductSurgePercentage();

        const orderItemsData = cartItems.map((item: any) => {
            const basePrice = Number(item.product?.price) || 0;
            const price = computeProductSurgePrice(basePrice, surgePercentage);
            const extraCost = (item.extras || []).reduce((sum: number, ext: any) => sum + (ext.price || 0), 0);
            const itemTotal = (price + extraCost) * item.quantity;
            subtotal += itemTotal;

            const merchantItemTotal = (basePrice + extraCost) * item.quantity;
            merchantSubtotal += merchantItemTotal;

            return {
                product_id: item.product_id,
                quantity: item.quantity,
                price: price,
                extras: item.extras,
            };
        });

        let deliveryFee = 0;
        let deliveryEstimate: DeliveryFeeEstimate | null = null;
        let usedCachedQuote = false;
        const quoteCacheKey =
            fulfillmentType === 'delivery' && data.addressId
                ? `${userId}:${merchantId}:${data.addressId}`
                : null;
        let addressId: string | null = null;
        // DB still has NOT NULL on delivery_address — for pickup, snapshot store location
        let deliveryAddress: string =
            merchantStore?.address?.trim() ||
            (merchantStore?.name ? `${merchantStore.name} (store pickup)` : 'Store pickup');
        let deliveryLat: number | null = merchantStore?.latitude != null ? Number(merchantStore.latitude) : null;
        let deliveryLng: number | null = merchantStore?.longitude != null ? Number(merchantStore.longitude) : null;

        if (fulfillmentType === 'delivery') {
            if (!data.addressId) throw new Error('Delivery address is required');

            const { data: address, error: addressError } = await supabase
                .from('addresses')
                .select('address, latitude, longitude')
                .eq('id', data.addressId)
                .single();

            if (addressError || !address) throw new Error('Delivery address not found');

            const cachedQuote = quoteCacheKey ? this.deliveryQuoteCache.get(quoteCacheKey) : undefined;
            if (cachedQuote && cachedQuote.expiresAt > Date.now()) {
                deliveryEstimate = cachedQuote.estimate;
                usedCachedQuote = true;
            } else {
                if (quoteCacheKey) this.deliveryQuoteCache.delete(quoteCacheKey);
                deliveryEstimate = await this.getDeliveryFeeEstimate(merchantId, data.addressId, userId);
            }

            deliveryFee = deliveryEstimate.fee;
            addressId = data.addressId;
            deliveryAddress = address.address;
            deliveryLat = address.latitude;
            deliveryLng = address.longitude;
        }

        let totalAmount = subtotal + deliveryFee;
        const paymentMethod = data.paymentMethod || 'wallet';
        // Treat 'online_paid' as fully paid (Paystack verified)
        const isOnlinePaid = paymentMethod === 'online_paid';
        const effectiveMethod = isOnlinePaid ? 'online' : paymentMethod;
        const paymentReference = data.paymentReference ? String(data.paymentReference).trim() : '';

        if (isOnlinePaid) {
            if (!paymentReference) {
                throw new Error('Payment reference is required for online payments');
            }
            const verified = await paystackService.verifyTransaction(paymentReference);
            if (!verified.paid) {
                throw new Error(`Payment not successful (status: ${verified.status})`);
            }

            if (verified.amountNaira + 1 < totalAmount && !usedCachedQuote && deliveryEstimate) {
                const merchantPoint = parseLatLng(merchantStore?.latitude, merchantStore?.longitude);
                const customerPoint = parseLatLng(deliveryLat, deliveryLng);
                if (merchantPoint && customerPoint) {
                    const dropoffTrip = await locationService.calculateTwoLegTrip(
                        null,
                        merchantPoint,
                        customerPoint,
                    );
                    const dropoffMinFee = surgeService.applySurge(dropoffTrip.fee, deliveryEstimate.surge);
                    if (verified.amountNaira + 1 >= subtotal + dropoffMinFee) {
                        deliveryFee = Math.max(dropoffMinFee, Math.round(verified.amountNaira - subtotal));
                        totalAmount = subtotal + deliveryFee;
                        deliveryEstimate = {
                            ...deliveryEstimate,
                            fee: deliveryFee,
                            estimated_courier_earning: locationService.calculateCourierEarning(deliveryFee),
                        };
                    }
                }
            }

            // Paid amount must cover order total (1 Naira tolerance)
            if (verified.amountNaira + 1 < totalAmount) {
                throw new Error(
                    `Paid amount (₦${verified.amountNaira}) is less than order total (₦${totalAmount})`,
                );
            }
        }

        const notesBase = data.notes != null ? String(data.notes).trim() : '';
        const riderNotesBase = data.riderNotes != null ? String(data.riderNotes).trim() : notesBase;
        const merchantNotesBase = data.merchantNotes != null ? String(data.merchantNotes).trim() : '';

        const pickupCode = fulfillmentType === 'pickup' ? Math.floor(1000 + Math.random() * 9000).toString() : null;
        const deliveryCode = fulfillmentType === 'delivery' ? Math.floor(1000 + Math.random() * 9000).toString() : null;
        const driverPickupCode = fulfillmentType === 'delivery' ? Math.floor(1000 + Math.random() * 9000).toString() : null;

        // 2. Create the order
        const orderPayload: any = {
            consumer_id: userId,
            merchant_id: merchantId,
            address_id: addressId,
            delivery_address: deliveryAddress,
            delivery_lat: deliveryLat,
            delivery_lng: deliveryLng,
            subtotal,
            merchant_subtotal: merchantSubtotal,
            delivery_fee: deliveryFee,
            total_price: totalAmount,
            courier_earning: deliveryEstimate ? deliveryEstimate.estimated_courier_earning : 0,
            pickup_distance_km: deliveryEstimate ? deliveryEstimate.pickup_distance_km : 0,
            dropoff_distance_km: deliveryEstimate ? deliveryEstimate.dropoff_distance_km : 0,
            total_distance_km: deliveryEstimate ? deliveryEstimate.total_distance_km : 0,
            status: OrderStatus.PENDING,
            notes: riderNotesBase || notesBase || null,
            merchant_notes: merchantNotesBase || null,
            rider_notes: riderNotesBase || null,
            pickup_code: pickupCode,
            delivery_code: deliveryCode,
            driver_pickup_code: driverPickupCode,
            payment_reference: isOnlinePaid && paymentReference ? paymentReference : null,
            payment_method: effectiveMethod,
            payment_status: (effectiveMethod === 'wallet' || isOnlinePaid) ? 'paid' : 'pending',
            fulfillment_type: fulfillmentType,
        };

        let { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([orderPayload])
            .select()
            .single();

        const pricingCols = [
            'courier_earning',
            'pickup_distance_km',
            'dropoff_distance_km',
            'total_distance_km',
        ];
        const legacyOptionalCols = [
            'merchant_notes',
            'rider_notes',
            'merchant_subtotal',
            'pickup_code',
            'delivery_code',
            'driver_pickup_code',
        ];

        // Graceful fallback if pricing columns do not exist yet in Supabase
        if (
            orderError &&
            (pricingCols.some((c) => orderError?.message?.includes(c)) ||
                (orderError as any).code === 'PGRST204')
        ) {
            for (const col of pricingCols) {
                delete orderPayload[col];
            }

            const pricingFallbackRes = await supabase
                .from('orders')
                .insert([orderPayload])
                .select()
                .single();
            order = pricingFallbackRes.data;
            orderError = pricingFallbackRes.error;
        }

        // Graceful fallback if legacy note/code columns do not exist yet in Supabase
        if (
            orderError &&
            (legacyOptionalCols.some((c) => orderError?.message?.includes(c)) ||
                (orderError as any).code === 'PGRST204')
        ) {
            const combinedNotes = [
                merchantNotesBase ? `[Store]: ${merchantNotesBase}` : '',
                riderNotesBase ? `[Rider]: ${riderNotesBase}` : ''
            ].filter(Boolean).join('\n') || null;

            for (const col of [...legacyOptionalCols, ...pricingCols]) {
                delete orderPayload[col];
            }
            orderPayload.notes = combinedNotes;

            const fallbackRes = await supabase
                .from('orders')
                .insert([orderPayload])
                .select()
                .single();
            order = fallbackRes.data;
            orderError = fallbackRes.error;
        }

        if (orderError) throw new Error(orderError.message);

        if (quoteCacheKey) {
            this.deliveryQuoteCache.delete(quoteCacheKey);
        }

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
            address: addressId
                ? {
                    id: addressId,
                    address: deliveryAddress,
                    latitude: deliveryLat,
                    longitude: deliveryLng,
                }
                : null,
            items: [],
            fulfillment_type: fulfillmentType,
            order_type: fulfillmentType,
        });

        // 7. Send Push Notification to Merchant
        try {
            await notificationsService.sendPushNotificationToMerchant(
                merchantId,
                'New Order Received!',
                `You have a new order (#${order.id.toString().slice(0, 8)}) for NGN ${order.total_price}`,
                { orderId: order.id, type: 'new_order' }
            );
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
                    // Update status to CANCELLED atomically only if still PENDING
                    let updateRes = await supabase
                        .from('orders')
                        .update({ 
                            status: OrderStatus.CANCELLED, 
                            cancellation_reason: 'Auto-cancelled: Merchant did not accept in time'
                        })
                        .eq('id', order.id)
                        .eq('status', OrderStatus.PENDING)
                        .select()
                        .single();

                    if (updateRes.error && (updateRes.error.message?.includes('cancellation_reason') || (updateRes.error as any).code === 'PGRST204')) {
                        updateRes = await supabase
                            .from('orders')
                            .update({ status: OrderStatus.CANCELLED })
                            .eq('id', order.id)
                            .eq('status', OrderStatus.PENDING)
                            .select()
                            .single();
                    }

                    const updatedOrder = updateRes.data;
                    const updateError = updateRes.error;

                    if (!updateError && updatedOrder) {
                        // Atomic refund claim: only transition 'paid' -> 'refunded' once
                        if (currentOrder.payment_status === 'paid') {
                            const { data: refundClaim } = await supabase
                                .from('orders')
                                .update({ payment_status: 'refunded' })
                                .eq('id', order.id)
                                .eq('payment_status', 'paid')
                                .select('id, consumer_id, total_price')
                                .single();

                            if (refundClaim) {
                                await walletService.credit(refundClaim.consumer_id, refundClaim.total_price, `Refund for unaccepted order ${order.id}`);
                            }
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

        // If order was already cancelled or declined, exit early to prevent duplicate processing
        if (order.data.status === OrderStatus.CANCELLED) {
            console.log(`[OrdersService] Order ${orderId} is already cancelled/declined. Ignoring duplicate decline.`);
            return this.getHydratedOrderById(orderId);
        }

        const declineReason = reason || 'Declined by merchant';

        // Atomically transition status to CANCELLED and store cancellation_reason
        let { data, error } = await supabase
            .from('orders')
            .update({ status: OrderStatus.CANCELLED, cancellation_reason: declineReason })
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .neq('status', OrderStatus.CANCELLED)
            .select()
            .single();

        // Graceful fallback if cancellation_reason column does not exist yet in Supabase
        if (error && (error.message?.includes('cancellation_reason') || (error as any).code === 'PGRST204')) {
            console.log(`[OrdersService] cancellation_reason column not present yet, falling back to status update`);
            const fallbackRes = await supabase
                .from('orders')
                .update({ status: OrderStatus.CANCELLED })
                .eq('id', orderId)
                .eq('merchant_id', merchantId)
                .neq('status', OrderStatus.CANCELLED)
                .select()
                .single();
            data = fallbackRes.data;
            error = fallbackRes.error;
        }

        if (error || !data) {
            console.log(`[OrdersService] Order ${orderId} decline claimed by concurrent process.`);
            return this.getHydratedOrderById(orderId);
        }

        const fullOrder = await this.getHydratedOrderById(orderId);
        if (!(fullOrder as any).cancellation_reason) {
            (fullOrder as any).cancellation_reason = declineReason;
        }

        // Atomic refund: only transition 'paid' -> 'refunded' once
        if (order.data.payment_status === 'paid') {
            const { data: refundClaim } = await supabase
                .from('orders')
                .update({ payment_status: 'refunded' })
                .eq('id', orderId)
                .eq('payment_status', 'paid')
                .select('id, consumer_id, total_price, payment_method')
                .single();

            if (refundClaim) {
                console.log(`[OrdersService] Refunding ${refundClaim.total_price} to user ${refundClaim.consumer_id} for order ${orderId}`);
                await walletService.credit(refundClaim.consumer_id, refundClaim.total_price, `Refund for declined order ${orderId}`);
            }
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

    async updateOrderStatus(merchantId: string, orderId: string, status: OrderStatus, verificationCode?: string) {
        const { data: existingOrder, error: existingOrderError } = await supabase
            .from('orders')
            .select('status, fulfillment_type, courier_id, pickup_code')
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .single();

        if (existingOrderError) throw new Error(existingOrderError.message);

        const isPickup = String(existingOrder.fulfillment_type || 'delivery') === 'pickup';
        const allowed = isPickup
            ? [...this.merchantManagedStatuses, OrderStatus.DELIVERED]
            : this.merchantManagedStatuses;

        if (!allowed.includes(status)) {
            throw new Error(
                isPickup
                    ? 'Merchants can only move pickup orders to accepted, preparing, ready_for_pickup, or delivered'
                    : 'Merchants can only move orders to accepted, preparing, or ready_for_pickup',
            );
        }

        // Verify pickup code if completing a pickup order
        if (status === OrderStatus.DELIVERED && isPickup && (existingOrder as any).pickup_code) {
            const expectedCode = String((existingOrder as any).pickup_code).trim();
            const providedCode = verificationCode != null ? String(verificationCode).trim() : '';
            if (!providedCode || providedCode !== expectedCode) {
                throw new Error('Invalid pickup verification code. Please ask the customer for their 4-digit code.');
            }
        }

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
                if (isPickup) {
                    title = 'Ready for pickup!';
                    body = 'Your order is ready. Please collect it at the store.';
                } else {
                    title = 'Order ready for pickup!';
                    body = 'Your order is ready and waiting for a courier.';
                    if (!data.courier_id) {
                        socketService.emitToAvailableDrivers('new_available_order', fullOrder);

                        // Targeted smart dispatch: push-notify top-ranked nearby eligible riders
                        const mPoint = parseLatLng(
                            (fullOrder as any)?.merchant?.latitude,
                            (fullOrder as any)?.merchant?.longitude,
                        );
                        if (mPoint) {
                            locationService
                                .rankEligibleCouriersForMerchant(mPoint, {
                                    excludeOrderId: orderId,
                                    limit: 5,
                                })
                                .then((candidates) =>
                                    Promise.allSettled(
                                        candidates.map((c) =>
                                            notificationsService.sendPushNotificationToCourier(
                                                c.courierId,
                                                'New Delivery Nearby!',
                                                `${(fullOrder as any)?.merchant?.name || 'A store'} (${c.straightLineKm} km away) has an order ready for pickup.`,
                                                { orderId, type: 'new_available_order' },
                                            ),
                                        ),
                                    ),
                                )
                                .catch(() => {});
                        }
                    }
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
                title = isPickup ? 'Order collected!' : 'Order Delivered!';
                body = isPickup
                    ? 'Thanks for collecting your order. Please rate your experience.'
                    : 'Enjoy your delivery! Please rate your experience.';
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
        if (status === OrderStatus.PICKED_UP && existingOrder?.status !== OrderStatus.PICKED_UP) {
            orderSettlementService
                .settleMerchantForOrder(orderId, 'pickup', data)
                .catch((err: any) =>
                    console.error('[OrdersService] Failed pickup merchant settlement:', err?.message),
                );
        }

        if (status === OrderStatus.DELIVERED && existingOrder?.status !== OrderStatus.DELIVERED) {
            try {
                const settlement = await orderSettlementService.settleOrder(orderId, {
                    stage: 'delivery',
                    order: data,
                });

                // Send completion thank-you emails to customer and merchant
                emailService.sendOrderDeliveredEmails(orderId, fullOrder || data, settlement.merchant.amount).catch((err: any) => {
                    console.error('[OrdersService] Failed to send delivered emails:', err.message);
                });
            } catch (earnError: any) {
                console.error('[OrdersService] Failed to distribute order earnings:', earnError.message);
            }
        }

        return fullOrder;
    }

    async confirmDeliveryByCustomer(userId: string, orderId: string) {
        const { data: existingOrder, error: fetchError } = await supabase
            .from('orders')
            .select('id, consumer_id, merchant_id, courier_id, status, fulfillment_type')
            .eq('id', orderId)
            .eq('consumer_id', userId)
            .single();

        if (fetchError || !existingOrder) {
            throw new Error('Order not found');
        }

        const currentStatus = String(existingOrder.status || '').toLowerCase();
        if (currentStatus === OrderStatus.DELIVERED) {
            const settlement = await orderSettlementService.settleOrder(orderId, {
                stage: 'customer_confirm',
            });
            const fullOrder = await this.getHydratedOrderById(orderId);
            return { ...fullOrder, settlement };
        }

        if (![OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY].includes(currentStatus as OrderStatus)) {
            throw new Error('Only orders that have been picked up or are on the way can be confirmed as received.');
        }

        let { error: updateErr } = await supabase
            .from('orders')
            .update({
                status: OrderStatus.DELIVERED,
                delivery_proof_method: 'customer_confirm',
            })
            .eq('id', orderId)
            .eq('consumer_id', userId);

        if (updateErr && ((updateErr as any).code === 'PGRST204' || updateErr.message?.includes('delivery_proof_method'))) {
            const retry = await supabase
                .from('orders')
                .update({ status: OrderStatus.DELIVERED })
                .eq('id', orderId)
                .eq('consumer_id', userId);
            updateErr = retry.error;
        }

        if (updateErr) throw new Error(updateErr.message);

        const fullOrder = await this.getHydratedOrderById(orderId);
        const settlement = await orderSettlementService.settleOrder(orderId, {
            stage: 'customer_confirm',
            order: fullOrder,
        });

        socketService.emitToUser(existingOrder.consumer_id, 'order_status_changed', fullOrder);
        socketService.emitToMerchant(existingOrder.merchant_id, 'order_status_changed', fullOrder);
        if (existingOrder.courier_id) {
            socketService.emitToCourier(existingOrder.courier_id, 'order_status_changed', fullOrder);
        }
        socketService.emitToAvailableDrivers('available_order_cancelled', { orderId });

        emailService.sendOrderDeliveredEmails(orderId, fullOrder, settlement.merchant.amount).catch((err: any) => {
            console.error('[OrdersService] Failed to send delivered emails:', err.message);
        });

        return { ...fullOrder, settlement };
    }

    async autoSettleStaleDeliveries(staleMinutes = 90) {
        try {
            const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
            const { data: staleOrders, error } = await supabase
                .from('orders')
                .select('id, consumer_id, merchant_id, courier_id, status, updated_at')
                .in('status', [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY])
                .lt('updated_at', cutoff)
                .limit(50);

            if (error || !staleOrders || staleOrders.length === 0) {
                return { settledCount: 0 };
            }

            let settledCount = 0;
            for (const row of staleOrders) {
                try {
                    let { error: updateErr } = await supabase
                        .from('orders')
                        .update({
                            status: OrderStatus.DELIVERED,
                            delivery_proof_method: 'auto_sweep',
                        })
                        .eq('id', row.id);

                    if (updateErr && ((updateErr as any).code === 'PGRST204' || updateErr.message?.includes('delivery_proof_method'))) {
                        const retry = await supabase
                            .from('orders')
                            .update({ status: OrderStatus.DELIVERED })
                            .eq('id', row.id);
                        updateErr = retry.error;
                    }

                    if (updateErr) continue;

                    await orderSettlementService.settleOrder(row.id, { stage: 'auto_sweep' });
                    const fullOrder = await this.getHydratedOrderById(row.id).catch(() => null);
                    if (fullOrder) {
                        socketService.emitToUser(row.consumer_id, 'order_status_changed', fullOrder);
                        socketService.emitToMerchant(row.merchant_id, 'order_status_changed', fullOrder);
                        if (row.courier_id) {
                            socketService.emitToCourier(row.courier_id, 'order_status_changed', fullOrder);
                        }
                    }
                    settledCount += 1;
                } catch (innerErr: any) {
                    console.error(`[AutoSweep] Failed to settle stale order ${row.id}:`, innerErr?.message);
                }
            }

            if (settledCount > 0) {
                console.log(`[AutoSweep] Auto-settled ${settledCount} stale in-transit order(s).`);
            }
            return { settledCount };
        } catch (err: any) {
            console.error('[AutoSweep] Error sweeping stale deliveries:', err?.message);
            return { settledCount: 0 };
        }
    }

    async autoCancelStaleOrders(userId?: string) {
        try {
            const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
            let query = supabase
                .from('orders')
                .select('id, status, payment_status, total_price, consumer_id, merchant_id, notes')
                .eq('status', OrderStatus.PENDING)
                .lt('created_at', threeMinutesAgo);

            if (userId) {
                query = query.eq('consumer_id', userId);
            }

            const { data: staleOrders, error } = await query;
            if (error || !staleOrders || staleOrders.length === 0) return;

            for (const order of staleOrders) {
                // Atomically update only if still PENDING
                let cancelRes = await supabase
                    .from('orders')
                    .update({
                        status: OrderStatus.CANCELLED,
                        cancellation_reason: 'Auto-cancelled: Merchant did not accept in time'
                    })
                    .eq('id', order.id)
                    .eq('status', OrderStatus.PENDING)
                    .select()
                    .single();

                if (cancelRes.error && (cancelRes.error.message?.includes('cancellation_reason') || (cancelRes.error as any).code === 'PGRST204')) {
                    cancelRes = await supabase
                        .from('orders')
                        .update({ status: OrderStatus.CANCELLED })
                        .eq('id', order.id)
                        .eq('status', OrderStatus.PENDING)
                        .select()
                        .single();
                }

                const cancelledOrder = cancelRes.data;
                const cancelError = cancelRes.error;

                if (cancelError || !cancelledOrder) {
                    continue; // Already processed
                }

                // Atomic refund claim
                if (order.payment_status === 'paid') {
                    const { data: refundClaim } = await supabase
                        .from('orders')
                        .update({ payment_status: 'refunded' })
                        .eq('id', order.id)
                        .eq('payment_status', 'paid')
                        .select('id, consumer_id, total_price')
                        .single();

                    if (refundClaim) {
                        await walletService.credit(refundClaim.consumer_id, refundClaim.total_price, `Refund for unaccepted order ${order.id}`);
                    }
                }

                try {
                    const fullOrder = await this.getHydratedOrderById(order.id);
                    socketService.emitToUser(order.consumer_id, 'order_status_changed', fullOrder);
                    socketService.emitToMerchant(order.merchant_id, 'order_cancelled', { orderId: order.id });
                    await notificationsService.sendPushNotification(
                        order.consumer_id,
                        'Order Cancelled',
                        `Your order #${order.id.toString().slice(0, 8)} was cancelled because the merchant didn't accept it in time. A refund has been issued to your wallet.`,
                        { orderId: order.id, status: OrderStatus.CANCELLED, type: 'order_status_update' }
                    );
                } catch (notifyErr) {
                    console.error('[OrdersService] Notification error for stale order:', notifyErr);
                }
            }
        } catch (err) {
            console.error('[OrdersService] Error auto-cancelling stale orders:', err);
        }
    }

    async getOrders(userId: string, pagination: any) {
        await this.autoCancelStaleOrders(userId);

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
        await this.autoCancelStaleOrders(userId);

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

        // Atomically cancel only if still in cancellable status
        let cancelRes = await supabase
            .from('orders')
            .update({ 
                status: OrderStatus.CANCELLED,
                cancellation_reason: 'Cancelled by customer'
            })
            .eq('id', orderId)
            .eq('consumer_id', userId)
            .in('status', [OrderStatus.PENDING, OrderStatus.ACCEPTED])
            .select()
            .single();

        if (cancelRes.error && (cancelRes.error.message?.includes('cancellation_reason') || (cancelRes.error as any).code === 'PGRST204')) {
            cancelRes = await supabase
                .from('orders')
                .update({ status: OrderStatus.CANCELLED })
                .eq('id', orderId)
                .eq('consumer_id', userId)
                .in('status', [OrderStatus.PENDING, OrderStatus.ACCEPTED])
                .select()
                .single();
        }

        const data = cancelRes.data;
        const error = cancelRes.error;

        if (error || !data) {
            console.log(`[OrdersService] Order ${orderId} cancellation already processed.`);
            return this.getHydratedOrderById(orderId);
        }

        // Atomic refund claim if paid
        if (order.payment_status === 'paid') {
            const { data: refundClaim } = await supabase
                .from('orders')
                .update({ payment_status: 'refunded' })
                .eq('id', orderId)
                .eq('payment_status', 'paid')
                .select('id, consumer_id, total_price')
                .single();

            if (refundClaim) {
                await walletService.credit(refundClaim.consumer_id, refundClaim.total_price, `Refund for cancelled order ${orderId}`);
            }
        }

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

    async getDeliveryFeeEstimate(merchantId: string, addressId: string, userId?: string): Promise<DeliveryFeeEstimate> {
        const { data: merchant, error: mError } = await supabase
            .from('merchants')
            .select('latitude, longitude')
            .eq('id', merchantId)
            .single();

        if (mError || !merchant) throw new Error('Merchant location not found');

        const { data: address, error: aError } = await supabase
            .from('addresses')
            .select('latitude, longitude')
            .eq('id', addressId)
            .single();

        if (aError || !address) throw new Error('Delivery address coordinates not found');

        const merchantPoint = parseLatLng(merchant.latitude, merchant.longitude);
        const customerPoint = parseLatLng(address.latitude, address.longitude);

        if (!merchantPoint || !customerPoint) {
            return {
                fee: BASE_DELIVERY_FEE,
                currency: 'NGN',
                base_fee: BASE_DELIVERY_FEE,
                surge: { flat: 0, percent: 0, score: 0, reasons: [] as string[] },
                pickup_distance_km: 0,
                dropoff_distance_km: 0,
                total_distance_km: 0,
                estimated_courier_earning: locationService.calculateCourierEarning(BASE_DELIVERY_FEE),
                includes_courier_pickup_distance: false,
            };
        }

        const nearestCourier = await locationService.findNearestOnlineCourierLocation(merchantPoint);
        const trip = await locationService.calculateTwoLegTrip(
            nearestCourier?.location ?? null,
            merchantPoint,
            customerPoint,
        );
        const caps = await utilityService.getSurgeCaps();
        const surge = await surgeService.computeSurge(merchantPoint, customerPoint, caps);
        const fee = surgeService.applySurge(trip.fee, surge);
        const estimatedCourierEarning = locationService.calculateCourierEarning(fee);

        const estimate: DeliveryFeeEstimate = {
            fee,
            currency: 'NGN',
            base_fee: trip.fee,
            surge,
            pickup_distance_km: trip.pickupDistanceKm,
            dropoff_distance_km: trip.dropoffDistanceKm,
            total_distance_km: trip.totalDistanceKm,
            estimated_courier_earning: estimatedCourierEarning,
            includes_courier_pickup_distance: trip.includesPickupLeg,
        };

        if (userId) {
            this.deliveryQuoteCache.set(`${userId}:${merchantId}:${addressId}`, {
                estimate,
                expiresAt: Date.now() + DELIVERY_QUOTE_CACHE_TTL_MS,
            });
        }

        return estimate;
    }
}
