import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';
import { getPaginationOptions, formatPaginatedResponse } from '../../common/utils/pagination';

const paymentsService = new PaymentsService();

export class PaymentsController {
    async createIntent(req: AuthRequest, res: Response) {
        try {
            const { orderId, amount } = req.body;
            if (!orderId || !amount) return sendResponse(res, 400, false, 'Order ID and amount are required');

            const intent = await paymentsService.createIntent(req.user.id, orderId, amount);
            return sendResponse(res, 201, true, 'Payment intent created', intent);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async confirmPayment(req: AuthRequest, res: Response) {
        try {
            const { transactionId } = req.body;
            if (!transactionId) return sendResponse(res, 400, false, 'Transaction ID is required');

            const payment = await paymentsService.confirmPayment(req.user.id, transactionId);
            return sendResponse(res, 200, true, 'Payment confirmed', payment);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async getHistory(req: AuthRequest, res: Response) {
        try {
            const pagination = getPaginationOptions(req.query);
            const history = await paymentsService.getHistory(req.user.id, pagination);
            return sendResponse(res, 200, true, 'Payment history fetched', formatPaginatedResponse(history.data, history.totalCount, pagination.page, pagination.limit));
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async addTip(req: AuthRequest, res: Response) {
        try {
            const { orderId, amount } = req.body;
            if (!orderId || !amount) return sendResponse(res, 400, false, 'Order ID and tip amount are required');

            const tip = await paymentsService.addTip(req.user.id, orderId, amount);
            return sendResponse(res, 201, true, 'Tip added successfully', tip);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async refundPayment(req: AuthRequest, res: Response) {
        try {
            const { orderId } = req.body;
            if (!orderId) return sendResponse(res, 400, false, 'Order ID is required');

            const refund = await paymentsService.refundPayment(req.user.id, orderId);
            return sendResponse(res, 200, true, 'Payment refunded', refund);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }
}
