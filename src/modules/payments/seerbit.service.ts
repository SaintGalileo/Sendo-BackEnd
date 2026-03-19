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
}
