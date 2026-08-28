import { Request, Response } from 'express';
import { AdminRentalService } from './admin.rental.service';

const service = new AdminRentalService();

export class AdminRentalController {
    async getDashboard(_req: Request, res: Response) {
        const result = await service.getDashboard();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async listProviders(_req: Request, res: Response) {
        const result = await service.listProviders();
        return res.status(200).json(result);
    }

    async createProvider(req: Request, res: Response) {
        const result = await service.createProvider(req.body || {});
        return res.status(result.success ? 201 : 400).json(result);
    }

    async bulkCreateProviders(req: Request, res: Response) {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const result = await service.bulkCreateProviders(rows);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async listVehicles(_req: Request, res: Response) {
        const result = await service.listVehicles();
        return res.status(200).json(result);
    }

    async createVehicle(req: Request, res: Response) {
        const result = await service.createVehicle(req.body || {});
        return res.status(result.success ? 201 : 400).json(result);
    }
}
