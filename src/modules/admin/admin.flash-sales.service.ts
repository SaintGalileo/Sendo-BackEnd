import { supabase } from '../../config/supabase';

type FlashSaleBody = {
    title?: string;
    merchant_id?: string | null;
    store_name?: string | null;
    product_ids?: string[];
    discount_percent?: number;
    admin_percent?: number;
    owner_percent?: number;
    starts_at?: string | null;
    ends_at?: string | null;
    status?: string;
};

const SALE_SELECT = `
    *,
    merchant:merchants!flash_sales_merchant_id_fkey(id, name),
    products:flash_sale_products(product_id)
`;

function normalizeSale(row: any) {
    if (!row) return row;
    const productIds = Array.isArray(row.products)
        ? row.products.map((p: any) => p.product_id).filter(Boolean)
        : [];
    const { products, merchant, ...rest } = row;
    return {
        ...rest,
        store_name: rest.store_name || merchant?.name || null,
        merchant_name: merchant?.name || rest.store_name || null,
        product_ids: productIds,
        product_count: productIds.length,
        is_active: String(rest.status || '').toLowerCase() === 'active',
    };
}

export class AdminFlashSalesService {
    async list(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from('flash_sales')
            .select(SALE_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data: (data || []).map(normalizeSale),
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        };
    }

    async getById(id: string) {
        const { data, error } = await supabase
            .from('flash_sales')
            .select(SALE_SELECT)
            .eq('id', id)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data: normalizeSale(data) };
    }

    private async syncProducts(flashSaleId: string, productIds: string[]) {
        await supabase.from('flash_sale_products').delete().eq('flash_sale_id', flashSaleId);
        const unique = Array.from(new Set(productIds.filter(Boolean)));
        if (unique.length === 0) return { success: true as const };
        const rows = unique.map((product_id) => ({
            flash_sale_id: flashSaleId,
            product_id,
        }));
        const { error } = await supabase.from('flash_sale_products').insert(rows);
        if (error) return { success: false as const, message: error.message };
        return { success: true as const };
    }

    async create(body: FlashSaleBody) {
        const title = String(body.title || '').trim();
        if (!title) return { success: false, message: 'Title is required', data: null };

        const productIds = Array.isArray(body.product_ids) ? body.product_ids.map(String) : [];
        const insertRow = {
            title,
            merchant_id: body.merchant_id || null,
            store_name: body.store_name || null,
            discount_percent: Number(body.discount_percent) || 0,
            admin_percent: Number(body.admin_percent) || 0,
            owner_percent: Number(body.owner_percent) || 0,
            starts_at: body.starts_at || null,
            ends_at: body.ends_at || null,
            status: body.status || 'active',
        };

        const { data, error } = await supabase
            .from('flash_sales')
            .insert([insertRow])
            .select()
            .single();

        if (error) return { success: false, message: error.message, data: null };

        const sync = await this.syncProducts(data.id, productIds);
        if (!sync.success) return { success: false, message: sync.message, data: null };

        return this.getById(data.id);
    }

    async update(id: string, body: FlashSaleBody) {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) updates.title = String(body.title).trim();
        if (body.merchant_id !== undefined) updates.merchant_id = body.merchant_id || null;
        if (body.store_name !== undefined) updates.store_name = body.store_name || null;
        if (body.discount_percent !== undefined) updates.discount_percent = Number(body.discount_percent) || 0;
        if (body.admin_percent !== undefined) updates.admin_percent = Number(body.admin_percent) || 0;
        if (body.owner_percent !== undefined) updates.owner_percent = Number(body.owner_percent) || 0;
        if (body.starts_at !== undefined) updates.starts_at = body.starts_at || null;
        if (body.ends_at !== undefined) updates.ends_at = body.ends_at || null;
        if (body.status !== undefined) updates.status = body.status;

        const { error } = await supabase.from('flash_sales').update(updates).eq('id', id);
        if (error) return { success: false, message: error.message, data: null };

        if (Array.isArray(body.product_ids)) {
            const sync = await this.syncProducts(id, body.product_ids.map(String));
            if (!sync.success) return { success: false, message: sync.message, data: null };
        }

        return this.getById(id);
    }

    async delete(id: string) {
        const { error } = await supabase.from('flash_sales').delete().eq('id', id);
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Flash sale deleted' };
    }

    async setProducts(id: string, productIds: string[]) {
        const exists = await this.getById(id);
        if (!exists.success) return exists;
        const sync = await this.syncProducts(id, productIds);
        if (!sync.success) return { success: false, message: sync.message, data: null };
        return this.getById(id);
    }
}
