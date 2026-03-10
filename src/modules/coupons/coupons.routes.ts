import { Router } from 'express';
import { CouponsController } from './coupons.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const couponsController = new CouponsController();

// generic fetch
router.get('/', couponsController.getCoupons);

// apply mapping
router.post('/apply', authMiddleware, roleMiddleware(['consumer']), couponsController.applyCoupon);

export default router;
