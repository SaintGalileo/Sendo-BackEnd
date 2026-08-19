import { Request, Response } from 'express';
import { AdminFlashSalesService } from './admin.flash-sales.service';

const service = new AdminFlashSalesService();

export class AdminFlashSalesController {
    async list(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.list(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async create(req: Request, res: Response) {
        const result = await service.create(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async update(req: Request, res: Response) {
        const result = await service.update(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async delete(req: Request, res: Response) {
        const result = await service.delete(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
