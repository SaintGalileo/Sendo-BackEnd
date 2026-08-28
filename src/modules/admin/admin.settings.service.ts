import { supabase } from '../../config/supabase';

const DEFAULT_BUSINESS_SETTINGS = {
    business_name: '',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    order_auto_accept: false,
    maintenance_mode: false,
};

const DEFAULT_APP_SETTINGS = {
    business_name: 'Sendo',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    distance_unit: 'KM',
    order_auto_cancel_mins: 30,
};

const DEFAULT_LOGIN_SETTINGS = {
    welcome_title: 'Welcome back to Sendo',
    background_image_url: '',
    email_login: true,
    phone_login: true,
    social_login: false,
};

const DEFAULT_SMS_SETTINGS = {
    gateway: '',
    api_key: '',
    sender_id: '',
};

const DEFAULT_FCM_CONFIG = {
    project_id: '',
    sender_id: '',
    server_key: '',
};

const DEFAULT_FCM_MESSAGES = {
    module_type: 'grocery',
    messages: {} as Record<string, Record<string, { enabled: boolean; text: string }>>,
};

const DEFAULT_NOTIFICATION_CHANNELS: { event: string; email: boolean; push: boolean; sms: boolean }[] = [];

const DEFAULT_SEO = {
    meta_title: '',
    meta_keywords: '',
    meta_description: '',
    og_image_url: '',
    twitter_card: 'summary_large_image',
};

const DEFAULT_SOCIAL = {
    facebook: '',
    twitter: '',
};

const DEFAULT_PAYMENT_GATEWAYS = {
    stripe: { enabled: true, public_key: '', secret_key: '' },
    paypal: { enabled: false, public_key: '', secret_key: '' },
};

const DEFAULT_ANALYTIC_SETTINGS = {
    google_analytics_id: '',
    header_script: '',
    body_end_script: '',
};

const DEFAULT_WEBSOCKET_SETTINGS = {
    host: '',
    port: '443',
    tls: true,
    app_key: '',
};

const DEFAULT_AI_SETTINGS = {
    provider: 'OpenAI',
    api_key: '',
    model: 'gpt-4.1-mini',
    daily_token_cap: 250000,
};

const DEFAULT_SUBSCRIPTION_SETTINGS = {
    subscription_enabled: false,
};

export class AdminSettingsService {
    /** Generic KV read from admin_settings. Returns defaultValue when missing/unavailable. */
    async getKv<T>(key: string, defaultValue: T): Promise<{ success: true; data: T }> {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('value')
                .eq('key', key)
                .maybeSingle();

            if (error || !data) return { success: true, data: defaultValue };
            return { success: true, data: (data.value ?? defaultValue) as T };
        } catch {
            return { success: true, data: defaultValue };
        }
    }

    async putKv<T>(key: string, value: T): Promise<{ success: boolean; message: string; data: T | null }> {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .upsert([{ key, value, updated_at: new Date().toISOString() }], { onConflict: 'key' })
                .select('value')
                .single();

            if (error) return { success: false, message: error.message, data: null };
            return { success: true, message: 'Settings saved', data: (data?.value ?? value) as T };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to save settings', data: null };
        }
    }

    async getBusinessSettings() {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .limit(1)
                .single();

            if (error) return { success: true, data: DEFAULT_BUSINESS_SETTINGS };
            return { success: true, data };
        } catch {
            return { success: true, data: DEFAULT_BUSINESS_SETTINGS };
        }
    }

    async updateBusinessSettings(updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .upsert([{ id: 'default', ...updates }])
                .select()
                .single();

            if (error) {
                // Fall back to KV when legacy settings table is unavailable
                return this.putKv('business', { ...DEFAULT_BUSINESS_SETTINGS, ...updates });
            }
            return { success: true, message: 'Business settings updated', data };
        } catch (e: any) {
            return this.putKv('business', { ...DEFAULT_BUSINESS_SETTINGS, ...updates });
        }
    }

    async getTaxSettings() {
        try {
            const { data, error } = await supabase
                .from('taxes')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) return { success: true, data };
        } catch {
            /* fall through to KV */
        }
        return this.getKv<Record<string, any>[]>('taxes', []);
    }

    async createTax(body: Record<string, any>) {
        const row = {
            name: String(body.name ?? '').trim(),
            rate: body.rate != null ? Number(body.rate) : 0,
            type: String(body.type ?? 'percent'),
            zones: body.zones ?? [],
            status: body.status !== false && body.status !== 0,
        };
        if (!row.name) {
            return { success: false, message: 'Tax name is required', data: null };
        }
        try {
            const { data, error } = await supabase
                .from('taxes')
                .insert([row])
                .select()
                .single();

            if (!error && data) {
                return { success: true, message: 'Tax created', data };
            }
        } catch {
            /* fall through to KV */
        }

        const existing = await this.getKv<Record<string, any>[]>('taxes', []);
        const list = Array.isArray(existing.data) ? existing.data : [];
        const created = {
            id: `tax_${Date.now()}`,
            ...row,
            created_at: new Date().toISOString(),
        };
        const put = await this.putKv('taxes', [...list, created]);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Tax created', data: created };
    }

    async updateTaxSettings(id: string, updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('taxes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (!error && data) {
                return { success: true, message: 'Tax setting updated', data };
            }
        } catch {
            /* fall through to KV */
        }

        const existing = await this.getKv<Record<string, any>[]>('taxes', []);
        const list = Array.isArray(existing.data) ? [...existing.data] : [];
        const idx = list.findIndex((t) => String(t.id) === String(id));
        if (idx < 0) return { success: false, message: 'Tax not found', data: null };
        list[idx] = { ...list[idx], ...updates };
        const put = await this.putKv('taxes', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Tax setting updated', data: list[idx] };
    }

    /** Gateway credentials (Stripe/PayPal) for third-party payment setup. */
    async getPaymentMethods() {
        return this.getKv('payment_methods', DEFAULT_PAYMENT_GATEWAYS);
    }

    async updatePaymentMethods(body: Record<string, any>) {
        const merged = {
            stripe: { ...DEFAULT_PAYMENT_GATEWAYS.stripe, ...(body?.stripe ?? {}) },
            paypal: { ...DEFAULT_PAYMENT_GATEWAYS.paypal, ...(body?.paypal ?? {}) },
        };
        return this.putKv('payment_methods', merged);
    }

    async getAnalyticSettings() {
        return this.getKv('analytic', DEFAULT_ANALYTIC_SETTINGS);
    }

    async updateAnalyticSettings(body: Record<string, any>) {
        return this.putKv('analytic', { ...DEFAULT_ANALYTIC_SETTINGS, ...body });
    }

    async getWebsocketSettings() {
        return this.getKv('websocket', DEFAULT_WEBSOCKET_SETTINGS);
    }

    async updateWebsocketSettings(body: Record<string, any>) {
        return this.putKv('websocket', { ...DEFAULT_WEBSOCKET_SETTINGS, ...body });
    }

    async getAiSettings() {
        return this.getKv('ai', DEFAULT_AI_SETTINGS);
    }

    async updateAiSettings(body: Record<string, any>) {
        return this.putKv('ai', { ...DEFAULT_AI_SETTINGS, ...body });
    }

    async getSubscriptionSettings() {
        return this.getKv('subscription', DEFAULT_SUBSCRIPTION_SETTINGS);
    }

    async updateSubscriptionSettings(body: Record<string, any>) {
        return this.putKv('subscription', { ...DEFAULT_SUBSCRIPTION_SETTINGS, ...body });
    }

    /** Packages list — empty by default; never invent demo packages. */
    async getSubscriptionPackages() {
        return this.getKv<Record<string, any>[]>('subscription_packages', []);
    }

    async updateSubscriptionPackages(packages: unknown) {
        if (!Array.isArray(packages)) {
            return { success: false, message: 'packages must be an array', data: null };
        }
        return this.putKv('subscription_packages', packages);
    }

    /** Subscribers list — empty by default; never invent fake subscribers. */
    async getSubscriptionSubscribers() {
        return this.getKv<Record<string, any>[]>('subscription_subscribers', []);
    }

    // ── Modules (list only; never invent rows) ──
    async getModules() {
        return this.getKv<{ id: number; name: string; type: string; vendors: number; status: boolean }[]>(
            'modules',
            [],
        );
    }

    async updateModules(modules: unknown) {
        if (!Array.isArray(modules)) {
            return { success: false, message: 'modules must be an array', data: null };
        }
        const normalized = modules.map((m: any, i: number) => ({
            id: typeof m.id === 'number' ? m.id : i + 1,
            name: String(m.name ?? ''),
            type: String(m.type ?? ''),
            vendors: Number(m.vendors ?? 0),
            status: Boolean(m.status),
        }));
        return this.putKv('modules', normalized);
    }

    // ── FCM message templates ──
    async getFcmMessages() {
        return this.getKv('fcm_messages', DEFAULT_FCM_MESSAGES);
    }

    async updateFcmMessages(body: Record<string, any>) {
        return this.putKv('fcm_messages', { ...DEFAULT_FCM_MESSAGES, ...body });
    }

    // ── FCM credentials ──
    async getFcmConfig() {
        return this.getKv('fcm_config', DEFAULT_FCM_CONFIG);
    }

    async updateFcmConfig(body: Record<string, any>) {
        return this.putKv('fcm_config', { ...DEFAULT_FCM_CONFIG, ...body });
    }

    // ── Notification channels ──
    async getNotificationChannels() {
        return this.getKv('notification_channels', DEFAULT_NOTIFICATION_CHANNELS);
    }

    async updateNotificationChannels(channels: unknown) {
        if (!Array.isArray(channels)) {
            return { success: false, message: 'channels must be an array', data: null };
        }
        return this.putKv('notification_channels', channels);
    }

    // ── SMS ──
    async getSmsSettings() {
        return this.getKv('sms', DEFAULT_SMS_SETTINGS);
    }

    async updateSmsSettings(body: Record<string, any>) {
        return this.putKv('sms', { ...DEFAULT_SMS_SETTINGS, ...body });
    }

    // ── App / login ──
    async getAppSettings() {
        return this.getKv('app', DEFAULT_APP_SETTINGS);
    }

    async updateAppSettings(body: Record<string, any>) {
        return this.putKv('app', { ...DEFAULT_APP_SETTINGS, ...body });
    }

    async getLoginSettings() {
        return this.getKv('login', DEFAULT_LOGIN_SETTINGS);
    }

    async updateLoginSettings(body: Record<string, any>) {
        return this.putKv('login', { ...DEFAULT_LOGIN_SETTINGS, ...body });
    }

    // ── CMS / SEO / social (generic page payloads) ──
    async getCmsPage(pageKey: string) {
        const defaults: Record<string, unknown> = {
            'privacy-policy': { content: '' },
            'terms-and-conditions': { content: '' },
            'about-us': { content: '' },
            refund: { content: '' },
            cancelation: { content: '' },
            'shipping-policy': { content: '' },
            'admin-landing': { title: '' },
            'react-landing': { data: '' },
            'flutter-landing': { data: '' },
            seo: DEFAULT_SEO,
            social: DEFAULT_SOCIAL,
        };
        const key = `cms.${pageKey}`;
        return this.getKv(key, defaults[pageKey] ?? {});
    }

    async updateCmsPage(pageKey: string, body: Record<string, any>) {
        const key = `cms.${pageKey}`;
        return this.putKv(key, body ?? {});
    }

    private newId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /** Payout method templates (bank transfer, mobile money, etc.) */
    async getWithdrawMethods() {
        const result = await this.getKv<Record<string, unknown>[]>('withdraw_methods', []);
        return { success: true, data: Array.isArray(result.data) ? result.data : [] };
    }

    async createWithdrawMethod(body: Record<string, unknown>) {
        const name = String(body.name || '').trim();
        if (!name) return { success: false, message: 'Method name is required', data: null };

        const rawFields = body.fields;
        let fields: Array<{ name: string; type: string }> = [];
        if (Array.isArray(rawFields)) {
            fields = rawFields.map((f) => ({
                name: String((f as Record<string, unknown>).name || ''),
                type: String((f as Record<string, unknown>).type || 'text'),
            })).filter((f) => f.name);
        } else if (typeof rawFields === 'string') {
            fields = rawFields
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                    const [fieldName, fieldType] = line.split(':');
                    return { name: fieldName.trim(), type: (fieldType || 'text').trim() };
                });
        }

        const existing = await this.getKv<Record<string, unknown>[]>('withdraw_methods', []);
        const list = Array.isArray(existing.data) ? [...existing.data] : [];
        const created = {
            id: this.newId(),
            name,
            fields,
            is_default: Boolean(body.is_default),
            created_at: new Date().toISOString(),
        };
        list.push(created);
        const put = await this.putKv('withdraw_methods', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Withdraw method created', data: created };
    }

    async updateWithdrawMethod(id: string, body: Record<string, unknown>) {
        const existing = await this.getKv<Record<string, unknown>[]>('withdraw_methods', []);
        const list = Array.isArray(existing.data) ? [...existing.data] : [];
        const idx = list.findIndex((m) => String(m.id) === String(id));
        if (idx < 0) return { success: false, message: 'Withdraw method not found', data: null };

        if (typeof body.name === 'string' && body.name.trim()) list[idx].name = body.name.trim();
        if (body.fields !== undefined) {
            if (typeof body.fields === 'string') {
                list[idx].fields = String(body.fields)
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                        const [fieldName, fieldType] = line.split(':');
                        return { name: fieldName.trim(), type: (fieldType || 'text').trim() };
                    });
            } else if (Array.isArray(body.fields)) {
                list[idx].fields = body.fields;
            }
        }
        if (body.is_default !== undefined) list[idx].is_default = Boolean(body.is_default);

        const put = await this.putKv('withdraw_methods', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Withdraw method updated', data: list[idx] };
    }

    async deleteWithdrawMethod(id: string) {
        const existing = await this.getKv<Record<string, unknown>[]>('withdraw_methods', []);
        const list = Array.isArray(existing.data) ? existing.data.filter((m) => String(m.id) !== String(id)) : [];
        const put = await this.putKv('withdraw_methods', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Withdraw method deleted', data: null };
    }

    /** Admin custom roles with permission keys */
    async getCustomRoles() {
        const result = await this.getKv<Record<string, unknown>[]>('admin_custom_roles', []);
        return { success: true, data: Array.isArray(result.data) ? result.data : [] };
    }

    async createCustomRole(body: Record<string, unknown>) {
        const name = String(body.name || '').trim();
        if (!name) return { success: false, message: 'Role name is required', data: null };

        const permissions = Array.isArray(body.permissions)
            ? body.permissions.map((p) => String(p))
            : [];

        const existing = await this.getKv<Record<string, unknown>[]>('admin_custom_roles', []);
        const list = Array.isArray(existing.data) ? [...existing.data] : [];
        const created = {
            id: this.newId(),
            name,
            permissions,
            created_at: new Date().toISOString(),
        };
        list.push(created);
        const put = await this.putKv('admin_custom_roles', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Custom role created', data: created };
    }

    async updateCustomRole(id: string, body: Record<string, unknown>) {
        const existing = await this.getKv<Record<string, unknown>[]>('admin_custom_roles', []);
        const list = Array.isArray(existing.data) ? [...existing.data] : [];
        const idx = list.findIndex((r) => String(r.id) === String(id));
        if (idx < 0) return { success: false, message: 'Role not found', data: null };

        if (typeof body.name === 'string' && body.name.trim()) list[idx].name = body.name.trim();
        if (Array.isArray(body.permissions)) {
            list[idx].permissions = body.permissions.map((p) => String(p));
        }

        const put = await this.putKv('admin_custom_roles', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Custom role updated', data: list[idx] };
    }

    async deleteCustomRole(id: string) {
        const existing = await this.getKv<Record<string, unknown>[]>('admin_custom_roles', []);
        const list = Array.isArray(existing.data) ? existing.data.filter((r) => String(r.id) !== String(id)) : [];
        const put = await this.putKv('admin_custom_roles', list);
        if (!put.success) return { success: false, message: put.message, data: null };
        return { success: true, message: 'Custom role deleted', data: null };
    }
}
