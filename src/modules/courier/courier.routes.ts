import { Router } from 'express';
import { CourierController } from './courier.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const courierController = new CourierController();

router.use(authMiddleware);
router.use(roleMiddleware(['courier']));

// Profile
router.get('/profile', courierController.getProfile);
router.put('/profile', courierController.updateProfile);

// Availability
router.post('/go-online', courierController.goOnline);
router.post('/go-offline', courierController.goOffline);
router.get('/status', courierController.getStatus);

// Earnings
router.get('/earnings', courierController.getEarnings);
router.get('/earnings/history', courierController.getEarningsHistory);

// Delivery Jobs
router.get('/orders/available', courierController.getAvailableOrders);
router.post('/orders/:orderId/accept', courierController.acceptOrder);
router.post('/orders/:orderId/reject', courierController.rejectOrder);

// Delivery Process
router.post('/orders/:orderId/picked-up', courierController.pickedUpOrder);
router.post('/orders/:orderId/delivered', courierController.deliveredOrder);
router.post('/orders/:orderId/cancel', courierController.cancelDelivery);

export default router;
