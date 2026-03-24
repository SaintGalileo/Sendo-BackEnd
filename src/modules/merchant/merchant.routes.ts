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

// Product Extras
router.post('/products/:productId/extra-groups', merchantController.createExtraGroup);
router.delete('/extra-groups/:id', merchantController.deleteExtraGroup);
router.post('/extra-groups/:groupId/options', merchantController.addExtraOption);
router.delete('/extra-options/:id', merchantController.deleteExtraOption);

// Orders
router.get('/orders', merchantController.getOrders);
router.get('/orders/:id', merchantController.getOrderById);
router.post('/orders/:id/accept', merchantController.acceptOrder);
router.post('/orders/:id/decline', merchantController.declineOrder);
router.post('/orders/:id/prepare', merchantController.prepareOrder);
router.post('/orders/:id/ready', merchantController.readyForPickupOrder);
router.post('/orders/:id/pickup', merchantController.pickUpOrder);
router.post('/orders/:id/on-the-way', merchantController.onTheWayOrder);
router.post('/orders/:id/deliver', merchantController.deliverOrder);
router.put('/orders/:id/status', merchantController.updateOrderStatus);

// Earnings
router.get('/earnings', merchantController.getEarnings);

export default router;
