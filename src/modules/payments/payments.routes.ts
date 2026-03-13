import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const paymentsController = new PaymentsController();

router.use(authMiddleware);
router.use(roleMiddleware(['consumer'])); // Consumers initiate payments

router.post('/intent', paymentsController.createIntent);
router.post('/confirm', paymentsController.confirmPayment);
router.get('/history', paymentsController.getHistory);

router.post('/tip', paymentsController.addTip);
router.post('/refund', paymentsController.refundPayment);

// Wallet
router.get('/wallet/balance', paymentsController.getWalletBalance);
router.get('/wallet/transactions', paymentsController.getWalletTransactions);

export default router;
