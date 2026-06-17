import { AuthService } from './modules/auth/auth.service';
import dotenv from 'dotenv';

dotenv.config();

async function testSMS() {
    const authService = new AuthService();
    const testNumber = '+2347040520952';
    
    console.log(`Sending test SMS to ${testNumber}...`);
    const result = await authService.sendOTP(testNumber);
    
    console.log('Result:', result);
    process.exit(result.success ? 0 : 1);
}

testSMS().catch(err => {
    console.error('Test script failed:', err);
    process.exit(1);
});
