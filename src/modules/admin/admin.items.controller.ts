import { Request, Response } from 'express';
import { AdminItemsService } from './admin.items.service';

const service = new AdminItemsService();

export class AdminItemsController {
    async listItems(req: Request, res: Response) {
        const { search, store_id, module, city, state, zone, page, limit } = req.query;
        const result = await service.listItems({
            search: search as string,
            store_id: store_id as string,
            module: module as string,
            city: city as string,
            state: state as string,
            zone: zone as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getItem(req: Request, res: Response) {
        const result = await service.getItem(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async createItem(req: Request, res: Response) {
        const result = await service.createItem(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async bulkCreateItems(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateItems(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async updateItem(req: Request, res: Response) {
        const result = await service.updateItem(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteItem(req: Request, res: Response) {
        const result = await service.deleteItem(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
