import { AuthService } from './modules/auth/auth.service';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
    const authService = new AuthService();
    const testEmail = 'saintgalileo144@gmail.com';
    
    console.log(`Sending test Email OTP to ${testEmail}...`);
    const result = await authService.sendEmailOTP(testEmail);
    
    console.log('Result:', result);
}

testEmail().catch(err => {
    console.error('Test script failed:', err);
    process.exit(1);
});
