import { Request, Response } from 'express';
import { AdminSettingsService } from './admin.settings.service';

const service = new AdminSettingsService();

export class AdminSettingsController {
    async getBusinessSettings(_req: Request, res: Response) {
        const result = await service.getBusinessSettings();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async updateBusinessSettings(req: Request, res: Response) {
        const result = await service.updateBusinessSettings(req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getTaxSettings(_req: Request, res: Response) {
        const result = await service.getTaxSettings();
        return res.status(result.success ? 200 : 500).json(result);
    }

    async updateTaxSettings(req: Request, res: Response) {
        const result = await service.updateTaxSettings(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async getPaymentMethods(_req: Request, res: Response) {
        const result = await service.getPaymentMethods();
        return res.status(result.success ? 200 : 500).json(result);
    }
}
