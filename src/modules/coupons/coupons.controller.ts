import { Request, Response } from 'express';
import { CouponsService } from './coupons.service';
import { AuthRequest } from '../../common/middleware/auth.middleware';
import { sendResponse } from '../../common/utils/response';

const couponsService = new CouponsService();

export class CouponsController {
    async getCoupons(req: Request, res: Response) {
        try {
            const coupons = await couponsService.getAvailableCoupons();
            return sendResponse(res, 200, true, 'Coupons fetched', coupons);
        } catch (error: any) {
            return sendResponse(res, 500, false, error.message);
        }
    }

    async applyCoupon(req: AuthRequest, res: Response) {
        try {
            const { code } = req.body;
            if (!code) return sendResponse(res, 400, false, 'Coupon code is required');

            const coupon = await couponsService.applyCoupon(req.user.id, code);
            return sendResponse(res, 200, true, 'Coupon applied', coupon);
        } catch (error: any) {
            return sendResponse(res, 400, false, error.message);
        }
    }
}
