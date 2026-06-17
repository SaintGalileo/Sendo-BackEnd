import { supabase } from '../../config/supabase';

export class MerchantEarningsService {
    async getOrCreateEarnings(merchantId: string) {
        const { data, error } = await supabase
            .from('merchant_earnings')
            .select('*')
            .eq('merchant_id', merchantId)
            .single();

        if (error && error.code === 'PGRST116') { // Not found
            const { data: newEarnings, error: createError } = await supabase
                .from('merchant_earnings')
                .insert([{ merchant_id: merchantId, total_earnings: 0, current_balance: 0 }])
                .select()
                .single();

            if (createError) throw new Error(createError.message);
            return newEarnings;
        }

        if (error) throw new Error(error.message);
        return data;
    }

    async addEarning(merchantId: string, amount: number) {
        const earnings = await this.getOrCreateEarnings(merchantId);
        
        const newTotal = Number(earnings.total_earnings) + amount;
        const newBalance = Number(earnings.current_balance) + amount;

        const { data, error } = await supabase
            .from('merchant_earnings')
            .update({
                total_earnings: newTotal,
                current_balance: newBalance
            })
            .eq('id', earnings.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getHistory(merchantId: string) {
        // We could also have a 'merchant_transactions' table for more detail
        // For now, return the current state
        return this.getOrCreateEarnings(merchantId);
    }
}
