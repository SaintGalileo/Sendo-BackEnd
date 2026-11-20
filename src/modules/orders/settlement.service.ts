import { supabase } from '../../config/supabase';
import { MerchantEarningsService } from '../merchant/earnings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocketService } from '../notifications/socket.service';
import { locationService } from './location.service';

export type SettlementStage =
    | 'pickup'
    | 'delivery'
    | 'customer_confirm'
    | 'admin_force'
    | 'auto_sweep';

export type PartySettlementResult = {
    settled: boolean;
    alreadySettled: boolean;
    amount: number;
};

const merchantSettledGuard = new Set<string>();
const courierSettledGuard = new Set<string>();

function isMissingRelationOrFunction(error: any, token: string): boolean {
    if (!error) return false;
    const msg = `${error.message || ''}`.toLowerCase();
    return (
        error.code === '42P01' ||
        error.code === '42883' ||
        error.code === 'PGRST205' ||
        error.code === 'PGRST202' ||
        msg.includes(token.toLowerCase())
    );
}

export class OrderSettlementService {
    private readonly merchantEarningsService = new MerchantEarningsService();
    private readonly notificationsService = new NotificationsService();
    private readonly socketService = SocketService.getInstance();

    async computeMerchantShare(orderId: string, order?: any): Promise<number> {
        let share = Number(order?.merchant_subtotal || 0);

        if (!share) {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('quantity, price, extras, product:products(price)')
                .eq('order_id', orderId);

            if (orderItems && orderItems.length > 0) {
                share = orderItems.reduce((sum: number, it: any) => {
                    const basePrice =
                        it.product?.price != null ? Number(it.product.price) : Number(it.price || 0);
                    const extraCost = (it.extras || []).reduce(
                        (s: number, ext: any) => s + (Number(ext.price) || 0),
                        0,
                    );
                    return sum + (basePrice + extraCost) * (it.quantity || 1);
                }, 0);
            } else {
                share = Number(order?.subtotal || 0);
            }
        }

        return Math.round(Math.max(0, share) * 100) / 100;
    }

    computeCourierPayout(order: any): number {
        const stored = Number(order?.courier_earning || 0);
        if (stored > 0) return Math.round(stored * 100) / 100;
        return locationService.calculateCourierEarning(Number(order?.delivery_fee || 0));
    }

    async settleMerchantForOrder(
        orderId: string,
        stage: SettlementStage,
        existingOrder?: any,
    ): Promise<PartySettlementResult> {
        let order = existingOrder;
        if (!order) {
            const { data, error } = await supabase
                .from('orders')
                .select('id, merchant_id, subtotal, merchant_subtotal, total_price')
                .eq('id', orderId)
                .single();
            if (error || !data) return { settled: false, alreadySettled: false, amount: 0 };
            order = data;
        }

        if (!order.merchant_id) {
            return { settled: false, alreadySettled: false, amount: 0 };
        }

        const merchantShare = await this.computeMerchantShare(orderId, order);
        if (merchantShare <= 0) {
            return { settled: false, alreadySettled: false, amount: 0 };
        }

        // Idempotency claim via ledger table (with in-memory fallback if migration not yet applied)
        const { error: ledgerError } = await supabase
            .from('merchant_earning_entries')
            .insert([
                {
                    order_id: orderId,
                    merchant_id: order.merchant_id,
                    amount: merchantShare,
                    stage,
                },
            ]);

        if (ledgerError) {
            if (ledgerError.code === '23505') {
                merchantSettledGuard.add(orderId);
                return { settled: false, alreadySettled: true, amount: merchantShare };
            }
            if (isMissingRelationOrFunction(ledgerError, 'merchant_earning_entries')) {
                if (merchantSettledGuard.has(orderId)) {
                    return { settled: false, alreadySettled: true, amount: merchantShare };
                }
                merchantSettledGuard.add(orderId);
            } else {
                throw new Error(`Merchant settlement ledger error: ${ledgerError.message}`);
            }
        } else {
            merchantSettledGuard.add(orderId);
        }

        // Atomic balance increment via RPC, with safe fallback
        const { error: rpcError } = await supabase.rpc('increment_merchant_earnings', {
            p_merchant_id: order.merchant_id,
            p_amount: merchantShare,
        });

        if (rpcError) {
            if (isMissingRelationOrFunction(rpcError, 'increment_merchant_earnings')) {
                await this.merchantEarningsService.addEarning(order.merchant_id, merchantShare);
            } else {
                throw new Error(`Merchant balance credit error: ${rpcError.message}`);
            }
        }

        console.log(
            `[OrderSettlementService] Credited merchant ${order.merchant_id} ₦${merchantShare} for order ${orderId} (stage=${stage})`,
        );

        try {
            const { data: merchantStore } = await supabase
                .from('merchants')
                .select('user_id, name')
                .eq('id', order.merchant_id)
                .single();

            if (merchantStore?.user_id) {
                const notifyMessage = `Order settled! ₦${merchantShare.toLocaleString()} has been credited to your balance.`;
                this.socketService.emitToUser(merchantStore.user_id, 'merchant_earning_credited', {
                    subtotal: merchantShare,
                    commissionPercentage: 0,
                    commissionAmount: 0,
                    merchantShare,
                    message: notifyMessage,
                });

                await this.notificationsService.sendPushNotificationToMerchant(
                    order.merchant_id,
                    'Payout Credited!',
                    notifyMessage,
                    { type: 'EARNING_CREDITED', orderId },
                );
            }
        } catch (notifyErr: any) {
            console.warn('[OrderSettlementService] Merchant notification error:', notifyErr?.message);
        }

        return { settled: true, alreadySettled: false, amount: merchantShare };
    }

    async settleCourierForOrder(
        orderId: string,
        existingOrder?: any,
    ): Promise<PartySettlementResult> {
        let order = existingOrder;
        if (!order) {
            const { data, error } = await supabase
                .from('orders')
                .select('id, courier_id, delivery_fee, courier_earning')
                .eq('id', orderId)
                .single();
            if (error || !data) return { settled: false, alreadySettled: false, amount: 0 };
            order = data;
        }

        if (!order.courier_id) {
            return { settled: false, alreadySettled: false, amount: 0 };
        }

        const courierPayout = this.computeCourierPayout(order);
        if (courierPayout <= 0) {
            return { settled: false, alreadySettled: false, amount: 0 };
        }

        if (courierSettledGuard.has(orderId)) {
            return { settled: false, alreadySettled: true, amount: courierPayout };
        }

        // Check existing courier_earnings row for this order first (prevents duplicates even without unique index)
        const { data: existingEntry, error: lookupError } = await supabase
            .from('courier_earnings')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

        if (!lookupError && existingEntry) {
            courierSettledGuard.add(orderId);
            return { settled: false, alreadySettled: true, amount: courierPayout };
        }

        const { error: insertError } = await supabase
            .from('courier_earnings')
            .insert([{ courier_id: order.courier_id, amount: courierPayout, order_id: orderId }]);

        if (insertError) {
            if (insertError.code === '23505') {
                courierSettledGuard.add(orderId);
                return { settled: false, alreadySettled: true, amount: courierPayout };
            }
            throw new Error(`Courier settlement error: ${insertError.message}`);
        }

        courierSettledGuard.add(orderId);
        console.log(
            `[OrderSettlementService] Credited courier ${order.courier_id} ₦${courierPayout} for order ${orderId}`,
        );

        try {
            await this.notificationsService.sendPushNotificationToCourier(
                order.courier_id,
                'Trip Payout Credited!',
                `₦${courierPayout.toLocaleString()} has been added to your earnings.`,
                { type: 'COURIER_EARNING_CREDITED', orderId },
            );
        } catch (notifyErr: any) {
            console.warn('[OrderSettlementService] Courier notification error:', notifyErr?.message);
        }

        return { settled: true, alreadySettled: false, amount: courierPayout };
    }

    async settleOrder(
        orderId: string,
        options?: { stage?: SettlementStage; order?: any },
    ): Promise<{ merchant: PartySettlementResult; courier: PartySettlementResult }> {
        let order = options?.order;
        if (!order) {
            const { data, error } = await supabase
                .from('orders')
                .select(
                    'id, merchant_id, courier_id, subtotal, merchant_subtotal, delivery_fee, courier_earning, total_price',
                )
                .eq('id', orderId)
                .single();
            if (error || !data) {
                throw new Error(error?.message || 'Order not found for settlement');
            }
            order = data;
        }

        const stage = options?.stage ?? 'delivery';
        const merchant = await this.settleMerchantForOrder(orderId, stage, order);
        const courier = order.courier_id
            ? await this.settleCourierForOrder(orderId, order)
            : { settled: false, alreadySettled: false, amount: 0 };

        // Stamp settled_at best-effort
        try {
            await supabase
                .from('orders')
                .update({ settled_at: new Date().toISOString() })
                .eq('id', orderId);
        } catch {
            // Optional column before migration
        }

        return { merchant, courier };
    }
}

export const orderSettlementService = new OrderSettlementService();
