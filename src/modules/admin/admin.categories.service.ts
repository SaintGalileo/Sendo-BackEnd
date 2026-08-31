import { supabase } from '../../config/supabase';
import {
    type AuditActor,
    requireAuditReason,
    sanitizeForAudit,
    writeAuditLog,
} from './admin.audit';

/** Production `categories` table: merchant_id, name, description (+ id, timestamps). No images. */
const CATEGORY_SELECT =
    'id, merchant_id, name, description, created_at, updated_at';

function pickCategoryWriteFields(input: Record<string, any>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (input.merchant_id !== undefined || input.store_id !== undefined) {
        out.merchant_id = input.merchant_id || input.store_id || null;
    }
    if (input.name !== undefined) {
        out.name = String(input.name || '').trim();
    }
    if (input.description !== undefined) {
        const desc = input.description;
        out.description = desc == null || desc === '' ? null : String(desc).trim();
    }
    return out;
}

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
                .select(CATEGORY_SELECT, { count: 'exact' })
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
        const { data, error } = await supabase
            .from('categories')
            .select(CATEGORY_SELECT)
            .eq('id', id)
            .single();
        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async createCategory(categoryData: Record<string, any>, audit?: { actor: AuditActor; reason: string }) {
        const reason = audit ? requireAuditReason(audit.reason) : 'Category created via admin';
        if (audit && !requireAuditReason(audit.reason)) {
            return { success: false, message: 'A reason / change note is required (min 3 characters)' };
        }

        const payload = pickCategoryWriteFields(categoryData);
        if (!payload.name) return { success: false, message: 'Name is required' };
        if (!payload.merchant_id) {
            return { success: false, message: 'Store is required — categories must belong to a merchant' };
        }

        const { data, error } = await supabase
            .from('categories')
            .insert([payload])
            .select(CATEGORY_SELECT)
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

        const { data: existing } = await supabase
            .from('categories')
            .select(CATEGORY_SELECT)
            .eq('id', id)
            .maybeSingle();
        if (!existing) return { success: false, message: 'Category not found' };

        const patch = pickCategoryWriteFields(updates);
        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        const { data, error } = await supabase
            .from('categories')
            .update(patch)
            .eq('id', id)
            .select(CATEGORY_SELECT)
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

        const { data: existing } = await supabase
            .from('categories')
            .select(CATEGORY_SELECT)
            .eq('id', id)
            .maybeSingle();
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
