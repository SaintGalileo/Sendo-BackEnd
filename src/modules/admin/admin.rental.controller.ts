import { Request, Response } from 'express';
import { AdminRentalService } from './admin.rental.service';

const service = new AdminRentalService();

export class AdminRentalController {
    async getDashboard(_req: Request, res: Response) {
        const result = await service.getDashboard();
        return res.status(result.success ? 200 : 500).json(result);
    }
}
