import { Router } from 'express';
import { CartController } from './cart.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const cartController = new CartController();

router.use(authMiddleware);
router.use(roleMiddleware(['consumer']));

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.put('/items/:id', cartController.updateItem);
router.delete('/items/:id', cartController.removeItem);
router.delete('/clear', cartController.clearCart); // Define before /items/:id? Wait, /clear is specific so it will match.

export default router;
