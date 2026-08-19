import { Request, Response } from 'express';
import { AdminDeliveryService } from './admin.delivery.service';

const service = new AdminDeliveryService();

export class AdminDeliveryController {
    async getDeliveryConfig(_req: Request, res: Response) {
        const result = await service.getDeliveryConfig();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async updateDeliveryConfig(req: Request, res: Response) {
        const result = await service.updateDeliveryConfig(req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getVehicleCategories(_req: Request, res: Response) {
        const result = await service.getVehicleCategories();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async updateVehicleCategory(req: Request, res: Response) {
        const result = await service.updateVehicleCategory(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
