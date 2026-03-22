import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';
import { CartService } from '../cart/cart.service';
import { WalletService } from '../payments/wallet.service';
import { SocketService } from '../notifications/socket.service';
import { LocationService } from './location.service';

const cartService = new CartService();
const walletService = new WalletService();
const socketService = SocketService.getInstance();
const locationService = new LocationService();

export class OrdersService {
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
                payment_method: paymentMethod,
                payment_status: paymentMethod === 'wallet' ? 'paid' : 'pending'
            }])
            .select()
            .single();

        if (orderError) throw new Error(orderError.message);

        // 2. Debit wallet if applicable
        if (paymentMethod === 'wallet') {
            await walletService.debit(userId, totalAmount, order.id);
        }

        // 3. Insert order items
        const itemsToInsert = orderItemsData.map((item: any) => ({ ...item, order_id: order.id }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

        if (itemsError) throw new Error(itemsError.message);

        // 4. Clear cart
        await cartService.clearCart(userId);

        // 5. Notify Merchant via WebSocket
        socketService.emitToMerchant(merchantId, 'new_order', order);

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

        // Notify User
        socketService.emitToUser(data.consumer_id, 'order_status_changed', data);

        return data;
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

        // If paid via wallet, refund the user
        if (order.data.payment_method === 'wallet' && order.data.payment_status === 'paid') {
            await walletService.credit(order.data.consumer_id, order.data.total_price, `Refund for declined order ${orderId}`);
            await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', orderId);
        }

        // Notify User
        socketService.emitToUser(data.consumer_id, 'order_status_changed', data);

        return data;
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
            .select('*, merchant:merchants(*), address:addresses(*), items:order_items(*, product:products(*)), courier:users!courier_id(*)')
            .eq('id', orderId)
            .eq('user_id', userId)
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
        return data;
    }

    async rateOrder(userId: string, orderId: string, ratingData: any) {
        const order = await this.getOrderById(userId, orderId);

        if (order.status !== OrderStatus.DELIVERED) {
            throw new Error('Can only rate delivered orders');
        }

        const { data, error } = await supabase
            .from('reviews')
            .insert([{
                user_id: userId,
                order_id: orderId,
                merchant_id: order.merchant_id,
                courier_id: order.courier_id,
                rating: ratingData.rating,
                comment: ratingData.comment,
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
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
