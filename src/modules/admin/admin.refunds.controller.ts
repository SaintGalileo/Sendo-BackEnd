import { Request, Response } from 'express';
import { AdminRefundsService } from './admin.refunds.service';

const service = new AdminRefundsService();

export class AdminRefundsController {
    async list(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.list(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getById(req: Request, res: Response) {
        const result = await service.getById(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async approve(req: Request, res: Response) {
        const result = await service.approve(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async reject(req: Request, res: Response) {
        const result = await service.reject(req.params.id as string, req.body.reason);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
