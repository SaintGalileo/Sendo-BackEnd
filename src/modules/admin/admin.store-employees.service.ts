import { supabase } from '../../config/supabase';
import {
    type AuditActor,
    listAuditLogs,
    requireAuditReason,
    sanitizeForAudit,
    writeAuditLog,
} from './admin.audit';

export class AdminStoreEmployeesService {
    async list(filters: { merchant_id?: string; search?: string; page?: number; limit?: number }) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('merchant_employees')
            .select(
                `
                *,
                merchant:merchants!merchant_employees_merchant_id_fkey(id, name, logo_url)
            `,
                { count: 'exact' },
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.merchant_id) query = query.eq('merchant_id', filters.merchant_id);
        if (filters.search) {
            query = query.or(
                `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,designation.ilike.%${filters.search}%`,
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

    async get(id: string) {
        const { data, error } = await supabase
            .from('merchant_employees')
            .select(
                `
                *,
                merchant:merchants!merchant_employees_merchant_id_fkey(id, name, logo_url)
            `,
            )
            .eq('id', id)
            .single();
        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async create(body: Record<string, any>, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }
        const merchantId = body.merchant_id || body.store_id;
        if (!merchantId) return { success: false, message: 'Store is required', data: null };

        const payload = {
            merchant_id: merchantId,
            user_id: body.user_id || null,
            first_name: String(body.first_name || '').trim() || null,
            last_name: String(body.last_name || '').trim() || null,
            email: String(body.email || '').trim().toLowerCase() || null,
            phone: String(body.phone || '').trim() || null,
            designation: String(body.designation || '').trim() || null,
            avatar_url: body.avatar_url ? String(body.avatar_url).trim() : null,
            status: String(body.status || 'active').trim() || 'active',
        };

        const { data, error } = await supabase
            .from('merchant_employees')
            .insert([payload])
            .select()
            .single();
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'create',
            entityType: 'store_employee',
            entityId: data.id,
            entityLabel: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email,
            reason,
            after: sanitizeForAudit(data),
            actor: audit.actor,
        });

        return { success: true, message: 'Store employee created', data };
    }

    async update(id: string, updates: Record<string, any>, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }

        const { data: existing, error: getErr } = await supabase
            .from('merchant_employees')
            .select('*')
            .eq('id', id)
            .single();
        if (getErr || !existing) {
            return { success: false, message: getErr?.message || 'Store employee not found', data: null };
        }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const key of [
            'merchant_id',
            'user_id',
            'first_name',
            'last_name',
            'email',
            'phone',
            'designation',
            'avatar_url',
            'status',
        ]) {
            if (updates[key] !== undefined) {
                const v = updates[key];
                patch[key] = v === null || v === '' ? null : typeof v === 'string' ? v.trim() : v;
            }
        }
        if (updates.store_id !== undefined && updates.merchant_id === undefined) {
            patch.merchant_id = updates.store_id;
        }

        const { data, error } = await supabase
            .from('merchant_employees')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'update',
            entityType: 'store_employee',
            entityId: id,
            entityLabel: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email,
            reason,
            before: sanitizeForAudit(existing),
            after: sanitizeForAudit(data),
            actor: audit.actor,
        });

        return { success: true, message: 'Store employee updated', data };
    }

    async delete(id: string, audit: { actor: AuditActor; reason: string }) {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)', data: null };
        }

        const { data: existing, error: getErr } = await supabase
            .from('merchant_employees')
            .select('*')
            .eq('id', id)
            .single();
        if (getErr || !existing) {
            return { success: false, message: getErr?.message || 'Store employee not found', data: null };
        }

        const { error } = await supabase.from('merchant_employees').delete().eq('id', id);
        if (error) return { success: false, message: error.message, data: null };

        await writeAuditLog({
            action: 'delete',
            entityType: 'store_employee',
            entityId: id,
            entityLabel: [existing.first_name, existing.last_name].filter(Boolean).join(' ') || existing.email,
            reason,
            before: sanitizeForAudit(existing),
            actor: audit.actor,
        });

        return { success: true, message: 'Store employee deleted', data: null };
    }
}

export class AdminAuditService {
    list(filters: Parameters<typeof listAuditLogs>[0]) {
        return listAuditLogs(filters);
    }
}
