import { supabase } from '../../config/supabase';

export class ProductsService {
    async getProductById(productId: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*, category:categories(*), merchant:merchants(*), extras(*)')
            .eq('id', productId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getProducts(filters: any, pagination: any) {
        let query = supabase.from('products').select('*, merchant:merchants(*), category:categories(*)', { count: 'exact' });

        if (filters.storeId) {
            query = query.eq('merchant_id', filters.storeId);
        }

        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const from = pagination.offset;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        return { data: data || [], totalCount: count || 0 };
    }
}
