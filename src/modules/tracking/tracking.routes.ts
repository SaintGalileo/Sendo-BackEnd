import { Router } from 'express';
import { TrackingController } from './tracking.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const trackingController = new TrackingController();

router.use(authMiddleware);

// Courier updating their location
// In a real app we'd map this from /courier/location in main router
router.post('/location', roleMiddleware(['courier']), trackingController.updateLocation);

export default router;
