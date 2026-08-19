import { Request, Response } from 'express';
import { AdminStoresService } from './admin.stores.service';

const service = new AdminStoresService();

export class AdminStoresController {
    async listStores(req: Request, res: Response) {
        const { search, type, status, page, limit } = req.query;
        const result = await service.listStores({
            search: search as string,
            type: type as string,
            status: status as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getStore(req: Request, res: Response) {
        const result = await service.getStore(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async updateStoreStatus(req: Request, res: Response) {
        const { status } = req.body || {};
        if (!status) return res.status(400).json({ success: false, message: 'Status is required' });
        const result = await service.updateStoreStatus(req.params.id as string, status);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
