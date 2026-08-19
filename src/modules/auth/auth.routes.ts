import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

router.post('/send-otp', authController.sendOTP);
router.post('/phone/send-otp', authController.sendOTP); // Alias for Rider app
router.post('/verify-otp', authController.verifyOTP);
router.post('/phone/verify-otp', authController.verifyOTP); // Alias for Rider app

router.post('/register-consumer', authController.registerConsumer);
router.post('/register-courier', authController.registerCourier);
router.post('/register/rider', authController.registerCourier); // Alias for Rider app
router.post('/register-merchant', authController.registerMerchant);

// Admin login (email + password)
// Note: keep this route path stable because Sendo-v2 proxies it at /api/auth/admin/login.
router.post('/admin/login', authController.adminLogin);

// Email OTP (For SeerBit and other verifications) - Authenticated
router.post('/otp/email/send', authMiddleware, authController.sendEmailOTP);
router.post('/otp/email/verify', authMiddleware, authController.verifyEmailOTP);

export default router;
