import { Request, Response } from 'express';
import { AdminCouponsService } from './admin.coupons.service';

const service = new AdminCouponsService();

export class AdminCouponsController {
    async listCoupons(req: Request, res: Response) {
        const { page, limit } = req.query;
        const result = await service.listCoupons(
            page ? Number(page) : undefined,
            limit ? Number(limit) : undefined,
        );
        return res.status(result.success ? 200 : 500).json(result);
    }

    async createCoupon(req: Request, res: Response) {
        const result = await service.createCoupon(req.body);
        return res.status(result.success ? 201 : 400).json(result);
    }

    async updateCoupon(req: Request, res: Response) {
        const result = await service.updateCoupon(req.params.id as string, req.body);
        return res.status(result.success ? 200 : 400).json(result);
    }

    async deleteCoupon(req: Request, res: Response) {
        const result = await service.deleteCoupon(req.params.id as string);
        return res.status(result.success ? 200 : 400).json(result);
    }
}
