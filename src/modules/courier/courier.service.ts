import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';

export class CourierService {
    // --- Profile ---
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('couriers')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw new Error(error.message);

        // If not found, create a basic profile record or return null
        if (!data) {
            const { data: newData, error: createError } = await supabase
                .from('couriers')
                .insert([{ user_id: userId, is_online: false }])
                .select()
                .single();

            if (createError) throw new Error(createError.message);
            return newData;
        }

        return data;
    }

    async updateProfile(userId: string, updateData: any) {
        const profile = await this.getProfile(userId);
        const { data, error } = await supabase
            .from('couriers')
            .update(updateData)
            .eq('id', profile.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    // --- Availability ---
    async setOnlineStatus(userId: string, isOnline: boolean) {
        const profile = await this.getProfile(userId);
        const { data, error } = await supabase
            .from('couriers')
            .update({ is_online: isOnline })
            .eq('id', profile.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getStatus(userId: string) {
        const profile = await this.getProfile(userId);
        return { isOnline: profile.is_online };
    }

    // --- Jobs / Orders ---
    async getAvailableOrders() {
        // Needs a PostGIS nearest neighbor query in real app.
        // For now, fetch orders that are READY_FOR_PICKUP and don't have a courier_id
        const { data, error } = await supabase
            .from('orders')
            .select('*, merchant:merchants(*), address:addresses(*)')
            .eq('status', OrderStatus.READY_FOR_PICKUP)
            .is('courier_id', null);

        if (error) throw new Error(error.message);
        return data;
    }

    async acceptOrder(userId: string, orderId: string) {
        const profile = await this.getProfile(userId);

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('status, courier_id')
            .eq('id', orderId)
            .single();

        if (orderError) throw new Error('Order not found');
        if (order.courier_id) throw new Error('Order already assigned');

        const { data, error } = await supabase
            .from('orders')
            .update({ courier_id: profile.id, status: OrderStatus.ON_THE_WAY }) // Or just set courier and keep it READY depending on flow
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async rejectOrder(userId: string, orderId: string) {
        // For a food app, reject just means this courier didn't accept it.
        // We typically handle this by tracking rejections in a `courier_order_rejections` table 
        // to prevent showing it again to this courier. 
        const profile = await this.getProfile(userId);

        const { error } = await supabase
            .from('courier_order_rejections')
            .insert([{ courier_id: profile.id, order_id: orderId }]);

        if (error) throw new Error(error.message);
        return true;
    }

    // --- Delivery Process ---
    async updateOrderDeliveryStatus(userId: string, orderId: string, status: string) {
        const profile = await this.getProfile(userId);

        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .eq('courier_id', profile.id)
            .select()
            .single();

        if (error) throw new Error(error.message);

        // If delivered, calculate earnings
        if (status === OrderStatus.DELIVERED) {
            await this.addEarning(profile.id, data.delivery_fee * 0.8, orderId); // Assuming courier gets 80%
        }

        return data;
    }

    // --- Earnings ---
    async getEarnings(userId: string) {
        const profile = await this.getProfile(userId);

        const { data, error } = await supabase
            .from('courier_earnings')
            .select('*')
            .eq('courier_id', profile.id);

        if (error) throw new Error(error.message);

        const totalEarned = data.reduce((sum, earn) => sum + earn.amount, 0);
        return { totalEarned, currentBalance: totalEarned }; // Assuming no payouts modeled yet
    }

    async getEarningsHistory(userId: string, pagination: any) {
        const profile = await this.getProfile(userId);

        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('courier_earnings')
            .select('*', { count: 'exact' })
            .eq('courier_id', profile.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    private async addEarning(courierId: string, amount: number, orderId: string) {
        const { error } = await supabase
            .from('courier_earnings')
            .insert([{ courier_id: courierId, amount, order_id: orderId }]);

        if (error) console.error('Error adding earning', error);
    }
}
