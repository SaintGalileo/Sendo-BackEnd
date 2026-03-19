import { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const ordersService = new OrdersService();

export class OrdersController {
    async createOrder(req: AuthRequest, res: Response) {
        try {
            const { addressId, notes } = req.body;
            if (!addressId) return sendResponse(res, 400, false, 'Address ID is required');

            const order = await ordersService.createOrder(req.user.id, { addressId, notes });
            return sendResponse(res, 201, true, 'Order created successfully', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getOrders(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const result = await ordersService.getOrders(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Orders fetched successfully', formatPaginatedResponse(result.data, result.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getOrderById(req: AuthRequest, res: Response) {
        try {
            const order = await ordersService.getOrderById(req.user.id, req.params.orderId as string);
            return sendResponse(res, 200, true, 'Order fetched successfully', order);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async cancelOrder(req: AuthRequest, res: Response) {
        try {
            const order = await ordersService.cancelOrder(req.user.id, req.params.orderId as string);
            return sendResponse(res, 200, true, 'Order cancelled', order);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async rateOrder(req: AuthRequest, res: Response) {
        try {
            const { rating, comment } = req.body;
            if (!rating) return sendResponse(res, 400, false, 'Rating is required');

            const review = await ordersService.rateOrder(req.user.id, req.params.orderId as string, { rating, comment });
            return sendResponse(res, 201, true, 'Order rated successfully', review);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }

    async getOrderTracking(req: AuthRequest, res: Response) {
        try {
            const tracking = await ordersService.getOrderTracking(req.user.id, req.params.orderId as string);
            return sendResponse(res, 200, true, 'Order tracking retrieved', tracking);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getDeliveryFeeEstimate(req: AuthRequest, res: Response) {
        try {
            const { merchantId, addressId } = req.query;
            if (!merchantId || !addressId) {
                return sendResponse(res, 400, false, 'merchantId and addressId are required');
            }

            const fee = await ordersService.getDeliveryFeeEstimate(merchantId as string, addressId as string);
            return sendResponse(res, 200, true, 'Delivery fee estimated', { fee, currency: 'NGN' });
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
