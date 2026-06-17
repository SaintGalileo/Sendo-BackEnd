import { supabase } from '../../config/supabase';
import { messaging } from '../../config/firebase';

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
            .from('users')
            .update({
                fcm_token: token,
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateUserFcmToken(userId: string, token: string) {
        const { data, error } = await supabase
            .from('users')
            .update({ fcm_token: token })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async sendPushNotification(userId: string, title: string, body: string, data?: any) {
        try {
            // 1. Get user's FCM token
            const { data: user, error } = await supabase
                .from('users')
                .select('fcm_token')
                .eq('id', userId)
                .single();

            if (error || !user?.fcm_token) {
                console.warn(`[Push] No FCM token found for user ${userId}`);
                return null;
            }

            // 2. Prepare message
            const message = {
                notification: {
                    title,
                    body,
                },
                data: data || {},
                token: user.fcm_token,
            };

            // 3. Send via Firebase
            const response = await messaging.send(message);
            console.log(`[Push] Successfully sent message to user ${userId}:`, response);
            
            // 4. Optionally log to notifications table (internal history)
            await supabase.from('notifications').insert([{
                user_id: userId,
                title,
                message: body,
                type: 'push',
                is_read: false
            }]);

            return response;
        } catch (error: any) {
            console.error(`[Push] Error sending notification to user ${userId}:`, error.message);
            return null;
        }
    }
}
