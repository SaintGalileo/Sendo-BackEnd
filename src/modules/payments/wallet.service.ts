import { supabase } from '../../config/supabase';
import { PaystackService } from './paystack.service';

const paystackService = new PaystackService();

export class WalletService {
    async getOrCreateWallet(userId: string, forceRefresh = false) {
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

            // Trigger Paystack dedicated account creation for new wallet
            return await this.ensurePaystackAccount(userId, newWallet);
        }

        if (error) throw new Error(error.message);

        // If wallet exists but lacks account details or refresh forced
        if (!data.account_number || forceRefresh) {
            return await this.ensurePaystackAccount(userId, data);
        }

        return data;
    }

    async refreshVirtualAccount(userId: string) {
        const wallet = await this.getOrCreateWallet(userId, false);
        return await this.ensurePaystackAccount(userId, wallet);
    }

    private async ensurePaystackAccount(userId: string, wallet: any) {
        try {
            console.log(`[WALLET] Ensuring Paystack dedicated account for user ${userId}`);
            // Fetch user details for Paystack customer creation
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('first_name, last_name, email, phone')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                console.error(`[WALLET] Failed to fetch user ${userId} for Paystack:`, userError);
                return wallet;
            }

            const firstName = user.first_name || 'Sendo';
            const lastName = user.last_name || 'User';
            const email = user.email || `${userId}@sendo.express`;
            const phone = user.phone || undefined;

            console.log(`[WALLET] Calling Paystack DVA for ${firstName} ${lastName} (${email})`);
            const paystackResponse = await paystackService.createDedicatedVirtualAccount({
                email,
                firstName,
                lastName,
                phone,
            });

            if (paystackResponse && paystackResponse.accountNumber) {
                console.log(`[WALLET] Paystack account created: ${paystackResponse.accountNumber} (${paystackResponse.bankName})`);
                const { data: updatedWallet, error: updateError } = await supabase
                    .from('wallets')
                    .update({
                        account_number: paystackResponse.accountNumber,
                        bank_name: paystackResponse.bankName,
                        account_name: paystackResponse.accountName,
                        reference: paystackResponse.reference || paystackResponse.customerCode,
                    })
                    .eq('id', wallet.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('[WALLET] Failed to update wallet with Paystack details:', updateError);
                    return wallet;
                }
                return updatedWallet;
            }

            console.warn(`[WALLET] Paystack account creation returned empty for user ${userId}`);
            return wallet;
        } catch (error: any) {
            console.error('[WALLET] Error in ensurePaystackAccount:', error.response?.data || error.message);
            return wallet;
        }
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
