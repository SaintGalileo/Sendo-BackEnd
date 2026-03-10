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

// Categories
router.get('/categories', merchantController.getCategories);
router.post('/categories', merchantController.createCategory);
router.delete('/categories/:id', merchantController.deleteCategory);
router.put('/categories/:id', merchantController.updateCategory);

// Catalog / Menu view
router.get('/catalog', merchantController.getCatalog);

// Products
router.post('/products', merchantController.createProduct);
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
