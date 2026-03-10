import { Router } from 'express';
import { ProductsController } from './products.controller';

const router = Router();
const productsController = new ProductsController();

// Consumer product endpoints
router.get('/search', productsController.getProducts); // Can use ?q=...
router.get('/:productId', productsController.getProduct);
router.get('/', productsController.getProducts); // Can use ?storeId=...

export default router;
