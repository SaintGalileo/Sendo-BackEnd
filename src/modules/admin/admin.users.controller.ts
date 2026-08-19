import { Request, Response } from 'express';
import { AdminUsersService } from './admin.users.service';

const service = new AdminUsersService();

export class AdminUsersController {
    async listCustomers(req: Request, res: Response) {
        const { search, page, limit } = req.query;
        const result = await service.listCustomers({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCustomer(req: Request, res: Response) {
        const result = await service.getCustomer(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async listCouriers(req: Request, res: Response) {
        const { search, page, limit, online } = req.query;
        const result = await service.listCouriers({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            online: online !== undefined ? online === 'true' : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }

    async getCourier(req: Request, res: Response) {
        const result = await service.getCourier(req.params.id as string);
        if (!result.success) return res.status(404).json(result);
        return res.json(result);
    }

    async listMerchants(req: Request, res: Response) {
        const { search, page, limit } = req.query;
        const result = await service.listMerchants({
            search: search as string,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(result.success ? 200 : 500).json(result);
    }
}
