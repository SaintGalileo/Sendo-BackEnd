import { supabase } from '../../config/supabase';
import { AuditActor, requireAuditReason, writeAuditLog } from '../admin/admin.audit';
import {
    CONTACT_KEYS,
    DEFAULT_UTILITY,
    SURGE_KEYS,
    SurgeCaps,
    UTILITY_KEYS,
    UtilityKey,
    UtilityMap,
} from './utility.constants';

function rowsToMap(rows: { key: string; value: string }[] | null | undefined): UtilityMap {
    const map = { ...DEFAULT_UTILITY };
    for (const row of rows || []) {
        if ((UTILITY_KEYS as readonly string[]).includes(row.key)) {
            map[row.key as UtilityKey] = String(row.value ?? '');
        }
    }
    return map;
}

function stripAuditFields(body: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...body };
    delete copy.reason;
    delete copy.change_note;
    return copy;
}

function pickMap(all: UtilityMap, keys: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of keys) {
        out[key] = all[key as UtilityKey] ?? '';
    }
    return out;
}

export class UtilityService {
    async getAll(): Promise<{ success: true; data: UtilityMap }> {
        try {
            const { data, error } = await supabase.from('utility').select('key, value');
            if (error) return { success: true, data: DEFAULT_UTILITY };
            return { success: true, data: rowsToMap(data) };
        } catch {
            return { success: true, data: DEFAULT_UTILITY };
        }
    }

    async getContactsAdmin(): Promise<{ success: true; data: { whatsapp_number: string; call_line: string } }> {
        const all = await this.getAll();
        return {
            success: true,
            data: {
                whatsapp_number: all.data.whatsapp_number,
                call_line: all.data.call_line,
            },
        };
    }

    async getSurgeAdmin(): Promise<{ success: true; data: { surge_price: string; surge_percentage: string } }> {
        const all = await this.getAll();
        return {
            success: true,
            data: {
                surge_price: all.data.surge_price,
                surge_percentage: all.data.surge_percentage,
            },
        };
    }

    async getContacts(): Promise<{ success: true; data: { whatsapp_number: string; call_line: string } }> {
        return this.getContactsAdmin();
    }

    async getSurgeCaps(): Promise<SurgeCaps> {
        const all = await this.getAll();
        const surge_price = Math.max(0, Number(all.data.surge_price) || 0);
        const surge_percentage = Math.min(100, Math.max(0, Number(all.data.surge_percentage) || 0));
        return { surge_price, surge_percentage };
    }

    async updateContacts(
        body: Record<string, unknown>,
        audit: { actor: AuditActor; reason: string },
    ) {
        return this.updateKeys(body, CONTACT_KEYS, audit, {
            entityId: 'utility_contacts',
            entityLabel: 'Contact numbers (WhatsApp & call line)',
            successMessage: 'Contact numbers updated',
        });
    }

    async updateSurgePricing(
        body: Record<string, unknown>,
        audit: { actor: AuditActor; reason: string },
    ) {
        return this.updateKeys(body, SURGE_KEYS, audit, {
            entityId: 'utility_surge',
            entityLabel: 'Surge pricing caps',
            successMessage: 'Surge pricing updated',
        });
    }

    private async updateKeys(
        body: Record<string, unknown>,
        allowedKeys: readonly string[],
        audit: { actor: AuditActor; reason: string },
        meta: { entityId: string; entityLabel: string; successMessage: string },
    ): Promise<{ success: boolean; message: string; data: Record<string, string> | null }> {
        const reason = requireAuditReason(audit.reason);
        if (!reason) {
            return {
                success: false,
                message: 'A reason / change note is required (min 3 characters)',
                data: null,
            };
        }

        const beforeAll = (await this.getAll()).data;
        const before = pickMap(beforeAll, allowedKeys);

        const updates = stripAuditFields(body);
        const allowed = new Set<string>(allowedKeys);
        const patchEntries = Object.entries(updates).filter(([key]) => allowed.has(key));

        if (patchEntries.length === 0) {
            return { success: false, message: 'No valid fields to update', data: null };
        }

        const now = new Date().toISOString();
        const rows = patchEntries.map(([key, raw]) => {
            let value = String(raw ?? '').trim();
            if (key === 'surge_price') {
                value = String(Math.max(0, Number(value) || 0));
            }
            if (key === 'surge_percentage') {
                value = String(Math.min(100, Math.max(0, Number(value) || 0)));
            }
            return { key, value, updated_at: now };
        });

        try {
            const { error } = await supabase.from('utility').upsert(rows, { onConflict: 'key' });
            if (error) return { success: false, message: error.message, data: null };

            const afterAll = (await this.getAll()).data;
            const after = pickMap(afterAll, allowedKeys);

            await writeAuditLog({
                action: 'update',
                entityType: 'utility',
                entityId: meta.entityId,
                entityLabel: meta.entityLabel,
                reason,
                before,
                after,
                actor: audit.actor,
            });

            return { success: true, message: meta.successMessage, data: after };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update settings', data: null };
        }
    }
}
