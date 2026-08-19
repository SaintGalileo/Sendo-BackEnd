import { supabase } from '../../config/supabase';

export class AdminCategoriesService {
    async listCategories(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('categories')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async createCategory(categoryData: Record<string, any>) {
        const { data, error } = await supabase
            .from('categories')
            .insert([categoryData])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Category created', data };
    }

    async updateCategory(id: string, updates: Record<string, any>) {
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Category updated', data };
    }

    async deleteCategory(id: string) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Category deleted' };
    }
}
