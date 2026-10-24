import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const paymentsController = new PaymentsController();

// Auth Middleware
router.use(authMiddleware);

// Consumer-only payment routes
const consumerOnly = roleMiddleware(['consumer']);
router.post('/intent', consumerOnly, paymentsController.createIntent);
router.post('/checkout-link', consumerOnly, (req, res) => paymentsController.createCheckoutLink(req as any, res));
router.post('/verify-paystack', consumerOnly, (req, res) => paymentsController.verifyPaystackPayment(req as any, res));
router.post('/confirm', consumerOnly, paymentsController.confirmPayment);
router.get('/history', consumerOnly, paymentsController.getHistory);

router.post('/tip', consumerOnly, paymentsController.addTip);
router.post('/refund', consumerOnly, paymentsController.refundPayment);

// Wallet endpoints (accessible by consumers, merchants, and couriers)
const walletRoles = roleMiddleware(['consumer', 'merchant', 'courier', 'admin']);
router.get('/wallet', walletRoles, paymentsController.getWallet);
router.post('/wallet/refresh-account', walletRoles, paymentsController.refreshWalletAccount);
router.get('/wallet/balance', walletRoles, paymentsController.getWalletBalance);
router.get('/wallet/transactions', walletRoles, paymentsController.getWalletTransactions);

export default router;
