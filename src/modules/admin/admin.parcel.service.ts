import { supabase } from '../../config/supabase';

export class AdminParcelService {
    async getDashboard() {
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('type', 'parcel');

            if (error) {
                return {
                    success: true,
                    data: { total_orders: 0, pending: 0, in_progress: 0, delivered: 0, cancelled: 0, revenue: 0 },
                };
            }

            const all = orders || [];
            const revenue = all
                .filter((o: any) => o.status === 'delivered')
                .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

            return {
                success: true,
                data: {
                    total_orders: all.length,
                    pending: all.filter((o: any) => o.status === 'pending').length,
                    in_progress: all.filter((o: any) => ['accepted', 'picked_up', 'on_the_way'].includes(o.status)).length,
                    delivered: all.filter((o: any) => o.status === 'delivered').length,
                    cancelled: all.filter((o: any) => o.status === 'cancelled').length,
                    revenue,
                },
            };
        } catch {
            return {
                success: true,
                data: { total_orders: 0, pending: 0, in_progress: 0, delivered: 0, cancelled: 0, revenue: 0 },
            };
        }
    }
}
