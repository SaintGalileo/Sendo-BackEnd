import { supabase } from '../../config/supabase';
import bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { normalizeScope, type ScopeFilters } from './admin.scope';
import {
    type AuditActor,
    requireAuditReason,
    sanitizeForAudit,
    writeAuditLog,
} from './admin.audit';

interface ListFilters {
    search?: string;
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    zone?: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function monthKey(d: Date) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildLast12MonthBuckets() {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        buckets.push({
            key: monthKey(d),
            label: MONTH_LABELS[d.getUTCMonth()],
            value: 0,
        });
    }
    return buckets;
}

function fillMonthlyGrowth(createdAts: (string | null | undefined)[]) {
    const buckets = buildLast12MonthBuckets();
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const raw of createdAts) {
        if (!raw) continue;
        const d = new Date(raw);
        if (!Number.isFinite(d.getTime())) continue;
        const key = monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
        const idx = index.get(key);
        if (idx === undefined) continue;
        buckets[idx].value += 1;
    }
    return buckets.map(({ label, value }) => ({ label, value }));
}

function startOfMonthIso() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfYearIso() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id: string) {
    return UUID_RE.test(id);
}

export class AdminUsersService {
    /** User IDs that own a courier or merchant profile (not pure customers). */
    private async getProUserIds(): Promise<string[]> {
        const [couriers, merchants] = await Promise.all([
            supabase.from('couriers').select('user_id'),
            supabase.from('merchants').select('user_id'),
        ]);
        const ids = new Set<string>();
        for (const row of couriers.data || []) {
            if (row.user_id) ids.add(row.user_id as string);
        }
        for (const row of merchants.data || []) {
            if (row.user_id) ids.add(row.user_id as string);
        }
        return [...ids];
    }

    /** Non-admin users who are not courier/merchant owners. */
    private applyCustomerFilters(query: any, proUserIds: string[]) {
        let q = query.eq('is_admin', false);
        if (proUserIds.length > 0) {
            q = q.not('id', 'in', `(${proUserIds.join(',')})`);
        }
        return q;
    }

    /** User IDs with an address in the selected city/state zone. */
    private async customerIdsForZone(scope: ScopeFilters): Promise<string[] | null> {
        const { city, state } = normalizeScope(scope);
        if (!city && !state) return null;
        let q = supabase.from('addresses').select('user_id');
        if (city) q = q.eq('city', city);
        if (state) q = q.eq('state', state);
        const { data, error } = await q.limit(5000);
        if (error) {
            console.error('[users] addresses zone filter:', error.message);
            return [];
        }
        return [...new Set((data || []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];
    }

    private applyMerchantZone(query: any, city?: string, state?: string) {
        let q = query;
        if (city) q = q.eq('city', city);
        if (state) q = q.eq('state', state);
        return q;
    }

    async listCustomers(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        const proUserIds = await this.getProUserIds();
        const zoneUserIds = await this.customerIdsForZone({
            city: filters.city,
            state: filters.state,
            zone: filters.zone,
        });

        if (zoneUserIds && zoneUserIds.length === 0) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
            };
        }

        let query = this.applyCustomerFilters(
            supabase.from('users').select('*', { count: 'exact' }),
            proUserIds,
        )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (zoneUserIds) {
            query = query.in('id', zoneUserIds);
        }

        if (filters.search) {
            query = query.or(
                `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
            );
        }

        const { data, error, count } = await query;
        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getCustomer(id: string) {
        if (!isUuid(id)) {
            return { success: false, message: 'Invalid customer id', data: null };
        }

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('is_admin', false)
            .single();

        if (error) return { success: false, message: error.message, data: null };

        // Fetch order count + spend + wallet for this customer
        const [{ count: orderCount }, ordersRes, walletRes] = await Promise.all([
            supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('consumer_id', id),
            supabase
                .from('orders')
                .select('total_price, total_amount, status, payment_status')
                .eq('consumer_id', id)
                .limit(2000),
            supabase.from('wallets').select('balance').eq('user_id', id).maybeSingle(),
        ]);

        const totalOrderAmount = (ordersRes.data || []).reduce((sum: number, o: any) => {
            const status = String(o.status || '').toLowerCase();
            if (status === 'cancelled') return sum;
            return sum + (Number(o.total_price ?? o.total_amount) || 0);
        }, 0);

        return {
            success: true,
            data: {
                ...data,
                order_count: orderCount || 0,
                total_order_amount: totalOrderAmount,
                wallet_balance: walletRes.data?.balance != null ? Number(walletRes.data.balance) : 0,
                // Loyalty schema not shipped yet — keep placeholder for UI
                loyalty_points: 0,
            },
        };
    }

    private normalizeCourierLocation(row: any) {
        const loc = Array.isArray(row?.location) ? row.location[0] : row?.location;
        const lat = loc?.lat ?? row?.lat ?? row?.latitude ?? null;
        const lng = loc?.lng ?? row?.lng ?? row?.longitude ?? null;
        const { location, ...rest } = row || {};
        return {
            ...rest,
            lat: lat != null ? Number(lat) : null,
            lng: lng != null ? Number(lng) : null,
            last_location_at: loc?.updated_at ?? null,
        };
    }

    async listCouriers(filters: ListFilters & { online?: boolean }) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('couriers')
            .select(`
                *,
                user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email, avatar_url),
                location:courier_locations(lat, lng, updated_at)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.online !== undefined) {
            query = query.eq('is_online', filters.online);
        }
        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const { data, error, count } = await query;
        if (error) {
            // Fallback if courier_locations relation is unavailable
            let fallback = supabase
                .from('couriers')
                .select(`
                    *,
                    user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email, avatar_url)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (filters.online !== undefined) {
                fallback = fallback.eq('is_online', filters.online);
            }
            if (filters.search) {
                fallback = fallback.ilike('name', `%${filters.search}%`);
            }

            const fb = await fallback;
            if (fb.error) return { success: false, message: fb.error.message, data: null };

            return {
                success: true,
                data: (fb.data || []).map((row) => this.normalizeCourierLocation(row)),
                pagination: {
                    page,
                    limit,
                    total: fb.count || 0,
                    totalPages: Math.ceil((fb.count || 0) / limit),
                },
            };
        }

        return {
            success: true,
            data: (data || []).map((row) => this.normalizeCourierLocation(row)),
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getCourier(id: string) {
        if (!isUuid(id)) {
            return { success: false, message: 'Invalid courier id', data: null };
        }

        const { data, error } = await supabase
            .from('couriers')
            .select(`
                *,
                user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email, avatar_url),
                location:courier_locations(lat, lng, updated_at)
            `)
            .eq('id', id)
            .single();

        if (error) {
            const fb = await supabase
                .from('couriers')
                .select(`
                    *,
                    user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email, avatar_url)
                `)
                .eq('id', id)
                .single();
            if (fb.error) return { success: false, message: fb.error.message, data: null };
            return { success: true, data: this.normalizeCourierLocation(fb.data) };
        }

        return { success: true, data: this.normalizeCourierLocation(data) };
    }

    async listMerchants(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('merchants')
            .select(`
                *,
                user:users!merchants_user_id_fkey(id, first_name, last_name, phone, email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        const { data, error, count } = await query;
        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getUsersOverview(scope: ScopeFilters = {}) {
        const monthStart = startOfMonthIso();
        const yearStart = startOfYearIso();
        const proUserIds = await this.getProUserIds();
        const { city, state } = normalizeScope(scope);
        const hasZone = Boolean(city || state);
        const zoneUserIds = hasZone ? await this.customerIdsForZone(scope) : null;

        const emptyZoneCustomers = hasZone && zoneUserIds && zoneUserIds.length === 0;

        const customerBase = () => {
            let q = this.applyCustomerFilters(
                supabase.from('users').select('*', { count: 'exact', head: true }),
                proUserIds,
            );
            if (zoneUserIds && zoneUserIds.length > 0) q = q.in('id', zoneUserIds);
            return q;
        };

        const merchantBase = () => this.applyMerchantZone(
            supabase.from('merchants').select('*', { count: 'exact', head: true }),
            city,
            state,
        );

        // Wave 1: core head-counts only (fast). Never fail the whole overview unless all four fail.
        const [
            customersTotal,
            customersNewMonth,
            couriersTotal,
            couriersOnline,
            couriersNewMonth,
            merchantsTotal,
            merchantsActive,
            merchantsPending,
            merchantsDenied,
            merchantsNewMonth,
            employeesTotal,
            employeesNewMonth,
        ] = await Promise.all([
            emptyZoneCustomers
                ? Promise.resolve({ count: 0, error: null })
                : customerBase(),
            emptyZoneCustomers
                ? Promise.resolve({ count: 0, error: null })
                : customerBase().gte('created_at', monthStart),
            // Couriers are platform-wide (no city/state column on couriers).
            supabase.from('couriers').select('*', { count: 'exact', head: true }),
            supabase.from('couriers').select('*', { count: 'exact', head: true }).eq('is_online', true),
            supabase.from('couriers').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
            merchantBase(),
            this.applyMerchantZone(
                supabase
                    .from('merchants')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['verified', 'active', 'approved', 'open']),
                city,
                state,
            ),
            this.applyMerchantZone(
                supabase
                    .from('merchants')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['pending', 'requested', 'pending_verification', 'unverified']),
                city,
                state,
            ),
            this.applyMerchantZone(
                supabase
                    .from('merchants')
                    .select('*', { count: 'exact', head: true })
                    .in('status', ['denied', 'rejected', 'inactive', 'suspended']),
                city,
                state,
            ),
            this.applyMerchantZone(
                supabase.from('merchants').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
                city,
                state,
            ),
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_admin', true),
            supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_admin', true)
                .gte('created_at', monthStart),
        ]);

        const coreFailed =
            (customersTotal as any).error &&
            couriersTotal.error &&
            merchantsTotal.error &&
            employeesTotal.error;
        if (coreFailed) {
            return {
                success: false,
                message: (customersTotal as any).error?.message || 'Could not load user overview',
                data: null,
            };
        }

        // Wave 2: optional growth + recent samples (best-effort; ignore errors).
        const [customersCreated, couriersCreated, merchantsCreated, couriersSample, merchantsSample] =
            await Promise.all([
                emptyZoneCustomers
                    ? Promise.resolve({ data: [] as any[], error: null })
                    : (() => {
                          let q = this.applyCustomerFilters(
                              supabase.from('users').select('created_at'),
                              proUserIds,
                          ).gte('created_at', yearStart);
                          if (zoneUserIds && zoneUserIds.length > 0) q = q.in('id', zoneUserIds);
                          return q.limit(2000);
                      })(),
                supabase
                    .from('couriers')
                    .select('created_at')
                    .gte('created_at', yearStart)
                    .limit(1000),
                this.applyMerchantZone(
                    supabase.from('merchants').select('created_at').gte('created_at', yearStart),
                    city,
                    state,
                ).limit(1000),
                supabase
                    .from('couriers')
                    .select('id, name, is_online, created_at')
                    .order('created_at', { ascending: false })
                    .limit(8),
                this.applyMerchantZone(
                    supabase.from('merchants').select('id, name, type, status, created_at, logo_url, city, state'),
                    city,
                    state,
                )
                    .order('created_at', { ascending: false })
                    .limit(8),
            ]);

        // Recent samples stand in for "top" boards (avoids heavy order scans that time out on cold hosts).
        const topCouriers = (couriersSample.data || []).slice(0, 5).map((c: any) => ({
            id: c.id as string,
            name: c.name || 'Courier',
            phone: '',
            orders: 0,
            is_online: Boolean(c.is_online),
        }));

        const topMerchants = (merchantsSample.data || []).slice(0, 5).map((m: any) => ({
            id: m.id as string,
            name: m.name || 'Merchant',
            type: m.type || '',
            status: m.status || '',
            orders: 0,
            logo_url: m.logo_url || null,
            city: m.city || null,
            state: m.state || null,
        }));

        const customers = (customersTotal as any).count || 0;
        const couriers = couriersTotal.count || 0;
        const merchants = merchantsTotal.count || 0;
        const employees = employeesTotal.count || 0;
        const online = couriersOnline.count || 0;

        const activeMerchants = merchantsActive.count || 0;
        const pendingMerchants = merchantsPending.count || 0;
        const deniedMerchants = merchantsDenied.count || 0;
        const resolvedActiveMerchants =
            activeMerchants + pendingMerchants + deniedMerchants > 0
                ? activeMerchants
                : merchants;

        return {
            success: true,
            data: {
                totals: {
                    customers,
                    couriers,
                    merchants,
                    employees,
                    customersDelta: (customersNewMonth as any).count || 0,
                    couriersDelta: couriersNewMonth.count || 0,
                    merchantsDelta: merchantsNewMonth.count || 0,
                    employeesDelta: employeesNewMonth.count || 0,
                },
                customers: {
                    total: customers,
                    newlyJoined: (customersNewMonth as any).count || 0,
                    blocked: 0,
                },
                couriers: {
                    total: couriers,
                    online,
                    offline: Math.max(couriers - online, 0),
                    newlyJoined: couriersNewMonth.count || 0,
                    blocked: 0,
                },
                merchants: {
                    total: merchants,
                    active: resolvedActiveMerchants,
                    pending: pendingMerchants,
                    denied: deniedMerchants,
                    newlyJoined: merchantsNewMonth.count || 0,
                },
                employees: {
                    total: employees,
                    newlyJoined: employeesNewMonth.count || 0,
                    available: true,
                },
                growth: {
                    customers: fillMonthlyGrowth((customersCreated.data || []).map((r: any) => r.created_at)),
                    merchants: fillMonthlyGrowth((merchantsCreated.data || []).map((r: any) => r.created_at)),
                    couriers: fillMonthlyGrowth((couriersCreated.data || []).map((r: any) => r.created_at)),
                },
                mix: [
                    { name: 'Customer', value: customers, color: '#D32F2F' },
                    { name: 'Merchant', value: merchants, color: '#3F8CE8' },
                    { name: 'Courier', value: couriers, color: '#FFA800' },
                    { name: 'Employee', value: employees, color: '#6B7280' },
                ],
                topCouriers,
                topMerchants,
                zone: hasZone ? { city: city || null, state: state || null } : null,
            },
        };
    }

    private mapEmployee(row: {
        id: string;
        email?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
        is_admin?: boolean;
        is_super_admin?: boolean;
        created_at?: string;
    }) {
        return {
            id: row.id,
            email: row.email || '',
            first_name: row.first_name || null,
            last_name: row.last_name || null,
            phone: row.phone || null,
            avatar_url: row.avatar_url || null,
            is_super_admin: Boolean(row.is_super_admin),
            is_admin: Boolean(row.is_admin),
            role: row.is_super_admin ? 'super_admin' : 'admin',
            active: Boolean(row.is_admin),
            created_at: row.created_at,
        };
    }

    async getEmployee(id: string) {
        if (!isUuid(id)) return { success: false, message: 'Invalid employee id', data: null };
        const { data, error } = await supabase
            .from('users')
            .select(
                'id, email, first_name, last_name, phone, avatar_url, is_admin, is_super_admin, role, date_of_birth, created_at',
            )
            .eq('id', id)
            .eq('is_admin', true)
            .maybeSingle();
        if (error || !data) return { success: false, message: error?.message || 'Employee not found', data: null };
        return { success: true, data: this.mapEmployee(data) };
    }

    async listEmployees(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('users')
            .select(
                'id, email, first_name, last_name, phone, avatar_url, is_admin, is_super_admin, role, created_at',
                { count: 'exact' }
            )
            .eq('is_admin', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.search) {
            query = query.or(
                `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
            );
        }

        const { data, error, count } = await query;
        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data: (data || []).map((row) => this.mapEmployee(row)),
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async createEmployee(input: {
        email: string;
        password: string;
        first_name?: string;
        last_name?: string;
        phone?: string | null;
        avatar_url?: string | null;
    }) {
        const email = (input.email || '').trim().toLowerCase();
        const password = input.password || '';
        if (!email) return { success: false, message: 'Email is required', data: null };
        if (password.length < 8) {
            return { success: false, message: 'Password must be at least 8 characters', data: null };
        }

        const { data: existing } = await supabase
            .from('users')
            .select('id, is_admin, email')
            .eq('email', email)
            .maybeSingle();

        if (existing?.is_admin) {
            return { success: false, message: 'An admin with this email already exists', data: null };
        }

        const password_hash = await bcrypt.hash(password, 12);
        const first_name = (input.first_name || '').trim() || null;
        const last_name = (input.last_name || '').trim() || null;
        const phone =
            input.phone === undefined || input.phone === null
                ? null
                : String(input.phone).trim() || null;
        const avatar_url =
            input.avatar_url === undefined || input.avatar_url === null
                ? null
                : String(input.avatar_url).trim() || null;

        if (existing) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    is_admin: true,
                    is_super_admin: false,
                    role: 'admin',
                    password_hash,
                    first_name: first_name ?? undefined,
                    last_name: last_name ?? undefined,
                    phone,
                    avatar_url: avatar_url ?? undefined,
                })
                .eq('id', existing.id)
                .select('id, email, first_name, last_name, phone, avatar_url, is_admin, is_super_admin, created_at')
                .single();

            if (error) return { success: false, message: error.message, data: null };
            return { success: true, message: 'Employee created', data: this.mapEmployee(data) };
        }

        const { data, error } = await supabase
            .from('users')
            .insert({
                email,
                first_name,
                last_name,
                phone,
                avatar_url,
                role: 'admin',
                is_admin: true,
                is_super_admin: false,
                password_hash,
            })
            .select('id, email, first_name, last_name, phone, avatar_url, is_admin, is_super_admin, created_at')
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, message: 'Employee created', data: this.mapEmployee(data) };
    }

    async updateEmployee(
        id: string,
        input: {
            first_name?: string;
            last_name?: string;
            phone?: string | null;
            email?: string;
            password?: string;
        }
    ) {
        const { data: existing, error: findError } = await supabase
            .from('users')
            .select('id, is_admin, is_super_admin, role')
            .eq('id', id)
            .maybeSingle();

        if (findError || !existing) {
            return { success: false, message: 'Employee not found', data: null };
        }
        if (!existing.is_admin && existing.role !== 'admin') {
            return { success: false, message: 'User is not an admin employee', data: null };
        }

        const patch: Record<string, unknown> = {};
        if (typeof input.first_name === 'string') patch.first_name = input.first_name.trim();
        if (typeof input.last_name === 'string') patch.last_name = input.last_name.trim();
        if (input.phone !== undefined) {
            const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
            patch.phone = phone || null;
        }
        if (typeof input.email === 'string') {
            const email = input.email.trim().toLowerCase();
            if (!email) return { success: false, message: 'Email cannot be empty', data: null };
            patch.email = email;
        }
        if (typeof input.password === 'string' && input.password.length > 0) {
            if (input.password.length < 8) {
                return { success: false, message: 'Password must be at least 8 characters', data: null };
            }
            patch.password_hash = await bcrypt.hash(input.password, 12);
        }

        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No fields to update', data: null };
        }

        const { data, error } = await supabase
            .from('users')
            .update(patch)
            .eq('id', id)
            .select('id, email, first_name, last_name, phone, is_admin, is_super_admin, created_at')
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, message: 'Employee updated', data: this.mapEmployee(data) };
    }

    async updateEmployeeStatus(id: string, active: boolean, actorId: string) {
        if (id === actorId && !active) {
            return { success: false, message: 'You cannot deactivate your own account', data: null };
        }

        const { data: existing, error: findError } = await supabase
            .from('users')
            .select('id, is_admin, is_super_admin, role')
            .eq('id', id)
            .maybeSingle();

        if (findError || !existing) {
            return { success: false, message: 'Employee not found', data: null };
        }

        if (!active && existing.is_super_admin) {
            const { count, error: countError } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('is_admin', true)
                .eq('is_super_admin', true);

            if (countError) {
                return { success: false, message: countError.message, data: null };
            }
            if ((count || 0) <= 1) {
                return {
                    success: false,
                    message: 'Cannot deactivate the last remaining super-admin',
                    data: null,
                };
            }
        }

        const { data, error } = await supabase
            .from('users')
            .update({ is_admin: active })
            .eq('id', id)
            .select('id, email, first_name, last_name, phone, is_admin, is_super_admin, created_at')
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return {
            success: true,
            message: active ? 'Employee activated' : 'Employee deactivated',
            data: this.mapEmployee(data),
        };
    }

    async sendEmployeePasswordReset(id: string) {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, is_admin')
            .eq('id', id)
            .maybeSingle();
        if (error || !user) return { success: false, message: 'Employee not found', data: null };
        if (!user.is_admin) return { success: false, message: 'User is not an admin employee', data: null };
        if (!user.email) return { success: false, message: 'Employee has no email on file', data: null };

        const auth = new AuthService();
        const result = await auth.requestAdminPasswordReset(user.email);
        return {
            success: result.success,
            message: result.success
                ? `Password reset email sent to ${user.email}`
                : result.message,
            data: null,
        };
    }

    async createCourier(input: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        vehicle_type?: string;
        plate_number?: string;
    }) {
        const firstName = (input.first_name || '').trim();
        const lastName = (input.last_name || '').trim();
        if (!firstName) return { success: false, message: 'First name is required', data: null };

        const phone = (input.phone || '').trim() || null;
        const email = (input.email || '').trim().toLowerCase() || null;
        if (!phone && !email) {
            return { success: false, message: 'Phone or email is required', data: null };
        }

        let userId: string | null = null;
        if (phone) {
            const { data: byPhone } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
            if (byPhone) userId = byPhone.id as string;
        }
        if (!userId && email) {
            const { data: byEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
            if (byEmail) userId = byEmail.id as string;
        }

        if (userId) {
            const { data: existingCourier } = await supabase
                .from('couriers')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            if (existingCourier) {
                return { success: false, message: 'This user already has a courier profile', data: null };
            }
            await supabase
                .from('users')
                .update({
                    first_name: firstName,
                    last_name: lastName || null,
                    email: email ?? undefined,
                    role: 'courier',
                })
                .eq('id', userId);
        } else {
            const { data: newUser, error: userError } = await supabase
                .from('users')
                .insert([
                    {
                        phone,
                        email,
                        first_name: firstName,
                        last_name: lastName || null,
                        role: 'courier',
                    },
                ])
                .select('id')
                .single();
            if (userError || !newUser) {
                return { success: false, message: userError?.message || 'Failed to create courier user', data: null };
            }
            userId = newUser.id as string;
        }

        const courierName = `${firstName} ${lastName}`.trim();
        const { data, error } = await supabase
            .from('couriers')
            .insert([
                {
                    user_id: userId,
                    name: courierName,
                    vehicle_type: (input.vehicle_type || 'bike').trim(),
                    plate_number: (input.plate_number || '').trim() || null,
                    is_online: false,
                },
            ])
            .select(`
                *,
                user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email)
            `)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, message: 'Courier created', data: this.normalizeCourierLocation(data) };
    }

    async updateCustomer(
        id: string,
        input: Record<string, any>,
        audit: { actor: AuditActor; reason: string },
    ) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        if (!isUuid(id)) return { success: false, message: 'Invalid customer id', data: null };

        const { data: existing, error: getErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('is_admin', false)
            .single();
        if (getErr || !existing) {
            return { success: false, message: getErr?.message || 'Customer not found', data: null };
        }

        const patch: Record<string, unknown> = {};
        for (const key of ['first_name', 'last_name', 'full_name', 'phone', 'email', 'avatar_url', 'date_of_birth']) {
            if (input[key] !== undefined) {
                const v = input[key];
                patch[key] = v === null || v === '' ? null : String(v).trim();
            }
        }

        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No fields to update', data: null };
        }

        const { data, error } = await supabase.from('users').update(patch).eq('id', id).select('*').single();
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'update',
            entityType: 'customer',
            entityId: id,
            entityLabel: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.phone || data.email,
            reason,
            before: sanitizeForAudit(existing),
            after: sanitizeForAudit(data),
            actor: audit.actor,
        });

        return { success: true, message: 'Customer updated', data };
    }

    async deleteCustomer(id: string, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        if (!isUuid(id)) return { success: false, message: 'Invalid customer id', data: null };

        const { data: existing, error: getErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('is_admin', false)
            .single();
        if (getErr || !existing) {
            return { success: false, message: getErr?.message || 'Customer not found', data: null };
        }

        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'delete',
            entityType: 'customer',
            entityId: id,
            entityLabel: [existing.first_name, existing.last_name].filter(Boolean).join(' ') || existing.phone,
            reason,
            before: sanitizeForAudit(existing),
            actor: audit.actor,
        });

        return { success: true, message: 'Customer deleted', data: null };
    }

    async updateCourier(
        id: string,
        input: Record<string, any>,
        audit: { actor: AuditActor; reason: string },
    ) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        if (!isUuid(id)) return { success: false, message: 'Invalid courier id', data: null };

        const existingRes = await this.getCourier(id);
        if (!existingRes.success || !existingRes.data) {
            return { success: false, message: existingRes.message || 'Courier not found', data: null };
        }
        const existing = existingRes.data as any;

        const courierPatch: Record<string, unknown> = {};
        if (input.name !== undefined) courierPatch.name = String(input.name).trim();
        if (input.vehicle_type !== undefined) courierPatch.vehicle_type = String(input.vehicle_type).trim();
        if (input.plate_number !== undefined) {
            courierPatch.plate_number = String(input.plate_number || '').trim() || null;
        }
        if (input.avatar_url !== undefined) courierPatch.avatar_url = input.avatar_url || null;
        if (input.is_online !== undefined) courierPatch.is_online = Boolean(input.is_online);
        if (input.date_of_birth !== undefined) courierPatch.date_of_birth = input.date_of_birth || null;

        if (input.first_name !== undefined || input.last_name !== undefined) {
            const first = input.first_name !== undefined
                ? String(input.first_name).trim()
                : existing.user?.first_name || '';
            const last = input.last_name !== undefined
                ? String(input.last_name).trim()
                : existing.user?.last_name || '';
            courierPatch.name = `${first} ${last}`.trim() || existing.name;
        }

        if (Object.keys(courierPatch).length > 0) {
            const { error } = await supabase.from('couriers').update(courierPatch).eq('id', id);
            if (error) return { success: false, message: error.message, data: null };
        }

        if (existing.user_id || existing.user?.id) {
            const userId = existing.user_id || existing.user.id;
            const userPatch: Record<string, unknown> = {};
            for (const key of ['first_name', 'last_name', 'phone', 'email', 'avatar_url', 'date_of_birth']) {
                if (input[key] !== undefined) {
                    const v = input[key];
                    userPatch[key] = v === null || v === '' ? null : String(v).trim();
                }
            }
            if (Object.keys(userPatch).length > 0) {
                await supabase.from('users').update(userPatch).eq('id', userId);
            }
        }

        const updated = await this.getCourier(id);
        await writeAuditLog({
            action: 'update',
            entityType: 'courier',
            entityId: id,
            entityLabel: (updated.data as any)?.name || existing.name,
            reason,
            before: sanitizeForAudit(existing),
            after: sanitizeForAudit(updated.data as any),
            actor: audit.actor,
        });

        return { success: true, message: 'Courier updated', data: updated.data };
    }

    async deleteCourier(id: string, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        if (!isUuid(id)) return { success: false, message: 'Invalid courier id', data: null };

        const existingRes = await this.getCourier(id);
        if (!existingRes.success || !existingRes.data) {
            return { success: false, message: existingRes.message || 'Courier not found', data: null };
        }
        const existing = existingRes.data as any;

        const { error } = await supabase.from('couriers').delete().eq('id', id);
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'delete',
            entityType: 'courier',
            entityId: id,
            entityLabel: existing.name,
            reason,
            before: sanitizeForAudit(existing),
            actor: audit.actor,
        });

        return { success: true, message: 'Courier deleted', data: null };
    }

    async deleteEmployee(id: string, actorId: string, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        if (id === actorId) {
            return { success: false, message: 'You cannot delete your own account', data: null };
        }

        const { data: existing, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .eq('is_admin', true)
            .maybeSingle();

        if (findError || !existing) {
            return { success: false, message: 'Employee not found', data: null };
        }

        if (existing.is_super_admin) {
            const { count } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('is_admin', true)
                .eq('is_super_admin', true);
            if ((count || 0) <= 1) {
                return { success: false, message: 'Cannot delete the last remaining super-admin', data: null };
            }
        }

        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'delete',
            entityType: 'employee',
            entityId: id,
            entityLabel: [existing.first_name, existing.last_name].filter(Boolean).join(' ') || existing.email,
            reason,
            before: sanitizeForAudit(existing),
            actor: audit.actor,
        });

        return { success: true, message: 'Employee deleted', data: null };
    }
}
