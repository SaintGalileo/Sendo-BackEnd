import { supabase } from '../../config/supabase';
import bcrypt from 'bcrypt';

interface ListFilters {
    search?: string;
    page?: number;
    limit?: number;
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

export class AdminUsersService {
    async listCustomers(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('users')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.search) {
            query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
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
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return { success: false, message: error.message, data: null };

        // Fetch order count for this customer
        const { count: orderCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('consumer_id', id);

        return { success: true, data: { ...data, order_count: orderCount || 0 } };
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
                user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email),
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
                    user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email)
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
        const { data, error } = await supabase
            .from('couriers')
            .select(`
                *,
                user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email),
                location:courier_locations(lat, lng, updated_at)
            `)
            .eq('id', id)
            .single();

        if (error) {
            const fb = await supabase
                .from('couriers')
                .select(`
                    *,
                    user:users!couriers_user_id_fkey(id, first_name, last_name, phone, email)
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

    async getUsersOverview() {
        const monthStart = startOfMonthIso();
        const yearStart = startOfYearIso();

        const [
            customersTotal,
            customersNewMonth,
            customersCreated,
            couriersTotal,
            couriersOnline,
            couriersNewMonth,
            couriersCreated,
            couriersSample,
            merchantsTotal,
            merchantsActive,
            merchantsPending,
            merchantsDenied,
            merchantsNewMonth,
            merchantsCreated,
            merchantsSample,
            employeesTotal,
            employeesNewMonth,
            orderCourierRows,
            orderMerchantRows,
        ] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('users').select('created_at').gte('created_at', yearStart).limit(5000),
            supabase.from('couriers').select('*', { count: 'exact', head: true }),
            supabase.from('couriers').select('*', { count: 'exact', head: true }).eq('is_online', true),
            supabase.from('couriers').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('couriers').select('created_at').gte('created_at', yearStart).limit(2000),
            supabase
                .from('couriers')
                .select(`
                    id, name, is_online, created_at,
                    user:users!couriers_user_id_fkey(phone)
                `)
                .order('created_at', { ascending: false })
                .limit(50),
            supabase.from('merchants').select('*', { count: 'exact', head: true }),
            supabase.from('merchants').select('*', { count: 'exact', head: true }).in('status', ['active', 'approved', 'open']),
            supabase.from('merchants').select('*', { count: 'exact', head: true }).in('status', ['pending', 'requested']),
            supabase.from('merchants').select('*', { count: 'exact', head: true }).in('status', ['denied', 'rejected', 'inactive']),
            supabase.from('merchants').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
            supabase.from('merchants').select('created_at').gte('created_at', yearStart).limit(2000),
            supabase
                .from('merchants')
                .select('id, name, type, status, created_at')
                .order('created_at', { ascending: false })
                .limit(50),
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
            supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin')
                .gte('created_at', monthStart),
            supabase
                .from('orders')
                .select('courier_id')
                .not('courier_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(800),
            supabase
                .from('orders')
                .select('merchant_id')
                .not('merchant_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(800),
        ]);

        const courierOrderMap: Record<string, number> = {};
        for (const row of orderCourierRows.data || []) {
            const id = row.courier_id as string | null;
            if (!id) continue;
            courierOrderMap[id] = (courierOrderMap[id] || 0) + 1;
        }

        const merchantOrderMap: Record<string, number> = {};
        for (const row of orderMerchantRows.data || []) {
            const id = row.merchant_id as string | null;
            if (!id) continue;
            merchantOrderMap[id] = (merchantOrderMap[id] || 0) + 1;
        }

        const courierById = new Map(
            (couriersSample.data || []).map((c: any) => [c.id as string, c]),
        );
        const merchantById = new Map(
            (merchantsSample.data || []).map((m: any) => [m.id as string, m]),
        );

        const topCourierIds = Object.entries(courierOrderMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        // Ensure we have profile data for top IDs not in the recent sample.
        const missingCourierIds = topCourierIds.filter((id) => !courierById.has(id));
        if (missingCourierIds.length) {
            const { data } = await supabase
                .from('couriers')
                .select(`
                    id, name, is_online, created_at,
                    user:users!couriers_user_id_fkey(phone)
                `)
                .in('id', missingCourierIds);
            for (const c of data || []) courierById.set(c.id, c);
        }

        const topMerchantIds = Object.entries(merchantOrderMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);

        const missingMerchantIds = topMerchantIds.filter((id) => !merchantById.has(id));
        if (missingMerchantIds.length) {
            const { data } = await supabase
                .from('merchants')
                .select('id, name, type, status, created_at')
                .in('id', missingMerchantIds);
            for (const m of data || []) merchantById.set(m.id, m);
        }

        const topCouriers = topCourierIds
            .map((id) => {
                const c = courierById.get(id);
                if (!c) return null;
                const phone = (c.user as { phone?: string } | null)?.phone || '';
                return {
                    id,
                    name: c.name || 'Courier',
                    phone,
                    orders: courierOrderMap[id] || 0,
                    is_online: Boolean(c.is_online),
                };
            })
            .filter(Boolean);

        const topMerchants = topMerchantIds
            .map((id) => {
                const m = merchantById.get(id);
                if (!m) return null;
                return {
                    id,
                    name: m.name || 'Merchant',
                    type: m.type || '',
                    status: m.status || '',
                    orders: merchantOrderMap[id] || 0,
                };
            })
            .filter(Boolean);

        const customers = customersTotal.count || 0;
        const couriers = couriersTotal.count || 0;
        const merchants = merchantsTotal.count || 0;
        const employees = employeesTotal.count || 0;
        const online = couriersOnline.count || 0;

        const activeMerchants = merchantsActive.count || 0;
        const pendingMerchants = merchantsPending.count || 0;
        const deniedMerchants = merchantsDenied.count || 0;
        // If status taxonomy isn't populated yet, treat all as active for the mini-stat.
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
                    customersDelta: customersNewMonth.count || 0,
                    couriersDelta: couriersNewMonth.count || 0,
                    merchantsDelta: merchantsNewMonth.count || 0,
                    employeesDelta: employeesNewMonth.count || 0,
                },
                customers: {
                    total: customers,
                    newlyJoined: customersNewMonth.count || 0,
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
            },
        };
    }

    private mapEmployee(row: {
        id: string;
        email?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
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
            is_super_admin: Boolean(row.is_super_admin),
            is_admin: Boolean(row.is_admin),
            role: row.is_super_admin ? 'super_admin' : 'admin',
            active: Boolean(row.is_admin),
            created_at: row.created_at,
        };
    }

    async listEmployees(filters: ListFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('users')
            .select(
                'id, email, first_name, last_name, phone, is_admin, is_super_admin, role, created_at',
                { count: 'exact' }
            )
            .eq('role', 'admin')
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
                })
                .eq('id', existing.id)
                .select('id, email, first_name, last_name, phone, is_admin, is_super_admin, created_at')
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
                role: 'admin',
                is_admin: true,
                is_super_admin: false,
                password_hash,
            })
            .select('id, email, first_name, last_name, phone, is_admin, is_super_admin, created_at')
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
}
