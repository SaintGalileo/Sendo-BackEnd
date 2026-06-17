import { supabase } from '../../config/supabase';

// In a real app, integrate Stripe or Paystack here
export class PaymentsService {
    async createIntent(userId: string, orderId: string, amount: number) {
        // Mock payment intent creation
        const { data, error } = await supabase
            .from('payments')
            .insert([{
                user_id: userId,
                order_id: orderId,
                amount,
                status: 'pending',
                transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return { clientSecret: 'mock_client_secret_' + data.transaction_id, payment: data };
    }

    async confirmPayment(userId: string, transactionId: string) {
        // Mock payment confirmation
        const { data, error } = await supabase
            .from('payments')
            .update({ status: 'completed' })
            .eq('transaction_id', transactionId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);

        // If payment completed, update order status to ACCEPTED
        if (data && data.status === 'completed') {
            await supabase
                .from('orders')
                .update({ status: 'accepted', payment_status: 'paid' })
                .eq('id', data.order_id);
        }

        return data;
    }

    async getHistory(userId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('payments')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    async addTip(userId: string, orderId: string, amount: number) {
        // Mock tipping logic
        const { data, error } = await supabase
            .from('payments')
            .insert([{
                user_id: userId,
                order_id: orderId,
                amount,
                status: 'completed',
                type: 'tip',
                transaction_id: `txn_tip_${Math.random().toString(36).substr(2, 9)}`,
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async refundPayment(userId: string, orderId: string) {
        const { data: payment, error: pError } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', orderId)
            .eq('user_id', userId)
            .eq('status', 'completed')
            .single();

        if (pError || !payment) throw new Error('No completed payment found for refund');

        const { data, error } = await supabase
            .from('payments')
            .update({ status: 'refunded' })
            .eq('id', payment.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }
}
