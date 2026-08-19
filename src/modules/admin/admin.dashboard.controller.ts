import { Request, Response } from 'express';
import { AdminDashboardService } from './admin.dashboard.service';

const service = new AdminDashboardService();

export class AdminDashboardController {
    async getOverview(_req: Request, res: Response) {
        const result = await service.getOverview();
        return res.json(result);
    }
}
