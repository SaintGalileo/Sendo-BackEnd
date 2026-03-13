import { supabase } from '../../config/supabase';

export class WalletService {
    async getOrCreateWallet(userId: string) {
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') { // Not found
            const { data: newWallet, error: createError } = await supabase
                .from('wallets')
                .insert([{ user_id: userId, balance: 0 }])
                .select()
                .single();

            if (createError) throw new Error(createError.message);
            return newWallet;
        }

        if (error) throw new Error(error.message);
        return data;
    }

    async debit(userId: string, amount: number, orderId?: string, description?: string) {
        const wallet = await this.getOrCreateWallet(userId);

        if (wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }

        const newBalance = wallet.balance - amount;

        // Perform in a transaction conceptually, or use a RPC for atomic update if possible
        // For now, standard update
        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', wallet.id);

        if (updateError) throw new Error(updateError.message);

        const { error: txnError } = await supabase
            .from('wallet_transactions')
            .insert([{
                wallet_id: wallet.id,
                amount: amount,
                type: 'debit',
                description: description || `Payment for order ${orderId}`,
                order_id: orderId
            }]);

        if (txnError) {
            // Rollback balance (not ideal, but without real transactions in this Supabase client setup...)
            await supabase.from('wallets').update({ balance: wallet.balance }).eq('id', wallet.id);
            throw new Error(txnError.message);
        }

        return { success: true, newBalance };
    }

    async credit(userId: string, amount: number, description: string) {
        const wallet = await this.getOrCreateWallet(userId);
        const newBalance = Number(wallet.balance) + amount;

        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', wallet.id);

        if (updateError) throw new Error(updateError.message);

        const { error: txnError } = await supabase
            .from('wallet_transactions')
            .insert([{
                wallet_id: wallet.id,
                amount: amount,
                type: 'credit',
                description: description
            }]);

        if (txnError) throw new Error(txnError.message);

        return { success: true, newBalance };
    }

    async getTransactions(userId: string, pagination: any) {
        const wallet = await this.getOrCreateWallet(userId);
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('wallet_transactions')
            .select('*', { count: 'exact' })
            .eq('wallet_id', wallet.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }
}
