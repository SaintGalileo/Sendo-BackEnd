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

    // ── Modules (canonical Sendo verticals) ──
    private readonly CANONICAL_MODULES = [
        { id: 1, name: 'Supermarket & Groceries', type: 'Supermarket & Groceries', key: 'supermarket_groceries' },
        { id: 2, name: 'Food & Restaurant', type: 'Food & Restaurant', key: 'food_restaurant' },
        { id: 3, name: 'Bakery & Confectionery', type: 'Bakery & Confectionery', key: 'bakery_confectionery' },
        { id: 4, name: 'Pharmacy & Healthcare', type: 'Pharmacy & Healthcare', key: 'pharmacy_healthcare' },
        { id: 5, name: 'Beauty & Personal Care', type: 'Beauty & Personal Care', key: 'beauty_personal_care' },
        { id: 6, name: 'Fashion & Clothing', type: 'Fashion & Clothing', key: 'fashion_clothing' },
        { id: 7, name: 'Shoes & Bags', type: 'Shoes & Bags', key: 'shoes_bags' },
        { id: 8, name: 'Jewellery & Accessories', type: 'Jewellery & Accessories', key: 'jewellery_accessories' },
        { id: 9, name: 'Electronics & Gadgets', type: 'Electronics & Gadgets', key: 'electronics_gadgets' },
        { id: 10, name: 'Phones & Computers', type: 'Phones & Computers', key: 'phones_computers' },
        { id: 11, name: 'Home & Living', type: 'Home & Living', key: 'home_living' },
        { id: 12, name: 'Baby & Kids', type: 'Baby & Kids', key: 'baby_kids' },
        { id: 13, name: 'Sports & Fitness', type: 'Sports & Fitness', key: 'sports_fitness' },
        { id: 14, name: 'Books & Stationery', type: 'Books & Stationery', key: 'books_stationery' },
        { id: 15, name: 'Automotive', type: 'Automotive', key: 'automotive' },
        { id: 16, name: 'Hardware & Building', type: 'Hardware & Building', key: 'hardware_building' },
        { id: 17, name: 'Agriculture & Farm Supplies', type: 'Agriculture & Farm Supplies', key: 'agriculture_farm_supplies' },
        { id: 18, name: 'Pet Supplies', type: 'Pet Supplies', key: 'pet_supplies' },
        { id: 19, name: 'Gifts & Specialty', type: 'Gifts & Specialty', key: 'gifts_speciality' },
        { id: 20, name: 'Alcohol & Beverages', type: 'Alcohol & Beverages', key: 'alcohol_beverages' },
        { id: 21, name: 'Office & Business Supplies', type: 'Office & Business Supplies', key: 'office_business_supplies' },
        { id: 22, name: 'Local & Specialty Products', type: 'Local & Specialty Products', key: 'local_specialty_products' },
        { id: 23, name: 'Services', type: 'Services', key: 'services' },
        { id: 24, name: 'Wholesale & Bulk', type: 'Wholesale & Bulk', key: 'wholesale_bulk' },
        { id: 25, name: 'Other', type: 'Other', key: 'other' },
        { id: 26, name: 'Parcel', type: 'Parcel', key: 'parcel' },
        { id: 27, name: 'Rental', type: 'Rental', key: 'rental' },
    ] as const;

    async getModules() {
        const stored = await this.getKv<
            { id: number; name: string; type: string; vendors: number; status: boolean; key?: string }[]
        >('modules', []);

        // Vendor counts from merchants by type
        const { data: merchants } = await supabase.from('merchants').select('type, status');
        const vendorCount: Record<string, number> = {};
        const moduleKeySet = new Set<string>(this.CANONICAL_MODULES.map((m) => m.key));
        for (const m of merchants || []) {
            const t = String(m.type || '').toLowerCase();

            // 1) Keep `parcel`/`rental` as their own special modules.
            if (t.includes('parcel')) {
                vendorCount['parcel'] = (vendorCount['parcel'] || 0) + 1;
                continue;
            }
            if (t.includes('rental')) {
                vendorCount['rental'] = (vendorCount['rental'] || 0) + 1;
                continue;
            }

            // 2) Map legacy merchant.type values to the new canonical categories.
            //    (Pre-migration safety: once the DB migration runs, merchants.type will already
            //    use these canonical keys directly.)
            if (t.includes('grocery')) {
                vendorCount['supermarket_groceries'] = (vendorCount['supermarket_groceries'] || 0) + 1;
                continue;
            }
            if (t.includes('food') || t.includes('restaurant')) {
                vendorCount['food_restaurant'] = (vendorCount['food_restaurant'] || 0) + 1;
                continue;
            }
            if (t.includes('pharmacy')) {
                vendorCount['pharmacy_healthcare'] = (vendorCount['pharmacy_healthcare'] || 0) + 1;
                continue;
            }
            if (t.includes('shop') || t === 'store') {
                vendorCount['other'] = (vendorCount['other'] || 0) + 1;
                continue;
            }

            // 3) New canonical keys map directly.
            if (moduleKeySet.has(t)) {
                vendorCount[t] = (vendorCount[t] || 0) + 1;
                continue;
            }

            // 4) Unknown merchant types still count under `Other`.
            vendorCount['other'] = (vendorCount['other'] || 0) + 1;
        }

        const byType = new Map(
            (Array.isArray(stored.data) ? stored.data : []).map((m) => [
                String(m.type || m.key || '').toLowerCase(),
                m,
            ]),
        );

        const modules = this.CANONICAL_MODULES.map((mod) => {
            const existing =
                byType.get(mod.type.toLowerCase()) ||
                byType.get(mod.key) ||
                byType.get(mod.name.toLowerCase());
            return {
                id: mod.id,
                name: mod.name,
                type: mod.type,
                key: mod.key,
                vendors: vendorCount[mod.key] || 0,
                status: existing ? Boolean(existing.status) : true,
            };
        });

        // Persist sync so UI toggles have a baseline
        await this.putKv('modules', modules);
        return { success: true as const, data: modules };
    }

    async updateModules(modules: unknown) {
        if (!Array.isArray(modules)) {
            return { success: false, message: 'modules must be an array', data: null };
        }
        const byType = new Map(
            modules.map((m: any) => [String(m.type || m.key || '').toLowerCase(), m]),
        );
        const normalized = this.CANONICAL_MODULES.map((mod) => {
            const existing =
                byType.get(mod.type.toLowerCase()) ||
                byType.get(mod.key) ||
                byType.get(mod.name.toLowerCase());
            return {
                id: mod.id,
                name: mod.name,
                type: mod.type,
                key: mod.key,
                vendors: Number(existing?.vendors ?? 0),
                status: existing ? Boolean(existing.status) : true,
            };
        });
        return this.putKv('modules', normalized);
    }

    async getEmailTemplate(templateKey: string) {
        const defaults: Record<string, { subject: string; body: string }> = {
            'admin-forgot-password': {
                subject: 'Reset your admin password',
                body: `Hi {{name}},\n\nUse this link to reset your password: {{link}}\n\nOr use this token: {{token}}\n\nThis expires in {{expiry_minutes}} minutes.`,
            },
            'rental-provider-registration': {
                subject: 'Rental provider registration',
                body: `Hi {{name}},\n\nYour rental provider registration was received.`,
            },
        };
        return this.getKv(`email_template.${templateKey}`, defaults[templateKey] || { subject: '', body: '' });
    }

    async updateEmailTemplate(templateKey: string, body: Record<string, any>) {
        return this.putKv(`email_template.${templateKey}`, {
            subject: String(body.subject || ''),
            body: String(body.body || ''),
        });
    }

    // ── Gallery (uploaded media URL index) ──
    async getGallery() {
        return this.getKv<{ url: string; name?: string; created_at?: string }[]>('gallery_files', []);
    }

    async updateGallery(files: unknown) {
        if (!Array.isArray(files)) {
            return { success: false, message: 'files must be an array', data: null };
        }
        const normalized = files
            .map((f: any) => ({
                url: String(f?.url || '').trim(),
                name: String(f?.name || '').trim() || undefined,
                created_at: f?.created_at ? String(f.created_at) : new Date().toISOString(),
            }))
            .filter((f) => f.url);
        return this.putKv('gallery_files', normalized);
    }

    // ── Languages (admin UI locale packs) ──
    async getLanguages() {
        return this.getKv(
            'languages',
            [{ name: 'English', code: 'en', statusLabel: 'Default', enabled: true }],
        );
    }

    async updateLanguages(languages: unknown) {
        if (!Array.isArray(languages)) {
            return { success: false, message: 'languages must be an array', data: null };
        }
        return this.putKv('languages', languages);
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
