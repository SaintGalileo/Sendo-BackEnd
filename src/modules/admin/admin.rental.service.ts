import { supabase } from '../../config/supabase';

export class AdminRentalService {
    async getDashboard() {
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('type', 'rental');

            if (error) {
                return {
                    success: true,
                    data: { total_orders: 0, pending: 0, active: 0, completed: 0, cancelled: 0, revenue: 0 },
                };
            }

            const all = orders || [];
            const revenue = all
                .filter((o: any) => o.status === 'completed')
                .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

            return {
                success: true,
                data: {
                    total_orders: all.length,
                    pending: all.filter((o: any) => o.status === 'pending').length,
                    active: all.filter((o: any) => ['accepted', 'in_use'].includes(o.status)).length,
                    completed: all.filter((o: any) => o.status === 'completed').length,
                    cancelled: all.filter((o: any) => o.status === 'cancelled').length,
                    revenue,
                },
            };
        } catch {
            return {
                success: true,
                data: { total_orders: 0, pending: 0, active: 0, completed: 0, cancelled: 0, revenue: 0 },
            };
        }
    }
}
