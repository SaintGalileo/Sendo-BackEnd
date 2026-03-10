import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const authController = new AuthController();

router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/register-consumer', authController.registerConsumer);
router.post('/register-courier', authController.registerCourier);
router.post('/register-merchant', authController.registerMerchant);

export default router;
