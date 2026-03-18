import { supabase } from '../../config/supabase';
import { SeerBitService } from './seerbit.service';

const seerbitService = new SeerBitService();

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

            // Trigger SeerBit account creation for new wallet
            return await this.ensureSeerBitAccount(userId, newWallet);
        }

        if (error) throw new Error(error.message);

        // If wallet exists but lacks account details, trigger it
        if (!data.account_number) {
            return await this.ensureSeerBitAccount(userId, data);
        }

        return data;
    }

    private async ensureSeerBitAccount(userId: string, wallet: any) {
        try {
            console.log(`[WALLET] Ensuring SeerBit account for user ${userId}`);
            // Fetch user details for SeerBit
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('first_name, last_name, email')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                console.error(`[WALLET] Failed to fetch user ${userId} for SeerBit:`, userError);
                return wallet;
            }

            const fullName = `${user.first_name} ${user.last_name}`;
            const email = user.email || 'no-email@sendo.com';
            const reference = `WAL_${userId.split('-')[0]}_${Date.now()}`;

            console.log(`[WALLET] Calling SeerBit for ${fullName} (${email}) with ref ${reference}`);
            const seerbitResponse = await seerbitService.createVirtualAccount(fullName, email, reference);

            if (seerbitResponse) {
                const { payments } = seerbitResponse.data;
                console.log(`[WALLET] SeerBit account created: ${payments.accountNumber} (${payments.bankName})`);
                const { data: updatedWallet, error: updateError } = await supabase
                    .from('wallets')
                    .update({
                        account_number: payments.accountNumber,
                        bank_name: payments.bankName,
                        account_name: payments.walletName,
                        reference: payments.reference
                    })
                    .eq('id', wallet.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('[WALLET] Failed to update wallet with SeerBit details:', updateError);
                    return wallet;
                }
                return updatedWallet;
            }

            console.warn(`[WALLET] SeerBit account creation failed for user ${userId}, check SeerBit service logs.`);
            return wallet;
        } catch (error) {
            console.error('[WALLET] Error in ensureSeerBitAccount:', error);
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
