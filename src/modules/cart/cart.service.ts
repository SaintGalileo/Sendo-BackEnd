import { supabase } from '../../config/supabase';

export class CartService {
    async getCart(userId: string) {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*, product:products(*, merchant:merchants(*))')
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return data;
    }

    async addItem(userId: string, productId: string, quantity: number, extras: any[] = []) {
        // First check if user already has items from a different store.
        // Food delivery usually restricts carts to a single store at a time.
        const cart = await this.getCart(userId);
        if (cart && cart.length > 0) {
            // Check if adding product from the same store
            const { data: product } = await supabase.from('products').select('merchant_id').eq('id', productId).single();
            const existingStoreId = cart[0].product?.merchant_id;

            if (product && existingStoreId && product.merchant_id !== existingStoreId) {
                throw new Error('Cannot add items from multiple stores to the same cart. Clear cart first.');
            }
        }

        // Check if item already exists
        const existingItem = cart.find((item: any) => item.product_id === productId && JSON.stringify(item.extras || []) === JSON.stringify(extras));

        if (existingItem) {
            // Update quantity
            return this.updateItem(userId, existingItem.id, existingItem.quantity + quantity);
        }

        // Create new cart item
        const { data, error } = await supabase
            .from('cart_items')
            .insert([{ user_id: userId, product_id: productId, quantity, extras }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async updateItem(userId: string, itemId: string, quantity: number) {
        if (quantity <= 0) {
            return this.removeItem(userId, itemId);
        }

        const { data, error } = await supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', itemId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async removeItem(userId: string, itemId: string) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return true;
    }

    async clearCart(userId: string) {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return true;
    }
}
