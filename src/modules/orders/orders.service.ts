import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';
import { CartService } from '../cart/cart.service';

const cartService = new CartService();

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

        const deliveryFee = data.deliveryFee || 5.00; // Flat fee or calculate dynamically
        const totalAmount = subtotal + deliveryFee;

        // 1. Create the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                user_id: userId,
                merchant_id: merchantId,
                address_id: data.addressId,
                subtotal,
                delivery_fee: deliveryFee,
                total_amount: totalAmount,
                status: OrderStatus.PENDING,
                notes: data.notes || '',
            }])
            .select()
            .single();

        if (orderError) throw new Error(orderError.message);

        // 2. Insert order items
        const itemsToInsert = orderItemsData.map((item: any) => ({ ...item, order_id: order.id }));
        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);

        if (itemsError) throw new Error(itemsError.message);

        // 3. Clear cart
        await cartService.clearCart(userId);

        return order;
    }

    async getOrders(userId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*)', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getOrderById(userId: string, orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), address:addresses(*), items:order_items(*, product:products(*))')
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
            .eq('user_id', userId)
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
}
