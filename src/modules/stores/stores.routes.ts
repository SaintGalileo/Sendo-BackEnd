import { Router } from 'express';
import { StoresController } from './stores.controller';

const router = Router();
const storesController = new StoresController();

// Consumer discovery endpoints
router.get('/', storesController.getStores);
router.get('/search', storesController.getStores); // Map /search to the same list endpoint with q=? param support
router.get('/:storeId', storesController.getStoreById);
router.get('/:storeId/menu', storesController.getStoreMenu);
router.get('/:storeId/categories', storesController.getStoreCategories);
router.get('/:storeId/products', storesController.getStoreProducts);

export default router;
