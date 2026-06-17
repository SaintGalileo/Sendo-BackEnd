import { Router } from 'express';
import { StoresController } from './stores.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';

const router = Router();
const storesController = new StoresController();

// Consumer discovery endpoints
router.get('/', storesController.getStores);
router.get('/search', storesController.getStores); // Map /search to the same list endpoint with q=? param support

// Feed endpoints
router.get('/nearby', authMiddleware, storesController.getNearbyStores);
router.get('/featured', storesController.getFeaturedStores);
router.get('/city', authMiddleware, storesController.getStoresByCity);

router.get('/:storeId', storesController.getStoreById);
router.get('/:storeId/menu', storesController.getStoreMenu);
router.get('/:storeId/categories', storesController.getStoreCategories);
router.get('/:storeId/products', storesController.getStoreProducts);

export default router;
