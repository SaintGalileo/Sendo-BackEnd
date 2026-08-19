import { Request, Response } from 'express';
import { AdminZonesService } from './admin.zones.service';

const service = new AdminZonesService();

export class AdminZonesController {
    async listZones(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listZones(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async createZone(req: Request, res: Response) {
        const result = await service.createZone(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateZone(req: Request, res: Response) {
        const result = await service.updateZone(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteZone(req: Request, res: Response) {
        const result = await service.deleteZone(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
