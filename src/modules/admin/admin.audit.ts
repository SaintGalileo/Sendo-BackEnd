import { supabase } from '../../config/supabase';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';

export type AuditActor = {
    id: string;
    email?: string | null;
};

export type WriteAuditInput = {
    action: AuditAction;
    entityType: string;
    entityId: string;
    entityLabel?: string | null;
    reason: string;
    before?: unknown;
    after?: unknown;
    actor: AuditActor;
};

export const AUDIT_REASON_MIN_LENGTH = 3;

export function requireAuditReason(reason: unknown): string | null {
    const text = String(reason ?? '').trim();
    if (text.length < AUDIT_REASON_MIN_LENGTH) return null;
    return text;
}

export function auditReasonFromBody(body: unknown): string | null {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    return requireAuditReason(b.reason ?? b.change_note);
}

export function actorFromRequest(user: { id?: string; email?: string | null } | undefined | null): AuditActor | null {
    if (!user?.id) return null;
    return { id: String(user.id), email: user.email ?? null };
}

/** Require authenticated actor + reason/change_note (min 3 chars) for CUD. */
export function requireCudAudit(
    user: { id?: string; email?: string | null } | undefined | null,
    body: unknown,
):
    | { ok: true; actor: AuditActor; reason: string }
    | { ok: false; status: number; message: string } {
    const actor = actorFromRequest(user);
    if (!actor) {
        return { ok: false, status: 401, message: 'Unauthorized' };
    }
    const reason = auditReasonFromBody(body);
    if (!reason) {
        return {
            ok: false,
            status: 400,
            message: `A reason / change note is required (min ${AUDIT_REASON_MIN_LENGTH} characters)`,
        };
    }
    return { ok: true, actor, reason };
}

function computeChanges(before: unknown, after: unknown): Record<string, { from: unknown; to: unknown }> | null {
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return null;
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of keys) {
        if (key === 'password_hash' || key === 'fcm_token') continue;
        const from = b[key];
        const to = a[key];
        if (JSON.stringify(from) !== JSON.stringify(to)) {
            changes[key] = { from: from ?? null, to: to ?? null };
        }
    }
    return Object.keys(changes).length ? changes : null;
}

export async function writeAuditLog(input: WriteAuditInput) {
    const reason = requireAuditReason(input.reason);
    if (!reason) {
        return { success: false as const, message: 'A reason / change note is required (min 3 characters)' };
    }
    if (!input.actor?.id) {
        return { success: false as const, message: 'Audit actor is required' };
    }

    let actorEmail = input.actor.email ? String(input.actor.email).trim() : '';
    if (!actorEmail) {
        const { data: userRow } = await supabase
            .from('users')
            .select('email')
            .eq('id', input.actor.id)
            .maybeSingle();
        actorEmail = userRow?.email ? String(userRow.email).trim() : '';
    }

    const changes =
        input.action === 'update' ? computeChanges(input.before, input.after) : null;

    const occurredAt = new Date().toISOString();

    const { error } = await supabase.from('admin_audit_logs').insert([
        {
            action: input.action,
            entity_type: input.entityType,
            entity_id: String(input.entityId),
            entity_label: input.entityLabel ? String(input.entityLabel) : null,
            reason,
            before: input.before ?? null,
            after: input.after ?? null,
            changes,
            actor_id: input.actor.id,
            actor_email: actorEmail || null,
            created_at: occurredAt,
        },
    ]);

    if (error) {
        console.error('[audit] failed to write log:', error.message);
        return { success: false as const, message: error.message };
    }
    return { success: true as const, created_at: occurredAt };
}

export async function listAuditLogs(filters: {
    page?: number;
    limit?: number;
    entity_type?: string;
    action?: string;
    actor_id?: string;
    search?: string;
}) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = supabase
        .from('admin_audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.actor_id) query = query.eq('actor_id', filters.actor_id);
    if (filters.search) {
        query = query.or(
            `entity_label.ilike.%${filters.search}%,reason.ilike.%${filters.search}%,actor_email.ilike.%${filters.search}%`,
        );
    }

    const { data, error, count } = await query;
    if (error) return { success: false, message: error.message, data: null };

    return {
        success: true,
        data,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
        },
    };
}

/** Strip secrets before storing snapshots. */
export function sanitizeForAudit<T extends Record<string, any>>(row: T | null | undefined): Record<string, unknown> | null {
    if (!row) return null;
    const copy = { ...row };
    delete copy.password_hash;
    delete copy.fcm_token;
    return copy;
}
