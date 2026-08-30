import { Request, Response } from 'express';
import { AdminDashboardService } from './admin.dashboard.service';

const service = new AdminDashboardService();

export class AdminDashboardController {
    async getOverview(req: Request, res: Response) {
        const range = (req.query.range as string | undefined) || 'this_year';
        const { module, city, state, zone } = req.query;
        const result = await service.getOverview(range, {
            module: module as string | undefined,
            city: city as string | undefined,
            state: state as string | undefined,
            zone: zone as string | undefined,
        });
        return res.json(result);
    }
}
