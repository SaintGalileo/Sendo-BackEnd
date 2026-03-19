import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/payments';
const WEBHOOK_URL = `${BASE_URL}/webhook/seerbit`;

async function testWebhook() {
    console.log('--- Testing SeerBit Webhook ---');

    // 1. Test Unauthenticated Access
    try {
        console.log('Test 1: Public access check...');
        const res = await axios.post(WEBHOOK_URL, {
            eventType: 'transaction',
            data: {
                gatewayMessage: 'Successful',
                amount: '500.00',
                reference: 'TEST_REF_123',
                creditAccountNumber: '1234567890',
                currency: 'NGN',
                email: 'test@example.com'
            }
        });
        console.log('Response Status:', res.status);
        console.log('Response Body:', res.data);
    } catch (error: any) {
        console.error('Test 1 Failed:', error.response?.status, error.response?.data || error.message);
    }

    // 2. Test Adyen-style (Optional but supported by my code)
    try {
        console.log('\nTest 2: Adyen-style payload check...');
        const res = await axios.post(WEBHOOK_URL, {
            notificationItems: [
                {
                    notificationRequestItem: {
                        eventType: 'transaction',
                        data: {
                            gatewayMessage: 'Successful',
                            amount: '1000.00',
                            reference: 'TEST_REF_456',
                            creditAccountNumber: '0987654321',
                            currency: 'NGN'
                        }
                    }
                }
            ]
        });
        console.log('Response Status:', res.status);
        console.log('Response Body:', res.data);
    } catch (error: any) {
        console.error('Test 2 Failed:', error.response?.status, error.response?.data || error.message);
    }
}

testWebhook();
