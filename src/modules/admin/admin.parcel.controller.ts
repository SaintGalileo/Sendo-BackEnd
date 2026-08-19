import { Request, Response } from 'express';
import { AdminParcelService } from './admin.parcel.service';

const service = new AdminParcelService();

export class AdminParcelController {
    async getDashboard(_req: Request, res: Response) {
        const result = await service.getDashboard();
        return res.status(result.success ? 200 : 500).json(result);
    }
}
