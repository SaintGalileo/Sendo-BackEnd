import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const ordersController = new OrdersController();

router.use(authMiddleware);
router.use(roleMiddleware(['consumer']));

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getOrders);

router.get('/delivery-fee', ordersController.getDeliveryFeeEstimate);
router.get('/:orderId', ordersController.getOrderById);
router.post('/:orderId/cancel', ordersController.cancelOrder);
router.post('/:orderId/rate', ordersController.rateOrder);
router.get('/:orderId/tracking', ordersController.getOrderTracking);

export default router;
