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
import { AdminUploadsController } from './admin.uploads.controller';
import {
    AdminAuditController,
    AdminStoreEmployeesController,
} from './admin.store-employees.controller';
import { AdminUtilityController } from './admin.utility.controller';

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
const uploadsCtrl = new AdminUploadsController();
const deliveryCtrl = new AdminDeliveryController();
const parcelCtrl = new AdminParcelController();
const rentalCtrl = new AdminRentalController();
const storeEmployeesCtrl = new AdminStoreEmployeesController();
const auditCtrl = new AdminAuditController();
const utilityCtrl = new AdminUtilityController();

// All admin routes require authentication + admin (or super_admin) role.
// Super-admins often carry primary role `super_admin` with `roles: ['admin','super_admin']`.
router.use(authMiddleware, roleMiddleware(['admin', 'super_admin']));

const requireSuperAdmin = roleMiddleware(['super_admin']);

// Health check
router.get('/health', (_req, res) => res.json({ success: true, message: 'Admin API healthy' }));

// ── Uploads ──
router.post('/uploads', (req, res) => uploadsCtrl.upload(req, res));

// ── Dashboard ──
router.get('/dashboard', dashboardCtrl.getOverview);

// ── Orders ──
router.get('/orders/counts', ordersCtrl.getCounts);
router.get('/orders', ordersCtrl.listOrders);
router.get('/orders/:id', ordersCtrl.getOrder);
router.post('/orders/:id/cancel', ordersCtrl.cancelOrder);

// ── Users ──
router.get('/users/overview', (req, res) => usersCtrl.getUsersOverview(req, res));
router.get('/customers', usersCtrl.listCustomers);
router.get('/customers/:id', usersCtrl.getCustomer);
router.put('/customers/:id', (req, res) => usersCtrl.updateCustomer(req as any, res));
router.delete('/customers/:id', requireSuperAdmin, (req, res) => usersCtrl.deleteCustomer(req as any, res));
router.get('/couriers', usersCtrl.listCouriers);
router.post('/couriers', usersCtrl.createCourier);
router.get('/couriers/:id', usersCtrl.getCourier);
router.put('/couriers/:id', (req, res) => usersCtrl.updateCourier(req as any, res));
router.delete('/couriers/:id', requireSuperAdmin, (req, res) => usersCtrl.deleteCourier(req as any, res));
router.get('/merchants', usersCtrl.listMerchants);

// ── Employees: any admin can list; mutations stay super-admin only ──
router.get('/employees', (req, res) => usersCtrl.listEmployees(req, res));
router.get('/employees/:id', (req, res) => usersCtrl.getEmployee(req, res));
router.post('/employees', requireSuperAdmin, (req, res) => usersCtrl.createEmployee(req, res));
router.put('/employees/:id', requireSuperAdmin, (req, res) => usersCtrl.updateEmployee(req, res));
router.put('/employees/:id/status', requireSuperAdmin, (req, res) => usersCtrl.updateEmployeeStatus(req as any, res));
router.post('/employees/:id/reset-password', requireSuperAdmin, (req, res) => usersCtrl.resetEmployeePassword(req, res));
router.delete('/employees/:id', requireSuperAdmin, (req, res) => usersCtrl.deleteEmployee(req as any, res));

// ── Store employees ──
router.get('/store-employees', (req, res) => storeEmployeesCtrl.list(req, res));
router.post('/store-employees', (req, res) => storeEmployeesCtrl.create(req as any, res));
router.get('/store-employees/:id', (req, res) => storeEmployeesCtrl.get(req, res));
router.put('/store-employees/:id', (req, res) => storeEmployeesCtrl.update(req as any, res));
router.delete('/store-employees/:id', requireSuperAdmin, (req, res) => storeEmployeesCtrl.delete(req as any, res));

// ── Audit logs ──
router.get('/audit-logs', requireSuperAdmin, (req, res) => auditCtrl.list(req, res));

// ── Stores ──
router.get('/stores', storesCtrl.listStores);
router.post('/stores', (req, res) => storesCtrl.createStore(req as any, res));
router.post('/stores/bulk-import', storesCtrl.bulkCreateStores);
router.get('/stores/:id', storesCtrl.getStore);
router.put('/stores/:id', (req, res) => storesCtrl.updateStore(req as any, res));
router.put('/stores/:id/status', (req, res) => storesCtrl.updateStoreStatus(req as any, res));
router.delete('/stores/:id', requireSuperAdmin, (req, res) => storesCtrl.deleteStore(req as any, res));

// ── Dispatch ──
router.get('/dispatch/counts', dispatchCtrl.getCounts);
router.get('/dispatch/overview-map', dispatchCtrl.getOverviewMap);
router.get('/dispatch/orders/available', dispatchCtrl.listAvailableOrders);
router.get('/dispatch/orders/ongoing', dispatchCtrl.listOngoingOrders);
router.post('/dispatch/orders/:orderId/assign', dispatchCtrl.assignCourier);

// ── Transactions ──
router.get('/transactions/report', transactionsCtrl.getTransactionReport);
router.get('/transactions/account', transactionsCtrl.getAccountTransactions);
router.post('/transactions/account', transactionsCtrl.createAccountTransaction);
router.get('/transactions/store/withdrawals', transactionsCtrl.getStoreWithdrawals);
router.get('/transactions/courier/withdrawals', transactionsCtrl.getCourierWithdrawals);
router.get('/transactions/store-disbursements', transactionsCtrl.getStoreDisbursements);
router.get('/transactions/courier-disbursements', transactionsCtrl.getCourierDisbursements);
router.get('/transactions/courier/earnings', transactionsCtrl.getCourierEarnings);
router.post('/transactions/courier/earnings', transactionsCtrl.createCourierEarning);
router.get('/transactions/reports/day-wise', transactionsCtrl.getDayWiseReport);
router.get('/transactions/reports/item-wise', transactionsCtrl.getItemWiseReport);
router.get('/transactions/reports/store-wise', transactionsCtrl.getStoreWiseReport);
router.get('/transactions/reports/disbursement', transactionsCtrl.getDisbursementReport);
// Static report paths MUST be registered before /:type/withdraw-requests
router.get('/transactions/reports/order', transactionsCtrl.getOrderReport);
router.get('/transactions/reports/expense', transactionsCtrl.getExpenseReport);
router.get('/transactions/reports/vendor-wise-taxes', transactionsCtrl.getVendorWiseTaxesReport);
router.get('/transactions/reports/parcel-wise-taxes', transactionsCtrl.getParcelWiseTaxesReport);
router.get('/transactions/rental/reports/transaction', transactionsCtrl.getRentalTransactionReport);
router.get('/transactions/rental/reports/vehicle', transactionsCtrl.getRentalVehicleReport);
router.get('/transactions/rental/reports/provider-wise', transactionsCtrl.getRentalProviderWiseReport);
router.get('/transactions/rental/reports/trip', transactionsCtrl.getRentalTripReport);
router.get('/transactions/rental/reports/provider-wise-taxes', transactionsCtrl.getRentalProviderWiseTaxesReport);
router.get('/transactions/:type/withdraw-requests', transactionsCtrl.getWithdrawRequests);

// ── Coupons ──
router.get('/coupons', couponsCtrl.listCoupons);
router.post('/coupons', couponsCtrl.createCoupon);
router.put('/coupons/:id', couponsCtrl.updateCoupon);
router.delete('/coupons/:id', couponsCtrl.deleteCoupon);

// ── Categories ──
router.get('/categories', categoriesCtrl.listCategories);
router.post('/categories', (req, res) => categoriesCtrl.createCategory(req as any, res));
router.get('/categories/:id', (req, res) => categoriesCtrl.getCategory(req, res));
router.put('/categories/:id', (req, res) => categoriesCtrl.updateCategory(req as any, res));
router.delete('/categories/:id', requireSuperAdmin, (req, res) => categoriesCtrl.deleteCategory(req as any, res));

// ── Items ──
router.get('/items', itemsCtrl.listItems);
router.post('/items', (req, res) => itemsCtrl.createItem(req as any, res));
router.post('/items/bulk-import', itemsCtrl.bulkCreateItems);
router.get('/items/:id', itemsCtrl.getItem);
router.put('/items/:id', (req, res) => itemsCtrl.updateItem(req as any, res));
router.delete('/items/:id', requireSuperAdmin, (req, res) => itemsCtrl.deleteItem(req as any, res));

// ── Attributes ──
router.get('/attributes', attributesCtrl.listAttributes);
router.post('/attributes', attributesCtrl.createAttribute);
router.get('/attributes/:id', attributesCtrl.getAttribute);
router.put('/attributes/:id', attributesCtrl.updateAttribute);
router.delete('/attributes/:id', attributesCtrl.deleteAttribute);

// ── Units ──
router.get('/units', unitsCtrl.listUnits);
router.post('/units', unitsCtrl.createUnit);
router.get('/units/:id', unitsCtrl.getUnit);
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
router.get('/flash-sales/:id', flashSalesCtrl.getById);
router.put('/flash-sales/:id', flashSalesCtrl.update);
router.put('/flash-sales/:id/products', flashSalesCtrl.setProducts);
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
router.patch('/messages/:id/read', messagesCtrl.markRead);

// ── Refunds ──
router.get('/refunds', refundsCtrl.list);
router.get('/refunds/:id', refundsCtrl.getById);
router.post('/refunds/:id/approve', refundsCtrl.approve);
router.post('/refunds/:id/reject', refundsCtrl.reject);

// ── Settings (reads: all admins; privileged writes: super-admin) ──
router.get('/settings/business', settingsCtrl.getBusinessSettings);
router.put('/settings/business', requireSuperAdmin, settingsCtrl.updateBusinessSettings);
router.get('/settings/tax', settingsCtrl.getTaxSettings);
router.post('/settings/tax', requireSuperAdmin, settingsCtrl.createTax);
router.put('/settings/tax/:id', requireSuperAdmin, settingsCtrl.updateTaxSettings);
router.get('/settings/payment-methods', settingsCtrl.getPaymentMethods);
router.put('/settings/payment-methods', requireSuperAdmin, settingsCtrl.updatePaymentMethods);
router.get('/settings/withdraw-methods', settingsCtrl.getWithdrawMethods);
router.post('/settings/withdraw-methods', settingsCtrl.createWithdrawMethod);
router.put('/settings/withdraw-methods/:id', settingsCtrl.updateWithdrawMethod);
router.delete('/settings/withdraw-methods/:id', settingsCtrl.deleteWithdrawMethod);
router.get('/settings/custom-roles', settingsCtrl.getCustomRoles);
router.post('/settings/custom-roles', settingsCtrl.createCustomRole);
router.put('/settings/custom-roles/:id', settingsCtrl.updateCustomRole);
router.delete('/settings/custom-roles/:id', settingsCtrl.deleteCustomRole);
router.get('/settings/analytic', settingsCtrl.getAnalyticSettings);
router.put('/settings/analytic', requireSuperAdmin, settingsCtrl.updateAnalyticSettings);
router.get('/settings/websocket', settingsCtrl.getWebsocketSettings);
router.put('/settings/websocket', requireSuperAdmin, settingsCtrl.updateWebsocketSettings);
router.get('/settings/ai', settingsCtrl.getAiSettings);
router.put('/settings/ai', requireSuperAdmin, settingsCtrl.updateAiSettings);
router.get('/settings/subscription', settingsCtrl.getSubscriptionSettings);
router.put('/settings/subscription', requireSuperAdmin, settingsCtrl.updateSubscriptionSettings);
router.get('/settings/subscription/packages', settingsCtrl.getSubscriptionPackages);
router.put('/settings/subscription/packages', requireSuperAdmin, settingsCtrl.updateSubscriptionPackages);
router.get('/settings/subscription/subscribers', settingsCtrl.getSubscriptionSubscribers);
router.get('/settings/modules', settingsCtrl.getModules);
router.put('/settings/modules', requireSuperAdmin, settingsCtrl.updateModules);
router.get('/settings/fcm', settingsCtrl.getFcmMessages);
router.put('/settings/fcm', settingsCtrl.updateFcmMessages);
router.get('/settings/fcm-config', settingsCtrl.getFcmConfig);
router.put('/settings/fcm-config', requireSuperAdmin, settingsCtrl.updateFcmConfig);
router.get('/settings/notifications', settingsCtrl.getNotificationChannels);
router.put('/settings/notifications', settingsCtrl.updateNotificationChannels);
router.get('/settings/sms', settingsCtrl.getSmsSettings);
router.put('/settings/sms', requireSuperAdmin, settingsCtrl.updateSmsSettings);
router.get('/settings/app', settingsCtrl.getAppSettings);
router.put('/settings/app', requireSuperAdmin, settingsCtrl.updateAppSettings);
router.get('/settings/login', settingsCtrl.getLoginSettings);
router.put('/settings/login', requireSuperAdmin, settingsCtrl.updateLoginSettings);
router.get('/settings/cms/:pageKey', settingsCtrl.getCmsPage);
router.put('/settings/cms/:pageKey', settingsCtrl.updateCmsPage);
router.get('/settings/email-templates/:templateKey', settingsCtrl.getEmailTemplate);
router.put('/settings/email-templates/:templateKey', requireSuperAdmin, settingsCtrl.updateEmailTemplate);
router.get('/settings/gallery', settingsCtrl.getGallery);
router.put('/settings/gallery', requireSuperAdmin, settingsCtrl.updateGallery);
router.get('/settings/languages', settingsCtrl.getLanguages);
router.put('/settings/languages', requireSuperAdmin, settingsCtrl.updateLanguages);

// ── Utility: contacts & surge (separate admin pages) ──
router.get('/utility/contacts', utilityCtrl.getContacts);
router.put('/utility/contacts', requireSuperAdmin, (req, res) => utilityCtrl.updateContacts(req as any, res));
router.get('/utility/surge-pricing', utilityCtrl.getSurgePricing);
router.put('/utility/surge-pricing', requireSuperAdmin, (req, res) => utilityCtrl.updateSurgePricing(req as any, res));

// ── Zones (read: all admins; mutations: super-admin) ──
router.get('/zones/locations', zonesCtrl.listLocationZones);
router.get('/zones', zonesCtrl.listZones);
router.post('/zones', requireSuperAdmin, zonesCtrl.createZone);
router.put('/zones/:id', requireSuperAdmin, zonesCtrl.updateZone);
router.delete('/zones/:id', requireSuperAdmin, zonesCtrl.deleteZone);

// ── Delivery ──
router.get('/delivery/configuration', deliveryCtrl.getDeliveryConfig);
router.put('/delivery/configuration', requireSuperAdmin, deliveryCtrl.updateDeliveryConfig);
router.get('/delivery/vehicle-categories', deliveryCtrl.getVehicleCategories);
router.put('/delivery/vehicle-categories/:id', deliveryCtrl.updateVehicleCategory);

// ── Parcel ──
router.get('/parcel/dashboard', parcelCtrl.getDashboard);

// ── Rental ──
router.get('/rental/dashboard', rentalCtrl.getDashboard);
router.get('/rental/providers', rentalCtrl.listProviders);
router.post('/rental/providers', (req, res) => rentalCtrl.createProvider(req as any, res));
router.post('/rental/providers/bulk-import', rentalCtrl.bulkCreateProviders);
router.get('/rental/providers/:id', rentalCtrl.getProvider);
router.put('/rental/providers/:id', requireSuperAdmin, (req, res) => rentalCtrl.updateProvider(req as any, res));
router.delete('/rental/providers/:id', requireSuperAdmin, (req, res) => rentalCtrl.deleteProvider(req as any, res));
router.get('/rental/vehicles', rentalCtrl.listVehicles);
router.post('/rental/vehicles', (req, res) => rentalCtrl.createVehicle(req as any, res));
router.get('/rental/vehicles/:id', rentalCtrl.getVehicle);
router.put('/rental/vehicles/:id', requireSuperAdmin, (req, res) => rentalCtrl.updateVehicle(req as any, res));
router.delete('/rental/vehicles/:id', requireSuperAdmin, (req, res) => rentalCtrl.deleteVehicle(req as any, res));
router.get('/rental/trips', rentalCtrl.listTrips);

export default router;
