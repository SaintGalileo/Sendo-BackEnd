import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminUsersController } from './admin.users.controller';
import { AdminStoresController } from './admin.stores.controller';
import { AdminDispatchController } from './admin.dispatch.controller';
import { AdminCouponsController } from './admin.coupons.controller';
import { AdminDashboardController } from './admin.dashboard.controller';
import { AdminTransactionsController } from './admin.transactions.controller';

const router = Router();
const ordersCtrl = new AdminOrdersController();
const usersCtrl = new AdminUsersController();
const storesCtrl = new AdminStoresController();
const dispatchCtrl = new AdminDispatchController();
const couponsCtrl = new AdminCouponsController();
const dashboardCtrl = new AdminDashboardController();
const transactionsCtrl = new AdminTransactionsController();

// All admin routes require authentication + admin role
router.use(authMiddleware, roleMiddleware(['admin']));

// Health check
router.get('/health', (_req, res) => res.json({ success: true, message: 'Admin API healthy' }));

// ── Dashboard ──
router.get('/dashboard', dashboardCtrl.getOverview);

// ── Orders ──
router.get('/orders', ordersCtrl.listOrders);
router.get('/orders/:id', ordersCtrl.getOrder);
router.post('/orders/:id/cancel', ordersCtrl.cancelOrder);

// ── Users ──
router.get('/customers', usersCtrl.listCustomers);
router.get('/customers/:id', usersCtrl.getCustomer);
router.get('/couriers', usersCtrl.listCouriers);
router.get('/couriers/:id', usersCtrl.getCourier);
router.get('/merchants', usersCtrl.listMerchants);

// ── Stores ──
router.get('/stores', storesCtrl.listStores);
router.get('/stores/:id', storesCtrl.getStore);
router.put('/stores/:id/status', storesCtrl.updateStoreStatus);

// ── Dispatch ──
router.get('/dispatch/orders/available', dispatchCtrl.listAvailableOrders);
router.post('/dispatch/orders/:orderId/assign', dispatchCtrl.assignCourier);

// ── Transactions ──
router.get('/transactions/report', transactionsCtrl.getTransactionReport);
router.get('/transactions/:type/withdraw-requests', transactionsCtrl.getWithdrawRequests);

// ── Coupons ──
router.get('/coupons', couponsCtrl.listCoupons);
router.post('/coupons', couponsCtrl.createCoupon);
router.put('/coupons/:id', couponsCtrl.updateCoupon);
router.delete('/coupons/:id', couponsCtrl.deleteCoupon);

export default router;
