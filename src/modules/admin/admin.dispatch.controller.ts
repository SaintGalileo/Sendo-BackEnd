import { Request, Response } from 'express';
import { AdminDispatchService } from './admin.dispatch.service';

const service = new AdminDispatchService();

export class AdminDispatchController {
    async listAvailableOrders(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listAvailableOrders(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async assignCourier(req: Request, res: Response) {
        const { courierId } = req.body || {};
        if (!courierId) {
            return res.status(400).json({ success: false, message: 'courierId is required' });
        }
        const result = await service.assignCourier(req.params.orderId as string, courierId);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
