import axios from 'axios';
import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
export const PAYSTACK_CALLBACK_URL =
    process.env.PAYSTACK_CALLBACK_URL || 'https://sendo-pay-callback.netlify.app';

export type PaystackInitResult = {
    authorization_url: string;
    access_code: string;
    reference: string;
};

export type PaystackVerifyResult = {
    paid: boolean;
    status: string;
    amountNaira: number;
    amountKobo: number;
    reference: string;
    currency: string;
    raw: any;
};

export type PaystackVirtualAccountResult = {
    accountNumber: string;
    bankName: string;
    accountName: string;
    reference: string;
    customerCode: string;
};

export class PaystackService {
    private get secretKey(): string {
        return process.env.PAYSTACK_SECRET_KEY || '';
    }

    private get headers() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    private assertConfigured() {
        if (!this.secretKey) {
            throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY on the server.');
        }
    }

    /**
     * Create or retrieve a dedicated virtual account (NUBAN) for a customer.
     */
    async createDedicatedVirtualAccount(input: {
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
        preferredBank?: string;
    }): Promise<PaystackVirtualAccountResult | null> {
        this.assertConfigured();

        const cleanEmail = (input.email || '').trim().toLowerCase();
        const cleanPhone = input.phone ? String(input.phone).trim() : undefined;
        let customerCode = '';

        // 1. Create or fetch Customer on Paystack
        try {
            console.log(`[PAYSTACK_DVA] Creating/fetching customer: ${cleanEmail}`);
            const custRes = await axios.post(
                `${PAYSTACK_BASE_URL}/customer`,
                {
                    email: cleanEmail,
                    first_name: input.firstName || 'Sendo',
                    last_name: input.lastName || 'Customer',
                    phone: cleanPhone,
                },
                { headers: this.headers, timeout: 20000 }
            );
            customerCode = custRes.data?.data?.customer_code;
        } catch (custErr: any) {
            console.warn('[PAYSTACK_DVA] Customer create note:', custErr.response?.data?.message || custErr.message);
            // Fetch customer by email
            try {
                const getCust = await axios.get(
                    `${PAYSTACK_BASE_URL}/customer/${encodeURIComponent(cleanEmail)}`,
                    { headers: this.headers, timeout: 20000 }
                );
                const custData = getCust.data?.data;
                customerCode = custData?.customer_code;

                // Check if customer already has dedicated account assigned
                const dedicatedAccounts = custData?.dedicated_accounts || (custData?.dedicated_account ? [custData.dedicated_account] : []);
                if (dedicatedAccounts.length > 0) {
                    const activeDva = dedicatedAccounts[0];
                    console.log(`[PAYSTACK_DVA] Found existing dedicated account for ${cleanEmail}: ${activeDva.account_number} (${activeDva.bank?.name})`);
                    return {
                        accountNumber: activeDva.account_number,
                        bankName: activeDva.bank?.name || 'Wema Bank',
                        accountName: activeDva.account_name || `${input.firstName} ${input.lastName}`,
                        reference: activeDva.assignment?.account_id || customerCode,
                        customerCode,
                    };
                }
            } catch (fetchErr: any) {
                console.error('[PAYSTACK_DVA] Failed to fetch customer:', fetchErr.response?.data || fetchErr.message);
                throw custErr;
            }
        }

        if (!customerCode) {
            throw new Error('Failed to obtain customer code from Paystack');
        }

        // 2. Create Dedicated Virtual Account
        console.log(`[PAYSTACK_DVA] Creating dedicated account for customer ${customerCode}`);
        const bankCandidates = input.preferredBank ? [input.preferredBank] : ['wema-bank', 'titan-paystack', undefined];

        let lastError: any = null;
        for (const bank of bankCandidates) {
            try {
                const payload: any = { customer: customerCode };
                if (bank) payload.preferred_bank = bank;

                const dvaRes = await axios.post(
                    `${PAYSTACK_BASE_URL}/dedicated_account`,
                    payload,
                    { headers: this.headers, timeout: 20000 }
                );

                const data = dvaRes.data?.data;
                if (data && data.account_number) {
                    console.log(`[PAYSTACK_DVA] Dedicated account created successfully: ${data.account_number} (${data.bank?.name})`);
                    return {
                        accountNumber: data.account_number,
                        bankName: data.bank?.name || 'Wema Bank',
                        accountName: data.account_name || `${input.firstName} ${input.lastName}`,
                        reference: String(data.id || customerCode),
                        customerCode,
                    };
                }
            } catch (dvaErr: any) {
                lastError = dvaErr;
                console.warn(`[PAYSTACK_DVA] Failed with preferred_bank '${bank}':`, dvaErr.response?.data?.message || dvaErr.message);
            }
        }

        // 3. Fallback: dedicated_account/assign
        try {
            console.log(`[PAYSTACK_DVA] Trying dedicated_account/assign for ${customerCode}`);
            const assignRes = await axios.post(
                `${PAYSTACK_BASE_URL}/dedicated_account/assign`,
                {
                    email: cleanEmail,
                    first_name: input.firstName || 'Sendo',
                    last_name: input.lastName || 'Customer',
                    phone: cleanPhone,
                    preferred_bank: 'wema-bank',
                    country: 'NG',
                },
                { headers: this.headers, timeout: 20000 }
            );
            const assignData = assignRes.data?.data;
            if (assignData && assignData.account_number) {
                return {
                    accountNumber: assignData.account_number,
                    bankName: assignData.bank?.name || 'Wema Bank',
                    accountName: assignData.account_name || `${input.firstName} ${input.lastName}`,
                    reference: String(assignData.id || customerCode),
                    customerCode,
                };
            }
        } catch (assignErr: any) {
            console.warn('[PAYSTACK_DVA] dedicated_account/assign error:', assignErr.response?.data?.message || assignErr.message);
        }

        throw lastError || new Error('Failed to create Paystack dedicated virtual account');
    }

    /**
     * Resolve a Nigerian bank account number to verify account name.
     */
    async resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string }> {
        this.assertConfigured();

        const cleanAccount = String(accountNumber || '').trim();
        const cleanBank = String(bankCode || '').trim();

        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(cleanAccount)}&bank_code=${encodeURIComponent(cleanBank)}`,
            { headers: this.headers, timeout: 20000 }
        );

        const data = response.data?.data;
        if (!response.data?.status || !data?.account_name) {
            throw new Error(response.data?.message || 'Unable to resolve bank account');
        }

        return {
            accountName: data.account_name,
            accountNumber: data.account_number || cleanAccount,
        };
    }

    /**
     * List Nigerian banks supported by Paystack.
     */
    async listBanks(country = 'nigeria'): Promise<Array<{ name: string; code: string; slug: string }>> {
        this.assertConfigured();

        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/bank?country=${encodeURIComponent(country)}`,
            { headers: this.headers, timeout: 20000 }
        );

        return response.data?.data || [];
    }

    /**
     * Verify Paystack webhook HMAC-SHA512 signature.
     */
    verifyWebhookSignature(signature: string, payload: any): boolean {
        if (!this.secretKey || !signature) return false;
        try {
            const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
            return hash === signature;
        } catch (err) {
            return false;
        }
    }

    /**
     * Initialize a Paystack transaction.
     * Amount must be in Naira; converted to kobo for Paystack.
     */
    async initializeTransaction(input: {
        email: string;
        amountNaira: number;
        reference: string;
        callbackUrl?: string;
        metadata?: Record<string, unknown>;
        fullName?: string;
    }): Promise<PaystackInitResult> {
        this.assertConfigured();

        const amountKobo = Math.round(Number(input.amountNaira) * 100);
        if (!amountKobo || amountKobo < 100) {
            throw new Error('Invalid payment amount');
        }

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            {
                email: input.email,
                amount: amountKobo,
                currency: 'NGN',
                reference: input.reference,
                callback_url: input.callbackUrl || PAYSTACK_CALLBACK_URL,
                metadata: {
                    custom_fields: input.fullName
                        ? [{ display_name: 'Customer', variable_name: 'full_name', value: input.fullName }]
                        : undefined,
                    ...(input.metadata || {}),
                },
            },
            { headers: this.headers, timeout: 20000 },
        );

        const data = response.data?.data;
        if (!response.data?.status || !data?.authorization_url) {
            throw new Error(response.data?.message || 'Failed to initialize Paystack payment');
        }

        return {
            authorization_url: data.authorization_url,
            access_code: data.access_code,
            reference: data.reference || input.reference,
        };
    }

    /**
     * Verify a Paystack transaction by reference.
     */
    async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
        this.assertConfigured();

        const cleanRef = String(reference || '').trim();
        if (!cleanRef) {
            throw new Error('Payment reference is required');
        }

        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(cleanRef)}`,
            { headers: this.headers, timeout: 20000 },
        );

        const data = response.data?.data;
        if (!response.data?.status || !data) {
            throw new Error(response.data?.message || 'Failed to verify Paystack payment');
        }

        const amountKobo = Number(data.amount) || 0;
        const status = String(data.status || '').toLowerCase();
        const paid = status === 'success';

        return {
            paid,
            status,
            amountKobo,
            amountNaira: amountKobo / 100,
            reference: data.reference || cleanRef,
            currency: data.currency || 'NGN',
            raw: data,
        };
    }
}

