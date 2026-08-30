import { Request, Response } from 'express';
import { AdminOrdersService } from './admin.orders.service';

const service = new AdminOrdersService();

export class AdminOrdersController {
    async listOrders(req: Request, res: Response) {
        const { status, payment_status, search, module, city, state, zone, merchant_id, page, limit } = req.query;
        const result = await service.listOrders({
            status: status as string,
            payment_status: payment_status as string,
            search: search as string,
            module: module as string,
            city: city as string,
            state: state as string,
            zone: zone as string,
            merchant_id: merchant_id as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCounts(req: Request, res: Response) {
        const { module, city, state, zone } = req.query;
        const result = await service.getCounts({
            module: module as string,
            city: city as string,
            state: state as string,
            zone: zone as string,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getOrder(req: Request, res: Response) {
        const result = await service.getOrder(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async cancelOrder(req: Request, res: Response) {
        const result = await service.cancelOrder(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
