import { createHash } from 'crypto';
import { supabase } from '../../config/supabase';
import { SocketService } from '../notifications/socket.service';
import { OrderStatus } from '../../common/constants/orderStatus';
import type { MerchantType } from '../admin/moduleMerchantTypes';

const socketService = SocketService.getInstance();

/** Stable UUID-shaped id for synthetic "Uncategorized" catalog buckets (not stored in DB). */
function uncategorizedCategoryId(merchantId: string): string {
    const hex = createHash('sha1').update(`sendo:uncategorized:${merchantId}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export class MerchantOnboardingService {
    private merchantOrderSelect =
        '*, consumer:users!consumer_id(id, first_name, last_name, phone, email), address:addresses(*), items:order_items(*, product:products(*)), courier:couriers(*, user:users(*))';
    async registerMerchant(
        userId: string,
        firstName: string,
        lastName: string,
        shopName: string,
        type: MerchantType,
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
        bannerUrl: string | undefined = undefined,
        openingTime: string = '',
        closingTime: string = '',
        activeDays: string[] = [],
        offDays: string[] | undefined = undefined,
        isPickupOnly: boolean = false,
        deliveryRadius: number = 0,
        preparationTime: string = '15-25',
        deliveryFee: number = 0
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
                    status: 'unverified',
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
                    preparation_time: preparationTime,
                    delivery_fee: deliveryFee
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

    async listMerchantsByUserId(userId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching merchants:', error);
            return { success: false, message: 'Merchants not found', data: [] };
        }

        return { success: true, data: data || [] };
    }

    async getMerchantByUserId(userId: string, merchantId?: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching merchant(s):', error);
            return { success: false, message: 'Merchant not found', data: null, code: 'MERCHANT_NOT_FOUND' };
        }

        const merchants = data || [];
        if (merchants.length === 0) {
            return { success: false, message: 'Merchant not found', data: null, code: 'MERCHANT_NOT_FOUND' };
        }

        const mId = merchantId ? String(merchantId) : undefined;
        if (mId) {
            const match = merchants.find((m: any) => String(m.id) === mId);
            if (!match) {
                return {
                    success: false,
                    message: 'Merchant not found',
                    data: null,
                    code: 'MERCHANT_NOT_FOUND',
                };
            }
            return { success: true, data: match };
        }

        // Backward compatibility: if only one merchant exists, we can safely infer it.
        if (merchants.length === 1) return { success: true, data: merchants[0] };

        return {
            success: false,
            message: 'Multiple merchants found. merchantId is required for this request.',
            data: null,
            code: 'MERCHANT_SELECTION_REQUIRED',
            merchants,
        };
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

    async updateStatus(merchantId: string, status: string | boolean) {
        let updateData: any = {};

        if (typeof status === 'boolean') {
            updateData = { is_online: status };
        } else {
            if (!['open', 'closed', 'busy', 'online', 'offline'].includes(status)) {
                throw new Error('Invalid status. Must be open, closed, busy, online, or offline.');
            }
            // If the user hasn't added a 'status' column yet, they should use 'is_online' boolean
            // But we'll try to update 'status' if a string is provided.
            updateData = { status };
        }

        const { data, error } = await supabase
            .from('merchants')
            .update(updateData)
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
        const [{ data: categories, error: catErr }, { data: allProducts, error: prodErr }] =
            await Promise.all([
                supabase
                    .from('categories')
                    .select(
                        '*, products(*, extra_groups:product_extra_groups(*, options:product_extra_options(*)))',
                    )
                    .eq('merchant_id', merchantId)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('products')
                    .select(
                        '*, extra_groups:product_extra_groups(*, options:product_extra_options(*))',
                    )
                    .eq('merchant_id', merchantId)
                    .order('created_at', { ascending: false }),
            ]);

        if (catErr) throw new Error(catErr.message);
        if (prodErr) throw new Error(prodErr.message);

        const catalog = [...(categories || [])];
        const nestedIds = new Set<string>();
        for (const cat of catalog) {
            for (const p of (cat as { products?: { id?: string }[] }).products || []) {
                if (p?.id) nestedIds.add(String(p.id));
            }
        }

        // Admin (or bad data) can leave products without a category, or with a
        // category owned by another merchant — those never nest under catalog
        // categories and were invisible in the merchant app.
        const orphans = (allProducts || []).filter((p: { id?: string }) => !nestedIds.has(String(p.id)));
        if (orphans.length > 0) {
            catalog.push({
                id: uncategorizedCategoryId(merchantId),
                merchant_id: merchantId,
                name: 'Uncategorized',
                description: 'Assign these products to a category for the store menu',
                products: orphans,
            } as any);
        }

        return catalog;
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

        // If .single() fails (sometimes due to RLS delays or other issues), 
        // but the data was actually inserted, we handle it gracefully.
        if (error) {
            console.error('Create product error:', error.message);
            throw new Error(error.message);
        }
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
    async getOrders(merchantId: string, pagination: any, status?: string) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        let query = supabase
            .from('orders')
            .select(this.merchantOrderSelect, { count: 'exact' })
            .eq('merchant_id', merchantId);
        
        if (status) {
            query = query.eq('status', status);
        }

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getOrderById(merchantId: string, orderId: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(this.merchantOrderSelect)
            .eq('id', orderId)
            .eq('merchant_id', merchantId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getOngoingOrders(merchantId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const ongoingStatuses = [
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.PICKED_UP,
            OrderStatus.ON_THE_WAY
        ];

        const { data, count, error } = await supabase
            .from('orders')
            .select(this.merchantOrderSelect, { count: 'exact' })
            .eq('merchant_id', merchantId)
            .in('status', ongoingStatuses)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getCompletedOrders(merchantId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select(this.merchantOrderSelect, { count: 'exact' })
            .eq('merchant_id', merchantId)
            .eq('status', OrderStatus.DELIVERED)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getCancelledOrders(merchantId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select(this.merchantOrderSelect, { count: 'exact' })
            .eq('merchant_id', merchantId)
            .eq('status', OrderStatus.CANCELLED)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async getIncomingOrders(merchantId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('orders')
            .select(this.merchantOrderSelect, { count: 'exact' })
            .eq('merchant_id', merchantId)
            .eq('status', OrderStatus.PENDING)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
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

        // Notify User
        socketService.emitToUser(data.consumer_id, 'order_status_changed', data);

        return data;
    }

    // --- Product Extras (Add-ons) Management ---
    async createExtraGroup(merchantId: string, productId: string, groupData: any) {
        // Verify merchant owns the product
        const { data: product, error: pError } = await supabase
            .from('products')
            .select('id')
            .eq('id', productId)
            .eq('merchant_id', merchantId)
            .single();
        
        if (pError || !product) throw new Error('Product not found or access denied');

        const { data, error } = await supabase
            .from('product_extra_groups')
            .insert([{ ...groupData, product_id: productId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteExtraGroup(merchantId: string, groupId: string) {
        // Verify merchant owns the product associated with this group
        const { data: group, error: gError } = await supabase
            .from('product_extra_groups')
            .select('product_id, products(merchant_id)')
            .eq('id', groupId)
            .single();

        if (gError || !group) throw new Error('Extra group not found');
        
        // This check depends on how supabase returns joined data, 
        // usually it's group.products.merchant_id
        const groupMerchantId = (group.products as any)?.merchant_id;
        if (groupMerchantId !== merchantId) throw new Error('Access denied');

        const { error } = await supabase
            .from('product_extra_groups')
            .delete()
            .eq('id', groupId);

        if (error) throw new Error(error.message);
        return true;
    }

    async addExtraOption(merchantId: string, groupId: string, optionData: any) {
        // Verify merchant owns the extra group
        const { data: group, error: gError } = await supabase
            .from('product_extra_groups')
            .select('id, products(merchant_id)')
            .eq('id', groupId)
            .single();

        if (gError || !group) throw new Error('Extra group not found');
        
        const groupMerchantId = (group.products as any)?.merchant_id;
        if (groupMerchantId !== merchantId) throw new Error('Access denied');

        const { data, error } = await supabase
            .from('product_extra_options')
            .insert([{ ...optionData, extra_group_id: groupId }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async deleteExtraOption(merchantId: string, optionId: string) {
        // Verify merchant owns the extra group associated with this option
        const { data: option, error: oError } = await supabase
            .from('product_extra_options')
            .select('extra_group_id, product_extra_groups(products(merchant_id))')
            .eq('id', optionId)
            .single();

        if (oError || !option) throw new Error('Extra option not found');
        
        const optionMerchantId = (option.product_extra_groups as any)?.products?.merchant_id;
        if (optionMerchantId !== merchantId) throw new Error('Access denied');

        const { error } = await supabase
            .from('product_extra_options')
            .delete()
            .eq('id', optionId);

        if (error) throw new Error(error.message);
        return true;
    }
}
