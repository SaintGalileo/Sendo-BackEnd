import { Request, Response } from 'express';
import { AdminUnitsService } from './admin.units.service';

const service = new AdminUnitsService();

export class AdminUnitsController {
    async listUnits(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listUnits(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getUnit(req: Request, res: Response) {
        const result = await service.getUnit(req.params.id as string);
        return res.status(result.success ? 200 : 404).json(result);
    }

    async createUnit(req: Request, res: Response) {
        const result = await service.createUnit(req.body ?? {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateUnit(req: Request, res: Response) {
        const result = await service.updateUnit(req.params.id as string, req.body ?? {});
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteUnit(req: Request, res: Response) {
        const result = await service.deleteUnit(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
