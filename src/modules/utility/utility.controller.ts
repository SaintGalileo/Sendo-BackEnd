import { Request, Response } from 'express';
import { UtilityService } from './utility.service';

const service = new UtilityService();

export class UtilityController {
    async getContacts(_req: Request, res: Response) {
        const result = await service.getContacts();
        return res.status(200).json(result);
    }

    async getProductSurgePercentage(_req: Request, res: Response) {
        const surge_percentage = await service.getProductSurgePercentage();
        return res.status(200).json({
            success: true,
            data: { surge_percentage },
        });
    }
}
