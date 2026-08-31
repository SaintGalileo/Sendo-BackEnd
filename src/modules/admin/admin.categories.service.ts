import { supabase } from '../../config/supabase';
import {
    type AuditActor,
    requireAuditReason,
    sanitizeForAudit,
    writeAuditLog,
} from './admin.audit';

export class AdminCategoriesService {
    async listCategories(page = 1, limit = 20, merchantId?: string) {
        const offset = (page - 1) * limit;

        let query = supabase
            .from('categories')
            .select(
                `
                *,
                merchant:merchants!categories_merchant_id_fkey(id, name, logo_url)
            `,
                { count: 'exact' },
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (merchantId) query = query.eq('merchant_id', merchantId);

        const { data, error, count } = await query;

        if (error) {
            // Fallback without join if FK name differs
            let fallback = supabase
                .from('categories')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (merchantId) fallback = fallback.eq('merchant_id', merchantId);
            const fb = await fallback;
            if (fb.error) return { success: false, message: fb.error.message, data: null };
            return {
                success: true,
                data: fb.data,
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
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getCategory(id: string) {
        const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async createCategory(categoryData: Record<string, any>, audit?: { actor: AuditActor; reason: string }) {
        const reason = audit ? requireAuditReason(audit.reason) : 'Category created via admin';
        if (audit && !requireAuditReason(audit.reason)) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)' };
        }

        const payload = {
            merchant_id: categoryData.merchant_id || categoryData.store_id || null,
            name: String(categoryData.name || '').trim(),
            description: categoryData.description ? String(categoryData.description).trim() : null,
            image_url: categoryData.image_url || null,
            position: categoryData.position != null ? Number(categoryData.position) : null,
        };
        if (!payload.name) return { success: false, message: 'Name is required' };

        const { data, error } = await supabase
            .from('categories')
            .insert([payload])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        if (audit?.actor) {
            await writeAuditLog({
                action: 'create',
                entityType: 'category',
                entityId: data.id,
                entityLabel: data.name,
                reason: reason!,
                after: sanitizeForAudit(data),
                actor: audit.actor,
            });
        }
        return { success: true, message: 'Category created', data };
    }

    async updateCategory(
        id: string,
        updates: Record<string, any>,
        audit?: { actor: AuditActor; reason: string },
    ) {
        const reason = audit ? requireAuditReason(audit.reason) : 'Category updated via admin';
        if (audit && !requireAuditReason(audit.reason)) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)' };
        }

        const { data: existing } = await supabase.from('categories').select('*').eq('id', id).maybeSingle();
        if (!existing) return { success: false, message: 'Category not found' };

        const patch: Record<string, unknown> = {};
        if (updates.name !== undefined) patch.name = String(updates.name || '').trim();
        if (updates.description !== undefined) {
            patch.description = updates.description ? String(updates.description).trim() : null;
        }
        if (updates.merchant_id !== undefined || updates.store_id !== undefined) {
            patch.merchant_id = updates.merchant_id || updates.store_id || null;
        }
        if (updates.image_url !== undefined) patch.image_url = updates.image_url || null;
        if (updates.position !== undefined) patch.position = Number(updates.position) || null;

        const { data, error } = await supabase
            .from('categories')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        if (audit?.actor) {
            await writeAuditLog({
                action: 'update',
                entityType: 'category',
                entityId: id,
                entityLabel: data.name,
                reason: reason!,
                before: sanitizeForAudit(existing),
                after: sanitizeForAudit(data),
                actor: audit.actor,
            });
        }
        return { success: true, message: 'Category updated', data };
    }

    async deleteCategory(id: string, audit?: { actor: AuditActor; reason: string }) {
        const reason = audit ? requireAuditReason(audit.reason) : null;
        if (audit && !reason) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)' };
        }

        const { data: existing } = await supabase.from('categories').select('*').eq('id', id).maybeSingle();
        if (!existing) return { success: false, message: 'Category not found' };

        const { error } = await supabase.from('categories').delete().eq('id', id);

        if (error) return { success: false, message: error.message };
        if (audit?.actor && reason) {
            await writeAuditLog({
                action: 'delete',
                entityType: 'category',
                entityId: id,
                entityLabel: existing.name,
                reason,
                before: sanitizeForAudit(existing),
                actor: audit.actor,
            });
        }
        return { success: true, message: 'Category deleted' };
    }
}
