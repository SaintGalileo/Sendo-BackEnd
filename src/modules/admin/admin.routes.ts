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
import { AdminItemsController } from './admin.items.controller';
import { AdminCategoriesController } from './admin.categories.controller';
import { AdminAttributesController } from './admin.attributes.controller';
import { AdminUnitsController } from './admin.units.controller';
import { AdminPromotionsController } from './admin.promotions.controller';
import { AdminCampaignsController } from './admin.campaigns.controller';
import { AdminAdvertisementsController } from './admin.advertisements.controller';
import { AdminFlashSalesController } from './admin.flash-sales.controller';
import { AdminBannersController } from './admin.banners.controller';
import { AdminNotificationsController } from './admin.notifications.controller';
import { AdminMessagesController } from './admin.messages.controller';
import { AdminRefundsController } from './admin.refunds.controller';
import { AdminSettingsController } from './admin.settings.controller';
import { AdminZonesController } from './admin.zones.controller';
import { AdminDeliveryController } from './admin.delivery.controller';
import { AdminParcelController } from './admin.parcel.controller';
import { AdminRentalController } from './admin.rental.controller';

const router = Router();
const ordersCtrl = new AdminOrdersController();
const usersCtrl = new AdminUsersController();
const storesCtrl = new AdminStoresController();
const dispatchCtrl = new AdminDispatchController();
const couponsCtrl = new AdminCouponsController();
const dashboardCtrl = new AdminDashboardController();
const transactionsCtrl = new AdminTransactionsController();
const itemsCtrl = new AdminItemsController();
const categoriesCtrl = new AdminCategoriesController();
const attributesCtrl = new AdminAttributesController();
const unitsCtrl = new AdminUnitsController();
const promotionsCtrl = new AdminPromotionsController();
const campaignsCtrl = new AdminCampaignsController();
const advertisementsCtrl = new AdminAdvertisementsController();
const flashSalesCtrl = new AdminFlashSalesController();
const bannersCtrl = new AdminBannersController();
const notificationsCtrl = new AdminNotificationsController();
const messagesCtrl = new AdminMessagesController();
const refundsCtrl = new AdminRefundsController();
const settingsCtrl = new AdminSettingsController();
const zonesCtrl = new AdminZonesController();
const deliveryCtrl = new AdminDeliveryController();
const parcelCtrl = new AdminParcelController();
const rentalCtrl = new AdminRentalController();

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
router.get('/transactions/account', transactionsCtrl.getAccountTransactions);
router.get('/transactions/store/withdrawals', transactionsCtrl.getStoreWithdrawals);
router.get('/transactions/courier/withdrawals', transactionsCtrl.getCourierWithdrawals);
router.get('/transactions/store-disbursements', transactionsCtrl.getStoreDisbursements);
router.get('/transactions/courier-disbursements', transactionsCtrl.getCourierDisbursements);
router.get('/transactions/courier/earnings', transactionsCtrl.getCourierEarnings);
router.get('/transactions/reports/day-wise', transactionsCtrl.getDayWiseReport);
router.get('/transactions/reports/item-wise', transactionsCtrl.getItemWiseReport);
router.get('/transactions/reports/store-wise', transactionsCtrl.getStoreWiseReport);
router.get('/transactions/reports/disbursement', transactionsCtrl.getDisbursementReport);
router.get('/transactions/:type/withdraw-requests', transactionsCtrl.getWithdrawRequests);

// ── Coupons ──
router.get('/coupons', couponsCtrl.listCoupons);
router.post('/coupons', couponsCtrl.createCoupon);
router.put('/coupons/:id', couponsCtrl.updateCoupon);
router.delete('/coupons/:id', couponsCtrl.deleteCoupon);

// ── Items ──
router.get('/items', itemsCtrl.listItems);
router.post('/items', itemsCtrl.createItem);
router.get('/items/:id', itemsCtrl.getItem);
router.put('/items/:id', itemsCtrl.updateItem);
router.delete('/items/:id', itemsCtrl.deleteItem);

// ── Categories ──
router.get('/categories', categoriesCtrl.listCategories);
router.post('/categories', categoriesCtrl.createCategory);
router.put('/categories/:id', categoriesCtrl.updateCategory);
router.delete('/categories/:id', categoriesCtrl.deleteCategory);

// ── Attributes ──
router.get('/attributes', attributesCtrl.listAttributes);
router.post('/attributes', attributesCtrl.createAttribute);
router.put('/attributes/:id', attributesCtrl.updateAttribute);
router.delete('/attributes/:id', attributesCtrl.deleteAttribute);

// ── Units ──
router.get('/units', unitsCtrl.listUnits);
router.post('/units', unitsCtrl.createUnit);
router.put('/units/:id', unitsCtrl.updateUnit);
router.delete('/units/:id', unitsCtrl.deleteUnit);

// ── Promotions ──
router.get('/promotions', promotionsCtrl.list);
router.post('/promotions', promotionsCtrl.create);
router.put('/promotions/:id', promotionsCtrl.update);
router.delete('/promotions/:id', promotionsCtrl.delete);

// ── Campaigns ──
router.get('/campaigns', campaignsCtrl.list);
router.post('/campaigns', campaignsCtrl.create);
router.put('/campaigns/:id', campaignsCtrl.update);
router.delete('/campaigns/:id', campaignsCtrl.delete);

// ── Advertisements ──
router.get('/advertisements', advertisementsCtrl.list);
router.post('/advertisements', advertisementsCtrl.create);
router.put('/advertisements/:id', advertisementsCtrl.update);
router.delete('/advertisements/:id', advertisementsCtrl.delete);

// ── Flash Sales ──
router.get('/flash-sales', flashSalesCtrl.list);
router.post('/flash-sales', flashSalesCtrl.create);
router.put('/flash-sales/:id', flashSalesCtrl.update);
router.delete('/flash-sales/:id', flashSalesCtrl.delete);

// ── Banners ──
router.get('/banners', bannersCtrl.list);
router.post('/banners', bannersCtrl.create);
router.put('/banners/:id', bannersCtrl.update);
router.delete('/banners/:id', bannersCtrl.delete);

// ── Notifications ──
router.get('/notifications', notificationsCtrl.list);
router.post('/notifications', notificationsCtrl.create);
router.put('/notifications/:id', notificationsCtrl.update);
router.delete('/notifications/:id', notificationsCtrl.delete);

// ── Messages ──
router.get('/messages', messagesCtrl.list);
router.get('/messages/:id', messagesCtrl.getById);

// ── Refunds ──
router.get('/refunds', refundsCtrl.list);
router.get('/refunds/:id', refundsCtrl.getById);
router.post('/refunds/:id/approve', refundsCtrl.approve);
router.post('/refunds/:id/reject', refundsCtrl.reject);

// ── Settings ──
router.get('/settings/business', settingsCtrl.getBusinessSettings);
router.put('/settings/business', settingsCtrl.updateBusinessSettings);
router.get('/settings/tax', settingsCtrl.getTaxSettings);
router.put('/settings/tax/:id', settingsCtrl.updateTaxSettings);
router.get('/settings/payment-methods', settingsCtrl.getPaymentMethods);

// ── Zones ──
router.get('/zones', zonesCtrl.listZones);
router.post('/zones', zonesCtrl.createZone);
router.put('/zones/:id', zonesCtrl.updateZone);
router.delete('/zones/:id', zonesCtrl.deleteZone);

// ── Delivery ──
router.get('/delivery/configuration', deliveryCtrl.getDeliveryConfig);
router.put('/delivery/configuration', deliveryCtrl.updateDeliveryConfig);
router.get('/delivery/vehicle-categories', deliveryCtrl.getVehicleCategories);
router.put('/delivery/vehicle-categories/:id', deliveryCtrl.updateVehicleCategory);

// ── Parcel ──
router.get('/parcel/dashboard', parcelCtrl.getDashboard);

// ── Rental ──
router.get('/rental/dashboard', rentalCtrl.getDashboard);

export default router;
