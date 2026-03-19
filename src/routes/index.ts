import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import { PaymentsController } from '../modules/payments/payments.controller';

// New unified routes
import consumerRoutes from '../modules/consumer/consumer.routes';
import storesRoutes from '../modules/stores/stores.routes';
import productsRoutes from '../modules/products/products.routes';
import cartRoutes from '../modules/cart/cart.routes';
import ordersRoutes from '../modules/orders/orders.routes';
import paymentsRoutes from '../modules/payments/payments.routes';
import merchantRoutes from '../modules/merchant/merchant.routes';
import courierRoutes from '../modules/courier/courier.routes';
import trackingRoutes from '../modules/tracking/tracking.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';
import couponsRoutes from '../modules/coupons/coupons.routes';
import { reviewRoutes, storeReviewRoutes, courierReviewRoutes } from '../modules/reviews/reviews.routes';

const router = Router();
const paymentsController = new PaymentsController();

// Public Webhook (MUST be before any auth middleware)
router.post('/payments/webhook/seerbit', paymentsController.handleSeerBitWebhook);

// Existing Auth
router.use('/auth', authRoutes);

// Shared / Discovery (Consumer view)
router.use('/users', consumerRoutes); // profile, addresses, favorites
router.use('/stores', storesRoutes);
router.use('/products', productsRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', ordersRoutes);
router.use('/payments', paymentsRoutes);
router.use('/coupons', couponsRoutes);

// Mount nested review gets under stores and couriers mappings
router.use('/stores/:storeId/reviews', storeReviewRoutes);
router.use('/couriers/:courierId/reviews', courierReviewRoutes);
// Root reviews for POST
router.use('/reviews', reviewRoutes);

// unified Merchant
router.use('/merchant', merchantRoutes);

// unified Courier
router.use('/courier', courierRoutes);
// Since Tracking requires POST /courier/location, mounting trackingRoutes under /courier makes sense based on prompt
router.use('/courier', trackingRoutes);

// Notifications
router.use('/notifications', notificationsRoutes);

router.get('/', (req, res) => {
  res.json({ message: 'API root' });
});

export default router;
