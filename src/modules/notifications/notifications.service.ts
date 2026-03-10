import { supabase } from '../../config/supabase';

// Real system would use FCM (Firebase Cloud Messaging) or similar
export class NotificationsService {
    async getNotifications(userId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async markAsRead(userId: string, notificationIds: string[]) {
        if (!notificationIds || notificationIds.length === 0) return true;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', notificationIds)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return true;
    }

    async registerDeviceToken(userId: string, token: string, deviceType: string = 'unknown') {
        const { data, error } = await supabase
            .from('user_devices')
            .upsert({
                user_id: userId,
                fcm_token: token,
                device_type: deviceType,
                updated_at: new Date().toISOString()
            }, { onConflict: 'fcm_token' }) // Or unique by user_id + device_id ideally
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }
}
