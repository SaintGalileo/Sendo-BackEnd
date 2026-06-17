import { supabase } from '../../config/supabase';
import { OrderStatus } from '../../common/constants/orderStatus';
import { SocketService } from '../notifications/socket.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantEarningsService } from '../merchant/earnings.service';

type DeliveryBucket = 'ongoing' | 'completed' | 'cancelled';
type CourierDeliveryOrder = Record<string, any>;
type CourierDeliveriesGrouped = {
    ongoing: CourierDeliveryOrder[];
    completed: CourierDeliveryOrder[];
    cancelled: CourierDeliveryOrder[];
};

export class CourierService {
    private readonly socketService = SocketService.getInstance();
    private readonly notificationsService = new NotificationsService();
    private readonly merchantEarningsService = new MerchantEarningsService();
    private readonly courierOrderSelect =
        '*, merchant:merchants(*), address:addresses(*), consumer:users!consumer_id(id, first_name, last_name, phone, email), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))';
    
    private readonly deliveryStatusMap = {
        ongoing: [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.READY_FOR_PICKUP],
        completed: [OrderStatus.DELIVERED],
        cancelled: [OrderStatus.CANCELLED]
    } as const;

    private isCourierLocationsTableMissing(error: any): boolean {
        if (!error) return false;
        const message = `${error.message || ''}`.toLowerCase();
        return error.code === '42P01' || error.code === 'PGRST205' || message.includes('courier_locations');
    }

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
    async setOnlineStatus(
        userId: string,
        isOnline: boolean,
        options?: {
            lat?: number;
            lng?: number;
            heading?: number;
            speed?: number;
            accuracy?: number;
            batteryLevel?: number;
            deviceId?: string;
            source?: string;
        }
    ) {
        const profile = await this.getProfile(userId);
        const { data, error } = await supabase
            .from('couriers')
            .update({ is_online: isOnline })
            .eq('id', profile.id)
            .select()
            .single();

        if (error) throw new Error(error.message);

        if (isOnline && options?.lat !== undefined && options?.lng !== undefined) {
            const { error: locationError } = await supabase
                .from('courier_locations')
                .upsert({
                    courier_id: profile.id,
                    lat: options.lat,
                    lng: options.lng,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'courier_id' });

            if (locationError) {
                if (!this.isCourierLocationsTableMissing(locationError)) {
                    throw new Error(locationError.message);
                }

                console.warn('[CourierService] courier_locations table missing; online status updated without location write.');
            }
        }

        return {
            ...data,
            liveContext: options
                ? {
                    lat: options.lat,
                    lng: options.lng,
                    heading: options.heading,
                    speed: options.speed,
                    accuracy: options.accuracy,
                    batteryLevel: options.batteryLevel,
                    deviceId: options.deviceId,
                    source: options.source
                }
                : null
        };
    }

    async getStatus(userId: string) {
        const profile = await this.getProfile(userId);
        return { isOnline: profile.is_online };
    }

    // --- Jobs / Orders ---
    async getAvailableOrders() {
        // Needs a PostGIS nearest neighbor query in real app.
        // For now, only expose orders that are actually ready for pickup.
        const { data, error } = await supabase
            .from('orders')
            .select(this.courierOrderSelect)
            .eq('status', OrderStatus.READY_FOR_PICKUP)
            .is('courier_id', null);

        if (error) throw new Error(error.message);
        return data;
    }

    async getOrderByIdForCourier(userId: string, orderId: string) {
        const profile = await this.getProfile(userId);
        const { data, error } = await supabase
            .from('orders')
            .select(this.courierOrderSelect)
            .eq('id', orderId)
            .or(`courier_id.eq.${profile.id},courier_id.is.null`)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getDeliveries(userId: string, bucket: DeliveryBucket): Promise<CourierDeliveryOrder[]>;
    async getDeliveries(userId: string): Promise<CourierDeliveriesGrouped>;
    async getDeliveries(userId: string, bucket?: DeliveryBucket): Promise<CourierDeliveryOrder[] | CourierDeliveriesGrouped> {
        const profile = await this.getProfile(userId);

        if (bucket) {
            const statuses = this.deliveryStatusMap[bucket];
            const { data, error } = await supabase
                .from('orders')
                .select('*, merchant:merchants(*), address:addresses(*), items:order_items(*, product:products(*))')
                .eq('courier_id', profile.id)
                .in('status', [...statuses])
                .order('created_at', { ascending: false });

            if (error) throw new Error(error.message);
            return data || [];
        }

        const [ongoing, completed, cancelled]: [CourierDeliveryOrder[], CourierDeliveryOrder[], CourierDeliveryOrder[]] = await Promise.all([
            this.getDeliveries(userId, 'ongoing'),
            this.getDeliveries(userId, 'completed'),
            this.getDeliveries(userId, 'cancelled')
        ]);

        return {
            ongoing,
            completed,
            cancelled
        };
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
        if (order.status !== OrderStatus.READY_FOR_PICKUP) {
            throw new Error('Order is not ready for pickup yet');
        }

        const { data: assignedOrder, error } = await supabase
            .from('orders')
            .update({ courier_id: profile.id }) // Just assign courier, status stays the same (e.g., PREPARING)
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        const data = await this.getOrderByIdForCourier(userId, orderId);

        // Notify User and Merchant
        this.socketService.emitToUser(data.consumer_id, 'order_status_changed', data);
        this.socketService.emitToMerchant(data.merchant_id, 'courier_assigned', data);
        this.socketService.emitToAvailableDrivers('available_order_taken', {
            orderId: data.id,
            courierId: profile.id
        });

        // Notify User via Push
        try {
            await this.notificationsService.sendPushNotification(
                data.consumer_id,
                'Courier Assigned!',
                `A courier has been assigned to your order and is heading to the merchant.`,
                { orderId, type: 'courier_assigned' }
            );
        } catch (pushError: any) {
            console.error('[CourierService] Failed to send push notification:', pushError.message);
        }

        return data || assignedOrder;
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
        const { data: existingOrder, error: existingOrderError } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .eq('courier_id', profile.id)
            .single();

        if (existingOrderError) throw new Error(existingOrderError.message);

        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .eq('courier_id', profile.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        const data = await this.getOrderByIdForCourier(userId, orderId);

        // Notify User and Merchant
        this.socketService.emitToUser(data.consumer_id, 'order_status_changed', data);
        this.socketService.emitToMerchant(data.merchant_id, 'order_status_changed', data);

        // Notify User via Push
        let title = 'Order Update';
        let body = `Your order status has changed to ${status.replace('_', ' ')}`;

        switch (status) {
            case OrderStatus.PICKED_UP:
                title = 'Order Picked Up!';
                body = 'The courier has picked up your order and is on the way.';
                break;
            case OrderStatus.ON_THE_WAY:
                title = 'Order on the Way!';
                body = 'Your courier is nearby!';
                break;
            case OrderStatus.DELIVERED:
                title = 'Order Delivered!';
                body = 'Enjoy your meal!';
                break;
        }

        try {
            await this.notificationsService.sendPushNotification(
                data.consumer_id,
                title,
                body,
                { orderId, status, type: 'order_status_update' }
            );
        } catch (pushError: any) {
            console.error('[CourierService] Failed to send push notification:', pushError.message);
        }

        // If delivered, calculate earnings
        if (status === OrderStatus.DELIVERED && existingOrder?.status !== OrderStatus.DELIVERED) {
            await this.addEarning(profile.id, data.delivery_fee * 0.8, orderId); // Assuming courier gets 80%
            const commissionRate = 0.10;
            const subtotal = Number(data.subtotal || 0);
            const merchantShare = subtotal * (1 - commissionRate);
            await this.merchantEarningsService.addEarning(data.merchant_id, merchantShare);
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
