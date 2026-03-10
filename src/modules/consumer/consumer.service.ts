import { supabase } from '../../config/supabase';

export class ConsumerService {
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, phone, avatar_url, role, created_at')
            .eq('id', userId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateProfile(userId: string, updateData: any) {
        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteAccount(userId: string) {
        // Soft delete or hard delete depending on your requirements.
        // Assuming hard delete here for simplicity given the endpoint
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw new Error(error.message);
        return true;
    }

    // --- Addresses ---
    async getAddresses(userId: string) {
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
    }

    async createAddress(userId: string, addressData: any) {
        const { data, error } = await supabase
            .from('addresses')
            .insert([{ ...addressData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateAddress(userId: string, addressId: string, addressData: any) {
        const { data, error } = await supabase
            .from('addresses')
            .update(addressData)
            .eq('id', addressId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteAddress(userId: string, addressId: string) {
        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('id', addressId)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return true;
    }

    // --- Favorites ---
    async getFavorites(userId: string) {
        const { data, error } = await supabase
            .from('favorites')
            .select('*, store:merchants(*)')
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return data;
    }

    async addFavorite(userId: string, storeId: string) {
        const { data, error } = await supabase
            .from('favorites')
            .insert([{ user_id: userId, store_id: storeId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async removeFavorite(userId: string, storeId: string) {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq('store_id', storeId);

        if (error) throw new Error(error.message);
        return true;
    }
}
