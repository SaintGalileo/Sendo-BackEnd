import { Request, Response } from 'express';
import { AdminAttributesService } from './admin.attributes.service';

const service = new AdminAttributesService();

export class AdminAttributesController {
    async listAttributes(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listAttributes(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async createAttribute(req: Request, res: Response) {
        const result = await service.createAttribute(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateAttribute(req: Request, res: Response) {
        const result = await service.updateAttribute(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteAttribute(req: Request, res: Response) {
        const result = await service.deleteAttribute(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
