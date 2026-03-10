import { supabase } from '../../config/supabase';

export class MerchantOnboardingService {
    async registerMerchant(
        userId: string,
        firstName: string,
        lastName: string,
        shopName: string,
        type: 'restaurant' | 'grocery',
        description: string,
        contactPhone: string,
        contactEmail: string,
        address: string,
        city: string,
        state: string,
        postalCode: string,
        country: string,
        latitude: number,
        longitude: number,
        logoUrl: string,
        bannerUrl?: string,
        openingTime?: string,
        closingTime?: string,
        activeDays: string[] = [],
        offDays?: string[],
        isPickupOnly: boolean = false,
        deliveryRadius: number = 0
    ) {
        const { data, error } = await supabase
            .from('merchants')
            .insert([
                {
                    user_id: userId,
                    first_name: firstName,
                    last_name: lastName,
                    name: shopName,
                    type,
                    description,
                    phone: contactPhone,
                    contact_email: contactEmail,
                    address,
                    city,
                    state,
                    postal_code: postalCode,
                    country,
                    latitude,
                    longitude,
                    logo_url: logoUrl,
                    banner_url: bannerUrl,
                    opening_time: openingTime,
                    closing_time: closingTime,
                    active_days: activeDays,
                    off_days: offDays,
                    is_pickup_only: isPickupOnly,
                    delivery_radius: deliveryRadius,
                },
            ])
            .select()
            .single();

        if (error) {
            console.error('Error registering merchant:', error);
            return { success: false, message: 'Failed to register merchant' };
        }

        return { success: true, data };
    }

    async getMerchantByUserId(userId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching merchant:', error);
            return { success: false, message: 'Merchant not found' };
        }

        return { success: true, data };
    }

    async updateStore(merchantId: string, updateData: any) {
        const { data, error } = await supabase
            .from('merchants')
            .update(updateData)
            .eq('id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateStatus(merchantId: string, status: string) {
        if (!['open', 'closed', 'busy'].includes(status)) {
            throw new Error('Invalid status. Must be open, closed, or busy.');
        }

        const { data, error } = await supabase
            .from('merchants')
            .update({ status }) // assuming 'status' column exists in merchants table
            .eq('id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    // --- Products Integration (Enhancing Menu Service functionality) ---
    async getCategories(merchantId: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('merchant_id', merchantId);

        if (error) throw new Error(error.message);
        return data;
    }

    async getCatalog(merchantId: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*, products(*)')
            .eq('merchant_id', merchantId);

        if (error) throw new Error(error.message);
        return data;
    }

    async createCategory(merchantId: string, name: string, description?: string) {
        const { data, error } = await supabase
            .from('categories')
            .insert([{ merchant_id: merchantId, name, description }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateProductAvailability(merchantId: string, productId: string, isAvailable: boolean) {
        const { data, error } = await supabase
            .from('products')
            .update({ is_available: isAvailable }) // assuming 'is_available' column exists
            .eq('id', productId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async createProduct(merchantId: string, productData: any) {
        const { data, error } = await supabase
            .from('products')
            .insert([{ ...productData, merchant_id: merchantId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteProduct(merchantId: string, productId: string) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('merchant_id', merchantId);

        if (error) throw new Error(error.message);
        return true;
    }

    async updateCategory(merchantId: string, categoryId: string, updateData: any) {
        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', categoryId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteCategory(merchantId: string, categoryId: string) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId)
            .eq('merchant_id', merchantId);

        if (error) throw new Error(error.message);
        return true;
    }

    // --- Order Management ---
    async getOrders(merchantId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select('*, customer:users!user_id(*), items:order_items(*, product:products(*))', { count: 'exact' })
            .eq('merchant_id', merchantId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getOrderById(merchantId: string, orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:users!user_id(*), items:order_items(*, product:products(*))')
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateOrderStatus(merchantId: string, orderId: string, status: string) {
        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }
}
