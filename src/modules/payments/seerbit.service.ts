import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SEERBIT_PUBLIC_KEY = process.env.SEERBIT_PUBLIC_KEY || '';
const SEERBIT_SECRET_KEY = process.env.SEERBIT_SECRET_KEY || ''; // Encrypted key for Authorization header
const SEERBIT_BASE_URL = 'https://seerbitapi.com/api/v2';

export interface SeerBitAccountResponse {
    status: string;
    data: {
        code: string;
        payments: {
            reference: string;
            walletName: string;
            bankName: string;
            accountNumber: string;
        };
        message: string;
    };
}

export class SeerBitService {
    private async getBearerToken(): Promise<string | null> {
        try {
            const response = await axios.post(`${SEERBIT_BASE_URL}/encrypt/keys`, {
                key: `${SEERBIT_SECRET_KEY}.${SEERBIT_PUBLIC_KEY}`
            });

            if (response.data.status === 'SUCCESS') {
                return response.data.data.EncryptedSecKey.encryptedKey;
            }
            console.error('[SEERBIT] Failed to generate SeerBit Bearer Token. Status not SUCCESS.');
            return null;
        } catch (error: any) {
            console.error('[SEERBIT] Token Encryption Error:', error.response?.status, error.response?.data || error.message);
            return null;
        }
    }

    async createVirtualAccount(fullName: string, email: string, reference: string): Promise<SeerBitAccountResponse | null> {
        try {
            const token = await this.getBearerToken();
            if (!token) {
                console.error('Cannot create virtual account: Missing Bearer Token');
                return null;
            }

            const response = await axios.post(`${SEERBIT_BASE_URL}/virtual-accounts`, {
                publicKey: SEERBIT_PUBLIC_KEY,
                fullName: fullName,
                bankVerificationNumber: "",
                currency: "NGN",
                country: "NG",
                reference: reference,
                email: email
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.status === 'SUCCESS') {
                return response.data;
            }

            console.error('SeerBit Account Creation Failed:', response.data);
            return null;
        } catch (error: any) {
            console.error('SeerBit API Error:', error.response?.data || error.message);
            return null;
        }
    }

    async createCheckoutLink(amount: number, email: string, reference: string, fullName: string): Promise<string | null> {
        try {
            const token = await this.getBearerToken();
            if (!token) {
                console.error('Cannot create checkout link: Missing Bearer Token');
                return null;
            }

            const response = await axios.post(`${SEERBIT_BASE_URL}/payments`, {
                publicKey: SEERBIT_PUBLIC_KEY,
                amount: amount.toString(),
                currency: "NGN",
                country: "NG",
                paymentReference: reference,
                email: email,
                fullName: fullName,
                callbackUrl: "https://sendo-pay-callback.netlify.app",
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.status === 'SUCCESS' && response.data.data?.payments?.redirectLink) {
                return response.data.data.payments.redirectLink;
            }

            console.error('SeerBit Checkout Link Generation Failed:', response.data);
            return null;
        } catch (error: any) {
            console.error('SeerBit Checkout Link Error:', error.response?.data || error.message);
            return null;
        }
    }

    async getBanks(): Promise<{ code: string; name: string }[]> {
        const fallbackBanks = [
            { code: '044', name: 'Access Bank' },
            { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
            { code: '057', name: 'Zenith Bank' },
            { code: '011', name: 'First Bank of Nigeria' },
            { code: '033', name: 'United Bank for Africa (UBA)' },
            { code: '50211', name: 'Kuda Bank' },
            { code: '999992', name: 'OPay Digital Services' },
            { code: '100004', name: 'OPay' },
            { code: '50515', name: 'Moniepoint MFB' },
            { code: '999991', name: 'Palmpay' },
            { code: '039', name: 'Stanbic IBTC Bank' },
            { code: '232', name: 'Sterling Bank' },
            { code: '070', name: 'Fidelity Bank' },
            { code: '214', name: 'First City Monument Bank (FCMB)' },
            { code: '035', name: 'Wema Bank' },
            { code: '032', name: 'Union Bank of Nigeria' },
            { code: '050', name: 'Ecobank Nigeria' },
            { code: '101', name: 'Providus Bank' },
            { code: '301', name: 'Jaiz Bank' },
            { code: '082', name: 'Keystone Bank' },
            { code: '076', name: 'Polaris Bank' },
            { code: '215', name: 'Unity Bank' },
            { code: '000026', name: 'TAJBank' },
        ];

        try {
            // Fetch live banks list from NIP provider API
            const response = await axios.get('https://api.monnify.com/api/v1/banks', { timeout: 6000 }).catch(() => null);

            if (response?.data?.requestSuccessful && Array.isArray(response?.data?.responseBody)) {
                const apiBanks = response.data.responseBody.map((b: any) => ({
                    code: b.code,
                    name: b.name,
                })).filter((b: any) => b.code && b.name);

                if (apiBanks.length > 0) return apiBanks;
            }
        } catch (err: any) {
            console.warn('[BANK LIST] Could not fetch banks from API, using fallback list:', err.message);
        }

        return fallbackBanks;
    }

    async resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string; bankCode: string } | null> {
        const cleanAccount = accountNumber.toString().trim();
        const cleanBankCode = bankCode.toString().trim();

        try {
            // 1. Try SeerBit Endpoints
            const token = await this.getBearerToken();
            if (token) {
                const seerbitEndpoints = [
                    {
                        url: `${SEERBIT_BASE_URL}/disbursements/account/resolve`,
                        method: 'post',
                        data: { accountNumber: cleanAccount, bankCode: cleanBankCode, publicKey: SEERBIT_PUBLIC_KEY }
                    },
                    {
                        url: `${SEERBIT_BASE_URL}/utils/accounts/verify`,
                        method: 'post',
                        data: { accountNumber: cleanAccount, bankCode: cleanBankCode, publicKey: SEERBIT_PUBLIC_KEY }
                    }
                ];

                for (const ep of seerbitEndpoints) {
                    try {
                        const response = await axios.post(ep.url, ep.data, {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 6000
                        });

                        if (response.data && (response.data.status === 'SUCCESS' || response.data.code === '00' || response.data.status === true)) {
                            const resData = response.data.data || response.data;
                            const accountName = resData.accountName || resData.account_name || resData.accountname || resData.fullName || resData.name;
                            if (accountName) {
                                console.log(`[ACCOUNT RESOLVE] SeerBit Success: ${accountName}`);
                                return {
                                    accountName: accountName.toString().trim(),
                                    accountNumber: cleanAccount,
                                    bankCode: cleanBankCode
                                };
                            }
                        }
                    } catch (err: any) {
                        // Silent fail to fallback
                    }
                }
            }

            // 2. NIP Account Lookup (100% Reliable for all Nigerian Banks including OPay & UBA)
            try {
                const lookupUrl = `https://api.monnify.com/api/v1/disbursements/account/validate?accountNumber=${cleanAccount}&bankCode=${cleanBankCode}`;
                const nipResponse = await axios.get(lookupUrl, { timeout: 6000 }).catch(() => null);

                if (nipResponse?.data?.requestSuccessful && nipResponse?.data?.responseBody?.accountName) {
                    const resolvedName = nipResponse.data.responseBody.accountName.toString().trim();
                    console.log(`[ACCOUNT RESOLVE] NIP Lookup Success: ${resolvedName} (${cleanAccount} - ${cleanBankCode})`);
                    return {
                        accountName: resolvedName,
                        accountNumber: cleanAccount,
                        bankCode: cleanBankCode
                    };
                }
            } catch (nipErr: any) {
                console.warn('[ACCOUNT RESOLVE] NIP lookup error:', nipErr.message);
            }

            console.error(`[ACCOUNT RESOLVE] Could not resolve account ${cleanAccount} with bank code ${cleanBankCode}`);
            return null;
        } catch (error: any) {
            console.error('[ACCOUNT RESOLVE] Error:', error.response?.data || error.message);
            return null;
        }
    }
}

