import axios from 'axios';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
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

export class PaystackService {
    private get headers() {
        return {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        };
    }

    private assertConfigured() {
        if (!PAYSTACK_SECRET_KEY) {
            throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY on the server.');
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
