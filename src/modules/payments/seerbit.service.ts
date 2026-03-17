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
    async createVirtualAccount(fullName: string, email: string, reference: string): Promise<SeerBitAccountResponse | null> {
        try {
            const response = await axios.post(`${SEERBIT_BASE_URL}/virtual-accounts`, {
                publicKey: SEERBIT_PUBLIC_KEY,
                fullName: fullName,
                bankVerificationNumber: "", // Optional, as per user prompt snippet
                currency: "NGN",
                country: "NG",
                reference: reference,
                email: email
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SEERBIT_SECRET_KEY}`
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
