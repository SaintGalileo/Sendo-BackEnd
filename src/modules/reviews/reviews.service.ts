import { supabase } from '../../config/supabase';

export class ReviewsService {
    // Note: Creating a review is typically handled when rating an order (done in consumer orders service).
    // The prompt asks for POST /reviews. Let's make it flexible.
    async createReview(userId: string, targetId: string, type: 'store' | 'courier', rating: number, comment: string) {
        const payload: any = {
            user_id: userId,
            rating,
            comment,
        };

        if (type === 'store') {
            payload.merchant_id = targetId;
        } else if (type === 'courier') {
            payload.courier_id = targetId;
        }

        const { data, error } = await supabase
            .from('reviews')
            .insert([payload])
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Background task: update merchant/courier aggregate rating

        return data;
    }

    async getStoreReviews(storeId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('reviews')
            .select('*, user:users(full_name, avatar_url)', { count: 'exact' })
            .eq('merchant_id', storeId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getCourierReviews(courierId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('reviews')
            .select('*, user:users(full_name, avatar_url)', { count: 'exact' })
            .eq('courier_id', courierId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }
}
