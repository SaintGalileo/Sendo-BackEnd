import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { authMiddleware } from '../../common/middleware/auth.middleware';
import { roleMiddleware } from '../../common/middleware/role.middleware';

const router = Router();
const reviewsController = new ReviewsController();

// Create review (requires auth)
router.post('/reviews', authMiddleware, roleMiddleware(['consumer']), reviewsController.createReview);

// The get paths conflict with the /stores and /couriers root if placed there, 
// so we typically handle these in the respective module routers OR here with the full path mapped from index.ts.

// Assume this router handles the base path. 
// We will export a register function or separate routers to attach properly.

export const reviewRoutes = Router();
reviewRoutes.post('/', authMiddleware, roleMiddleware(['consumer']), reviewsController.createReview);

export const storeReviewRoutes = Router({ mergeParams: true });
storeReviewRoutes.get('/', reviewsController.getStoreReviews);

export const courierReviewRoutes = Router({ mergeParams: true });
courierReviewRoutes.get('/', reviewsController.getCourierReviews);
