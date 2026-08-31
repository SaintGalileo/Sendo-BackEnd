import { supabase } from '../../config/supabase';

type RentalProvider = {
    id: string;
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    status?: string;
    created_at: string;
};

type RentalVehicle = {
    id: string;
    provider_id?: string;
    name: string;
    category?: string;
    registration_no?: string;
    status?: string;
    created_at: string;
};

export class AdminRentalService {
    private newId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    private async getKvList(key: string): Promise<Record<string, unknown>[]> {
        const { data } = await supabase.from('admin_settings').select('value').eq('key', key).maybeSingle();
        return Array.isArray(data?.value) ? (data.value as Record<string, unknown>[]) : [];
    }

    private async putKvList(key: string, value: Record<string, unknown>[]) {
        const { error } = await supabase
            .from('admin_settings')
            .upsert([{ key, value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
        if (error) return { success: false as const, message: error.message };
        return { success: true as const, message: 'Saved' };
    }

    async getDashboard() {
        try {
            const [ordersResult, salesResult] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, status, total_amount, created_at, consumer_id, merchant_id, trip_type')
                    .or('type.eq.rental,module.eq.rental')
                    .limit(2000),
                supabase
                    .from('orders')
                    .select('total_amount, created_at, status')
                    .or('type.eq.rental,module.eq.rental')
                    .in('status', ['delivered'])
                    .order('created_at', { ascending: false })
                    .limit(365),
            ]);

            const all = (!ordersResult.error && ordersResult.data) ? ordersResult.data : [];
            const statusOf = (o: { order_status?: string; status?: string }) =>
                o.status || o.order_status || '';

            const pending = all.filter((o) => statusOf(o) === 'pending').length;
            const ongoing = all.filter((o) =>
                ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(statusOf(o)),
            ).length;
            const completed = all.filter((o) => statusOf(o) === 'delivered').length;
            const cancelled = all.filter((o) => statusOf(o) === 'cancelled').length;

            const grossEarnings = all
                .filter((o) => statusOf(o) === 'delivered')
                .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            const tripTypeOf = (o: { trip_type?: string }) =>
                String(o.trip_type || '').toLowerCase();
            const hourly = all.filter((o) => tripTypeOf(o).includes('hour')).length;
            const distance = all.filter((o) => tripTypeOf(o).includes('distance')).length;
            const perDay = all.filter((o) =>
                tripTypeOf(o).includes('day') || tripTypeOf(o).includes('daily'),
            ).length;
            const typed = hourly + distance + perDay;
            const remainder = Math.max(0, all.length - typed);

            const dayMap: Record<string, number> = {};
            for (const row of salesResult.data || []) {
                const day = row.created_at?.slice(0, 10);
                if (!day) continue;
                dayMap[day] = (dayMap[day] || 0) + (Number(row.total_amount) || 0);
            }
            const salesSeries = Object.entries(dayMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, gross]) => ({ date, label: date.slice(5), gross }));

            const customerCounts: Record<string, number> = {};
            const providerCounts: Record<string, number> = {};
            for (const o of all) {
                if (o.consumer_id) customerCounts[o.consumer_id] = (customerCounts[o.consumer_id] || 0) + 1;
                if (o.merchant_id) providerCounts[o.merchant_id] = (providerCounts[o.merchant_id] || 0) + 1;
            }
            const topCustomers = Object.entries(customerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, trips]) => ({ id, name: `Customer ${String(id).slice(0, 6)}`, trips }));
            const topProviders = Object.entries(providerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, trips]) => ({ id, name: `Provider ${String(id).slice(0, 6)}`, trips }));

            return {
                success: true,
                data: {
                    total_trips: all.length,
                    trip_status: { pending, ongoing, completed, cancelled },
                    gross_earnings: grossEarnings,
                    hourly_trips: hourly || (remainder > 0 ? 0 : 0),
                    distance_trips: distance,
                    per_day_trips: perDay,
                    top_customers: topCustomers,
                    top_providers: topProviders,
                    salesSeries,
                },
            };
        } catch {
            return {
                success: true,
                data: {
                    total_trips: 0,
                    trip_status: { pending: 0, ongoing: 0, completed: 0, cancelled: 0 },
                    gross_earnings: 0,
                    hourly_trips: 0,
                    distance_trips: 0,
                    per_day_trips: 0,
                    top_customers: [],
                    top_providers: [],
                    salesSeries: [],
                },
            };
        }
    }

    async listProviders() {
        const list = await this.getKvList('rental_providers');
        return { success: true, data: list };
    }

    async createProvider(body: Record<string, unknown>) {
        const name = String(body.name || '').trim();
        if (!name) return { success: false, message: 'Provider name is required', data: null };

        const list = await this.getKvList('rental_providers');
        const created: RentalProvider = {
            id: this.newId(),
            name,
            company: String(body.company || '').trim() || undefined,
            email: String(body.email || '').trim() || undefined,
            phone: String(body.phone || '').trim() || undefined,
            status: String(body.status || 'active'),
            created_at: new Date().toISOString(),
        };
        list.unshift(created);
        const put = await this.putKvList('rental_providers', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Rental provider created', data: created };
    }

    async listVehicles() {
        const list = await this.getKvList('rental_vehicles');
        return { success: true, data: list };
    }

    async createVehicle(body: Record<string, unknown>, audit?: { actor: { id: string; email?: string | null }; reason: string }) {
        const name = String(body.name || '').trim();
        if (!name) return { success: false, message: 'Vehicle name is required', data: null };

        const list = await this.getKvList('rental_vehicles');
        const created: RentalVehicle = {
            id: this.newId(),
            provider_id: String(body.provider_id || '').trim() || undefined,
            name,
            category: String(body.category || '').trim() || undefined,
            registration_no: String(body.registration_no || '').trim() || undefined,
            status: String(body.status || 'active'),
            created_at: new Date().toISOString(),
        };
        list.unshift(created);
        const put = await this.putKvList('rental_vehicles', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        if (audit) {
            const { writeAuditLog, requireAuditReason, sanitizeForAudit } = await import('./admin.audit');
            const reason = requireAuditReason(audit.reason) || 'Rental vehicle created via admin';
            await writeAuditLog({
                action: 'create',
                entityType: 'rental_vehicle',
                entityId: created.id,
                entityLabel: created.name,
                reason,
                after: sanitizeForAudit(created as any),
                actor: audit.actor,
            });
        }
        return { success: true, message: 'Rental vehicle created', data: created };
    }

    async getProvider(id: string) {
        const list = await this.getKvList('rental_providers');
        const row = list.find((r) => String(r.id) === String(id));
        if (!row) return { success: false, message: 'Provider not found', data: null };
        return { success: true, data: row };
    }

    async updateProvider(
        id: string,
        body: Record<string, unknown>,
        audit: { actor: { id: string; email?: string | null }; reason: string },
    ) {
        const { writeAuditLog, requireAuditReason, sanitizeForAudit } = await import('./admin.audit');
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        const list = await this.getKvList('rental_providers');
        const idx = list.findIndex((r) => String(r.id) === String(id));
        if (idx < 0) return { success: false, message: 'Provider not found', data: null };
        const before = { ...list[idx] };
        const updated = {
            ...list[idx],
            name: body.name !== undefined ? String(body.name).trim() : list[idx].name,
            company: body.company !== undefined ? String(body.company || '').trim() || undefined : list[idx].company,
            email: body.email !== undefined ? String(body.email || '').trim() || undefined : list[idx].email,
            phone: body.phone !== undefined ? String(body.phone || '').trim() || undefined : list[idx].phone,
            status: body.status !== undefined ? String(body.status || 'active') : list[idx].status,
        };
        list[idx] = updated;
        const put = await this.putKvList('rental_providers', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        await writeAuditLog({
            action: 'update',
            entityType: 'rental_provider',
            entityId: id,
            entityLabel: String(updated.name || ''),
            reason,
            before: sanitizeForAudit(before),
            after: sanitizeForAudit(updated),
            actor: audit.actor,
        });
        return { success: true, message: 'Provider updated', data: updated };
    }

    async deleteProvider(
        id: string,
        audit: { actor: { id: string; email?: string | null }; reason: string },
    ) {
        const { writeAuditLog, requireAuditReason, sanitizeForAudit } = await import('./admin.audit');
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        const list = await this.getKvList('rental_providers');
        const before = list.find((r) => String(r.id) === String(id));
        if (!before) return { success: false, message: 'Provider not found', data: null };
        const next = list.filter((r) => String(r.id) !== String(id));
        const put = await this.putKvList('rental_providers', next);
        if (!put.success) return { success: false, message: put.message, data: null };
        await writeAuditLog({
            action: 'delete',
            entityType: 'rental_provider',
            entityId: id,
            entityLabel: String(before.name || ''),
            reason,
            before: sanitizeForAudit(before),
            actor: audit.actor,
        });
        return { success: true, message: 'Provider deleted', data: null };
    }

    async getVehicle(id: string) {
        const list = await this.getKvList('rental_vehicles');
        const row = list.find((r) => String(r.id) === String(id));
        if (!row) return { success: false, message: 'Vehicle not found', data: null };
        return { success: true, data: row };
    }

    async updateVehicle(
        id: string,
        body: Record<string, unknown>,
        audit: { actor: { id: string; email?: string | null }; reason: string },
    ) {
        const { writeAuditLog, requireAuditReason, sanitizeForAudit } = await import('./admin.audit');
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        const list = await this.getKvList('rental_vehicles');
        const idx = list.findIndex((r) => String(r.id) === String(id));
        if (idx < 0) return { success: false, message: 'Vehicle not found', data: null };
        const before = { ...list[idx] };
        const updated = {
            ...list[idx],
            name: body.name !== undefined ? String(body.name).trim() : list[idx].name,
            provider_id:
                body.provider_id !== undefined
                    ? String(body.provider_id || '').trim() || undefined
                    : list[idx].provider_id,
            category:
                body.category !== undefined
                    ? String(body.category || '').trim() || undefined
                    : list[idx].category,
            registration_no:
                body.registration_no !== undefined
                    ? String(body.registration_no || '').trim() || undefined
                    : list[idx].registration_no,
            status: body.status !== undefined ? String(body.status || 'active') : list[idx].status,
        };
        list[idx] = updated;
        const put = await this.putKvList('rental_vehicles', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        await writeAuditLog({
            action: 'update',
            entityType: 'rental_vehicle',
            entityId: id,
            entityLabel: String(updated.name || ''),
            reason,
            before: sanitizeForAudit(before),
            after: sanitizeForAudit(updated),
            actor: audit.actor,
        });
        return { success: true, message: 'Vehicle updated', data: updated };
    }

    async deleteVehicle(
        id: string,
        audit: { actor: { id: string; email?: string | null }; reason: string },
    ) {
        const { writeAuditLog, requireAuditReason, sanitizeForAudit } = await import('./admin.audit');
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        const list = await this.getKvList('rental_vehicles');
        const before = list.find((r) => String(r.id) === String(id));
        if (!before) return { success: false, message: 'Vehicle not found', data: null };
        const next = list.filter((r) => String(r.id) !== String(id));
        const put = await this.putKvList('rental_vehicles', next);
        if (!put.success) return { success: false, message: put.message, data: null };
        await writeAuditLog({
            action: 'delete',
            entityType: 'rental_vehicle',
            entityId: id,
            entityLabel: String(before.name || ''),
            reason,
            before: sanitizeForAudit(before),
            actor: audit.actor,
        });
        return { success: true, message: 'Vehicle deleted', data: null };
    }

    async listTrips(status?: string) {
        try {
            let query = supabase
                .from('orders')
                .select('id, status, total_amount, total_price, created_at, consumer_id, merchant_id, trip_type, type, module')
                .or('type.eq.rental,module.eq.rental')
                .order('created_at', { ascending: false })
                .limit(500);
            const { data, error } = await query;
            if (error) return { success: false, message: error.message, data: null };
            const statusOf = (o: { status?: string }) => String(o.status || '').toLowerCase();
            let rows = data || [];
            if (status && status !== 'all') {
                const s = status.toLowerCase();
                if (s === 'pending') rows = rows.filter((o) => statusOf(o) === 'pending');
                else if (s === 'ongoing') {
                    rows = rows.filter((o) =>
                        ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(statusOf(o)),
                    );
                } else if (s === 'completed') rows = rows.filter((o) => statusOf(o) === 'delivered');
                else if (s === 'cancelled') rows = rows.filter((o) => statusOf(o) === 'cancelled');
            }
            return { success: true, data: rows };
        } catch (e: any) {
            return { success: false, message: e?.message || 'Failed to list trips', data: null };
        }
    }

    async bulkCreateProviders(rows: Record<string, unknown>[]) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, message: 'rows array is required', data: null };
        }
        const errors: Array<{ row: number; message: string }> = [];
        let succeeded = 0;
        for (let i = 0; i < rows.length; i++) {
            const result = await this.createProvider(rows[i]);
            if (result.success) succeeded += 1;
            else errors.push({ row: i + 1, message: result.message || 'Failed' });
        }
        return {
            success: true,
            message: `Imported ${succeeded} of ${rows.length} providers`,
            data: { total: rows.length, succeeded, failed: rows.length - succeeded, errors },
        };
    }
}
