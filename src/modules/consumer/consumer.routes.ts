import { Router } from 'express';
import { ConsumerController } from './consumer.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

import { validateRequest } from '../../common/middleware/validate.middleware';
import { updateProfileSchema, createAddressSchema, updateAddressSchema } from './consumer.validation';

const router = Router();
const consumerController = new ConsumerController();

// Apply auth middleware and check if the user has the 'consumer' role for all consumer routes
router.use(authMiddleware);
router.use(roleMiddleware(['consumer']));

// Profile routes
router.get('/profile', consumerController.getProfile);
router.put('/profile', validateRequest(updateProfileSchema), consumerController.updateProfile);
router.delete('/account', consumerController.deleteAccount);

// Addresses routes
router.get('/addresses', consumerController.getAddresses);
router.post('/addresses', validateRequest(createAddressSchema), consumerController.createAddress);
router.put('/addresses/:id', validateRequest(updateAddressSchema), consumerController.updateAddress);
router.delete('/addresses/:id', consumerController.deleteAddress);

// Favorites routes
router.get('/favorites', consumerController.getFavorites);
router.post('/favorites/:storeId', consumerController.addFavorite);
router.delete('/favorites/:storeId', consumerController.removeFavorite);

export default router;
