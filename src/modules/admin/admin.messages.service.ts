import { supabase } from '../../config/supabase';

const MESSAGE_TABLES = ['contact_messages', 'messages'] as const;

type ListResult = {
    success: true;
    data: unknown[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    message?: string;
};

/**
 * Prefer `contact_messages`; fall back to legacy `messages`.
 * Missing tables return an empty list (not a hard failure) so the inbox UI stays usable.
 */
export class AdminMessagesService {
    private async listFromTable(
        table: (typeof MESSAGE_TABLES)[number],
        page: number,
        limit: number,
    ): Promise<{ ok: true; data: unknown[]; count: number } | { ok: false; missing: boolean; message: string }> {
        const offset = (page - 1) * limit;
        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            const missing =
                /schema cache|does not exist|Could not find the table/i.test(error.message || '');
            return { ok: false, missing, message: error.message };
        }
        return { ok: true, data: data || [], count: count || 0 };
    }

    async list(page = 1, limit = 20): Promise<ListResult> {
        const safePage = Number.isFinite(page) && page > 0 ? page : 1;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 20;

        let lastError = '';
        for (const table of MESSAGE_TABLES) {
            const result = await this.listFromTable(table, safePage, safeLimit);
            if (result.ok) {
                return {
                    success: true,
                    data: result.data,
                    pagination: {
                        page: safePage,
                        limit: safeLimit,
                        total: result.count,
                        totalPages: Math.ceil(result.count / safeLimit) || 0,
                    },
                };
            }
            lastError = result.message;
            if (!result.missing) {
                // Real query error (RLS, etc.) — still keep inbox empty rather than 500.
                break;
            }
        }

        return {
            success: true,
            data: [],
            pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 0 },
            message: lastError
                ? `Contact messages table unavailable (${lastError})`
                : undefined,
        };
    }

    async getById(id: string) {
        for (const table of MESSAGE_TABLES) {
            const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
            if (!error && data) return { success: true, data };
        }
        return { success: false, message: 'Message not found', data: null };
    }

    async markRead(id: string, isRead = true) {
        for (const table of MESSAGE_TABLES) {
            const { data, error } = await supabase
                .from(table)
                .update({ is_read: isRead, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select('*')
                .maybeSingle();
            if (!error && data) return { success: true, data };
        }
        return { success: false, message: 'Message not found', data: null };
    }
}
