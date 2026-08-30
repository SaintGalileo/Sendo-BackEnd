import { Request, Response } from 'express';
import { AdminMessagesService } from './admin.messages.service';

const service = new AdminMessagesService();

export class AdminMessagesController {
    async list(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.list(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getById(req: Request, res: Response) {
        const result = await service.getById(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async markRead(req: Request, res: Response) {
        const isRead = req.body?.is_read !== false && req.body?.read !== false;
        const result = await service.markRead(req.params.id as string, Boolean(isRead));
        return res.status(result.success ? 200 : 400).json(result);
    }
}
