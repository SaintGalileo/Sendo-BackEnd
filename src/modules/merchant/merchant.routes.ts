import { Router } from 'express';
import { MerchantController } from './merchant.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';
import { OrderStatus } from '../../common/constants/orderStatus';

const router = Router();
const merchantController = new MerchantController();

// Public / Onboarding
router.post('/register', merchantController.registerStore);

router.use(authMiddleware);
router.use(roleMiddleware(['merchant']));

// Store
router.get('/store', merchantController.getStore);
router.put('/store', merchantController.updateStore);
router.put('/store/status', merchantController.updateStatus);

// Categories (Create/Read are in menuController currently, but we can map them here for the requested structure)
// The existing menu controller takes merchantId from body for create, but RESTfully it should be tied to the auth user.
// For simplicity matching the prompt, we map the extensions.
router.delete('/categories/:id', merchantController.deleteCategory);
router.put('/categories/:id', merchantController.updateCategory);

// Products
router.delete('/products/:id', merchantController.deleteProduct);
router.put('/products/:id/availability', merchantController.updateProductAvailability);

// Orders
router.get('/orders', merchantController.getOrders);
router.get('/orders/:id', merchantController.getOrderById);

// Order Status transitions
router.post('/orders/:id/accept', (req, res) => {
    req.body.status = OrderStatus.ACCEPTED;
    merchantController.updateOrderStatus(req as any, res);
});
router.post('/orders/:id/reject', (req, res) => {
    req.body.status = OrderStatus.CANCELLED;
    merchantController.updateOrderStatus(req as any, res);
});
router.post('/orders/:id/ready', (req, res) => {
    req.body.status = OrderStatus.READY_FOR_PICKUP;
    merchantController.updateOrderStatus(req as any, res);
});

export default router;
