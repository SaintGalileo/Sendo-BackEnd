import { supabase } from '../../config/supabase';

interface ListFilters {
    search?: string;
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
}

const ALLOWED_MERCHANT_TYPES = ['restaurant', 'grocery', 'pharmacy', 'store'] as const;

interface CreateStoreInput {
    name: string;
    type: string;
    owner_name?: string;
    first_name?: string;
    last_name?: string;
    status?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    description?: string;
}

export class AdminStoresService {
    async createStore(input: CreateStoreInput) {
        const name = (input.name || '').trim();
        const type = (input.type || '').trim().toLowerCase();
        if (!name) return { success: false, message: 'Merchant name is required', data: null };
        if (!ALLOWED_MERCHANT_TYPES.includes(type as (typeof ALLOWED_MERCHANT_TYPES)[number])) {
            return {
                success: false,
                message: 'type must be one of: restaurant, grocery, pharmacy, store',
                data: null,
            };
        }

        let firstName = (input.first_name || '').trim();
        let lastName = (input.last_name || '').trim();
        if (!firstName && !lastName && input.owner_name) {
            const parts = input.owner_name.trim().split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }
        if (!firstName) return { success: false, message: 'Owner first name is required', data: null };

        const phone = (input.phone || '').trim() || null;
        const email = (input.email || '').trim().toLowerCase() || null;
        if (!phone && !email) {
            return { success: false, message: 'Phone or email is required for the merchant owner', data: null };
        }

        const status = (input.status || 'active').trim().toLowerCase();

        let userId: string | null = null;
        if (phone) {
            const { data: byPhone } = await supabase.from('users').select('id, role').eq('phone', phone).maybeSingle();
            if (byPhone) userId = byPhone.id as string;
        }
        if (!userId && email) {
            const { data: byEmail } = await supabase.from('users').select('id, role').eq('email', email).maybeSingle();
            if (byEmail) userId = byEmail.id as string;
        }

        if (userId) {
            const { data: existingMerchant } = await supabase
                .from('merchants')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            if (existingMerchant) {
                return { success: false, message: 'This user already has a merchant profile', data: null };
            }
            await supabase
                .from('users')
                .update({
                    first_name: firstName,
                    last_name: lastName || null,
                    email: email ?? undefined,
                    role: 'merchant',
                })
                .eq('id', userId);
        } else {
            const { data: newUser, error: userError } = await supabase
                .from('users')
                .insert([
                    {
                        phone,
                        email,
                        first_name: firstName,
                        last_name: lastName || null,
                        role: 'merchant',
                    },
                ])
                .select('id')
                .single();
            if (userError || !newUser) {
                return { success: false, message: userError?.message || 'Failed to create merchant owner', data: null };
            }
            userId = newUser.id as string;
        }

        const { data, error } = await supabase
            .from('merchants')
            .insert([
                {
                    user_id: userId,
                    first_name: firstName,
                    last_name: lastName || null,
                    name,
                    type,
                    status,
                    phone,
                    contact_email: email,
                    address: input.address || null,
                    city: input.city || null,
                    state: input.state || null,
                    description: input.description || null,
                },
            ])
            .select(`
                *,
                user:users!merchants_user_id_fkey(id, first_name, last_name, phone, email)
            `)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, message: 'Merchant created', data };
    }

    async listStores(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('merchants')
            .select(`
                *,
                user:users!merchants_user_id_fkey(id, first_name, last_name, phone, email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const { data, error, count } = await query;
        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getStore(id: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select(`
                *,
                user:users!merchants_user_id_fkey(id, first_name, last_name, phone, email),
                categories(*),
                products(*)
            `)
            .eq('id', id)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async updateStoreStatus(id: string, status: string) {
        const { data, error } = await supabase
            .from('merchants')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Store status updated', data };
    }

    async bulkCreateStores(rows: CreateStoreInput[]) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, message: 'rows array is required', data: null };
        }
        const errors: Array<{ row: number; message: string }> = [];
        let succeeded = 0;
        for (let i = 0; i < rows.length; i++) {
            const result = await this.createStore(rows[i]);
            if (result.success) succeeded += 1;
            else errors.push({ row: i + 1, message: result.message || 'Failed to create merchant' });
        }
        return {
            success: true,
            message: `Imported ${succeeded} of ${rows.length} merchants`,
            data: { total: rows.length, succeeded, failed: rows.length - succeeded, errors },
        };
    }
}
