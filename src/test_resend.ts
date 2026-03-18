import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const resendApiKey = process.env.RESEND_API_KEY;
console.log('API Key present:', !!resendApiKey);

const resend = new Resend(resendApiKey);

async function testEmail() {
    console.log('Attempting to send test email to saintgalileo144@gmail.com...');
    try {
        const { data, error } = await resend.emails.send({
            from: 'Sendo <onboarding@resend.dev>',
            to: 'saintgalileo144@gmail.com',
            subject: 'Test OTP Email',
            html: '<h1>Your OTP is 123456</h1>',
        });

        if (error) {
            console.error('RESEND ERROR:', JSON.stringify(error, null, 2));
        } else {
            console.log('RESEND SUCCESS:', data);
        }
    } catch (err) {
        console.error('CATCH ERROR:', err);
    }
}

testEmail();
