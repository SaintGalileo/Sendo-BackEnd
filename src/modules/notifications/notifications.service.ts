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
            console.error(`[Push] Error sending push notification to user ${userId}:`, error.message);
            return null;
        }
    }

    async registerMerchantPushId(merchantId: string, pushId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .update({ push_id: pushId })
            .eq('id', merchantId)
            .select()
            .single();

        if (error) {
            console.warn('[registerMerchantPushId] Update error:', error.message);
            throw new Error(error.message);
        }
        return data;
    }

    async sendPushNotificationToMerchant(merchantId: string, title: string, body: string, data?: any) {
        try {
            // 1. Fetch push_id and user_id from merchants table
            const { data: store, error: sErr } = await supabase
                .from('merchants')
                .select('push_id, user_id, name')
                .eq('id', merchantId)
                .single();

            if (sErr || !store) {
                console.warn(`[Push to Merchant] Store ${merchantId} not found:`, sErr?.message);
                return null;
            }

            let pushToken = store.push_id;

            // Fallback to merchant owner's user fcm_token if merchant.push_id is not set
            if (!pushToken && store.user_id) {
                const { data: user } = await supabase
                    .from('users')
                    .select('fcm_token')
                    .eq('id', store.user_id)
                    .single();
                pushToken = user?.fcm_token;
            }

            if (!pushToken) {
                console.warn(`[Push to Merchant] No push_id or FCM token found for store ${merchantId} (${store.name})`);
                return null;
            }

            // 2. Prepare message
            const message = {
                notification: {
                    title,
                    body,
                },
                data: {
                    merchantId: String(merchantId),
                    ...(data || {}),
                },
                token: pushToken,
            };

            // 3. Send via Firebase
            const response = await messaging.send(message);
            console.log(`[Push to Merchant] Successfully sent push notification to merchant ${store.name} (${merchantId}):`, response);

            // 4. Optionally log to notifications table
            if (store.user_id) {
                await supabase.from('notifications').insert([{
                    user_id: store.user_id,
                    title,
                    message: body,
                    type: 'merchant_push',
                    is_read: false
                }]);
            }

            return response;
        } catch (error: any) {
            console.error(`[Push to Merchant] Error sending notification to merchant ${merchantId}:`, error.message);
            return null;
        }
    }
}

