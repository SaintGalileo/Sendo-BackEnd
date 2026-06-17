import { supabase } from '../../config/supabase';

export class ReviewsService {
    private async updateEntityAverageRating(entity: 'merchant' | 'courier', entityId: string) {
        const column = entity === 'merchant' ? 'merchant_id' : 'courier_id';
        const table = entity === 'merchant' ? 'merchants' : 'couriers';

        const { data, error } = await supabase
            .from('reviews')
            .select('rating')
            .eq(column, entityId);

        if (error) throw new Error(error.message);
        const rows = data || [];
        if (rows.length === 0) return;

        const avg = rows.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / rows.length;
        await supabase.from(table).update({ rating: Number(avg.toFixed(2)) }).eq('id', entityId);
    }

    // Note: Creating a review is typically handled when rating an order (done in consumer orders service).
    // The prompt asks for POST /reviews. Let's make it flexible.
    async createReview(userId: string, targetId: string, type: 'store' | 'courier', rating: number, comment: string) {
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

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

        if (type === 'store') {
            await this.updateEntityAverageRating('merchant', targetId);
        } else {
            await this.updateEntityAverageRating('courier', targetId);
        }

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
