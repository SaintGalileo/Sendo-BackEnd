import { Request, Response } from 'express';
import { ReviewsService } from './reviews.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const reviewsService = new ReviewsService();

export class ReviewsController {
    async createReview(req: AuthRequest, res: Response) {
        try {
            const { targetId, type, rating, comment } = req.body;
            if (!targetId || !type || !rating) return sendResponse(res, 400, false, 'Target ID, type (store/courier), and rating are required');

            const review = await reviewsService.createReview(req.user.id, targetId, type, rating, comment);
            return sendResponse(res, 201, true, 'Review created successfully', review);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getStoreReviews(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const reviews = await reviewsService.getStoreReviews(req.params.storeId as string, pagination);
            return sendResponse(res, 200, true, 'Store reviews fetched', formatPaginatedResponse(reviews.data, reviews.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getCourierReviews(req: Request, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const reviews = await reviewsService.getCourierReviews(req.params.courierId as string, pagination);
            return sendResponse(res, 200, true, 'Courier reviews fetched', formatPaginatedResponse(reviews.data, reviews.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
